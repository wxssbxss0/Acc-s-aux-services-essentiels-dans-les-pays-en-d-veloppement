"""
Interactive Leaflet map generation for the AEP solution.

This map is designed to be closer to the technical static map:
- selected fountains with 500 m service zones
- reservoir and pipe routes
- pipe section labels with diameters
- hydraulic service status: gravity, DN upgrade, booster
- user-friendly point categories:
    menage, mosque, church, hospital, school, commerce, well, hand pump
- layer toggles for served/unserved households, pipes, labels, and service zones
"""

import json

from config import MAX_WALKING_DISTANCE_M
from utils import haversine_m


# ---------------------------------------------------------------------
# Basic helpers
# ---------------------------------------------------------------------

def _as_float(value, default=0.0):
    try:
        return float(value)
    except Exception:
        return default


def _safe(value, default="N/A"):
    if value is None:
        return default

    try:
        if str(value).lower() == "nan":
            return default
    except Exception:
        pass

    return value


def _fmt_eur(value):
    try:
        return f"{float(value):,.0f} €".replace(",", " ")
    except Exception:
        return "N/A"


def _fmt_float(value, digits=1, default="N/A"):
    try:
        return f"{float(value):.{digits}f}"
    except Exception:
        return default


# ---------------------------------------------------------------------
# Point type normalization
# ---------------------------------------------------------------------

def _normalize_type(raw_type):
    """
    Convert raw dataset Type into a normalized category.

    This lets the map visually distinguish:
    - household
    - mosque
    - church
    - hospital / health center
    - school
    - commerce
    - well
    - hand pump
    - reservoir
    """
    t = str(raw_type or "").strip().lower()

    if "menage" in t or "ménage" in t:
        return "menage"

    if "mos" in t or "masjid" in t:
        return "mosquee"

    if "eglise" in t or "église" in t or "church" in t:
        return "eglise"

    if (
        "hopital" in t
        or "hôpital" in t
        or "hospital" in t
        or "sante" in t
        or "santé" in t
        or "dispensaire" in t
        or "clinique" in t
    ):
        return "hopital"

    if "ecole" in t or "école" in t or "school" in t:
        return "ecole"

    if "commerce" in t or "marche" in t or "marché" in t:
        return "commerce"

    if "puits" in t or "well" in t:
        return "puits"

    if "pompe" in t:
        return "pompe"

    if (
        "chateau" in t
        or "château" in t
        or "reservoir" in t
        or "réservoir" in t
    ):
        return "reservoir"

    return "autre"


def _type_label(raw_type):
    kind = _normalize_type(raw_type)

    labels = {
        "menage": "Ménage",
        "mosquee": "Mosquée",
        "eglise": "Église",
        "hopital": "Hôpital / santé",
        "ecole": "École",
        "commerce": "Commerce",
        "puits": "Puits",
        "pompe": "Pompe à main",
        "reservoir": "Château d'eau",
        "autre": "Autre point",
    }

    return labels.get(kind, "Autre point")


def _type_icon(raw_type):
    kind = _normalize_type(raw_type)

    icons = {
        "menage": "●",
        "mosquee": "☪",
        "eglise": "✝",
        "hopital": "✚",
        "ecole": "■",
        "commerce": "◆",
        "puits": "×",
        "pompe": "▲",
        "reservoir": "★",
        "autre": "●",
    }

    return icons.get(kind, "●")


def _type_color(raw_type, is_served=False):
    kind = _normalize_type(raw_type)

    if kind == "menage":
        return "green" if is_served else "red"

    colors = {
        "mosquee": "#8e44ad",
        "eglise": "#7f8c8d",
        "hopital": "#e74c3c",
        "ecole": "#34495e",
        "commerce": "#f39c12",
        "puits": "#c0392b",
        "pompe": "#27ae60",
        "reservoir": "black",
        "autre": "gray",
    }

    return colors.get(kind, "gray")


# ---------------------------------------------------------------------
# Coverage calculation for map rendering
# ---------------------------------------------------------------------

def _get_served_household_indices(households, fountains):
    """
    A household is considered served if it is within MAX_WALKING_DISTANCE_M
    of at least one selected fountain.
    """
    served = set()

    for h_idx, h in households.iterrows():
        h_lon = _as_float(h["Lon"])
        h_lat = _as_float(h["Lat"])

        for _, f in fountains.iterrows():
            d = haversine_m(
                h_lon,
                h_lat,
                _as_float(f["Lon"]),
                _as_float(f["Lat"]),
            )

            if d <= MAX_WALKING_DISTANCE_M:
                served.add(h_idx)
                break

    return served


# ---------------------------------------------------------------------
# Pipe rendering helpers
# ---------------------------------------------------------------------

def _infer_pipe_diameter(segment):
    """
    Try to read pipe diameter from a segment dictionary.

    Supported keys:
    - dn_mm
    - diameter_mm
    - diametre_mm
    - diameter
    - diametre
    - DN
    - dn
    """
    for key in [
        "dn_mm",
        "diameter_mm",
        "diametre_mm",
        "diameter",
        "diametre",
        "DN",
        "dn",
    ]:
        if key in segment and segment[key] is not None:
            try:
                return int(round(float(segment[key])))
            except Exception:
                return segment[key]

    return 40


def _segment_pressure(segment):
    return _as_float(
        segment.get(
            "h_final_m",
            segment.get("pressure_m", 0.0),
        )
    )


def _segment_solution(segment):
    if segment.get("solution_retained"):
        return segment["solution_retained"]

    if segment.get("booster_required"):
        return "Gravité + pompe booster"

    if _infer_pipe_diameter(segment) >= 50:
        return "Gravité + diamètre renforcé"

    return "Gravité pure"


def _segment_color(segment):
    """
    Color code pipe sections:
    - red/orange = booster required
    - blue = larger diameter
    - dark = normal gravity
    - amber = PRV
    """
    if segment.get("booster_required"):
        return "#e74c3c"

    if segment.get("prv_needed"):
        return "#e67e22"

    try:
        if int(_infer_pipe_diameter(segment)) >= 50:
            return "#2980b9"
    except Exception:
        pass

    return "#2c3e50"


def _segment_label(segment, idx):
    length = _as_float(segment.get("length_m", 0))
    diameter = _infer_pipe_diameter(segment)
    q = _as_float(segment.get("q_lps", 0))
    pressure = _segment_pressure(segment)
    solution = _segment_solution(segment)

    return (
        f"Section {idx + 1} · "
        f"DN{diameter} · "
        f"{length:.0f} m · "
        f"Q={q:.3f} L/s · "
        f"H={pressure:.1f} mCE · "
        f"{solution}"
    )


def _segment_popup(segment, idx):
    diameter = _infer_pipe_diameter(segment)
    length = _as_float(segment.get("length_m", 0))
    q = _as_float(segment.get("q_lps", 0))
    velocity = _as_float(segment.get("velocity_ms", 0))
    hf = _as_float(segment.get("hf_m", 0))
    pressure = _segment_pressure(segment)
    solution = _segment_solution(segment)

    status_18 = "PASS" if pressure >= 18 else "FAIL"
    status_20 = "PASS" if pressure >= 20 else ("MARGINAL" if pressure >= 18 else "FAIL")

    prv = "Oui" if segment.get("prv_needed") else "Non"
    booster = "Oui" if segment.get("booster_required") else "Non"

    return f"""
    <b>Conduite — Section {idx + 1}</b><br>
    Tronçon: {segment.get("from", "N/A")} → {segment.get("to", "N/A")}<br>
    Diamètre: DN{diameter}<br>
    Longueur: {length:.0f} m<br>
    Débit de conception: {q:.3f} L/s<br>
    Vitesse: {velocity:.3f} m/s<br>
    Perte de charge: {hf:.3f} m<br>
    H final: {pressure:.1f} mCE<br>
    Vérif. 18 mCE: {status_18}<br>
    Vérif. 20 mCE: {status_20}<br>
    PRV: {prv}<br>
    Booster: {booster}<br>
    Solution retenue: {solution}
    """


def _make_pipe_coordinates(reservoir, fountains, segments):
    """
    Prefer real segment geometry if available.

    Supported segment geometry formats:
    1. segment["coordinates"] = [[lat, lon], [lat, lon], ...]
    2. start_lat/start_lon/end_lat/end_lon
    3. lat1/lon1/lat2/lon2
    4. from_lat/from_lon/to_lat/to_lon

    Fallback:
    Draw straight lines from reservoir to each selected fountain.
    """
    pipe_lines = []

    if segments:
        for idx, s in enumerate(segments):
            # Case 1: segment already has coordinates in Leaflet format.
            if "coordinates" in s and s["coordinates"]:
                pipe_lines.append({
                    "coords": s["coordinates"],
                    "label": _segment_label(s, idx),
                    "popup": _segment_popup(s, idx),
                    "color": _segment_color(s),
                    "diameter": _infer_pipe_diameter(s),
                })
                continue

            # Case 2: segment has explicit start/end keys.
            possible_keys = [
                ("start_lat", "start_lon", "end_lat", "end_lon"),
                ("lat1", "lon1", "lat2", "lon2"),
                ("from_lat", "from_lon", "to_lat", "to_lon"),
            ]

            found = False

            for slat, slon, elat, elon in possible_keys:
                if all(k in s for k in [slat, slon, elat, elon]):
                    pipe_lines.append({
                        "coords": [
                            [_as_float(s[slat]), _as_float(s[slon])],
                            [_as_float(s[elat]), _as_float(s[elon])],
                        ],
                        "label": _segment_label(s, idx),
                        "popup": _segment_popup(s, idx),
                        "color": _segment_color(s),
                        "diameter": _infer_pipe_diameter(s),
                    })
                    found = True
                    break

            if found:
                continue

            # Case 3: segment is defined by node names RES/BF1/BF2 etc.
            if "from" in s and "to" in s:
                from_node = s["from"]
                to_node = s["to"]

                node_coords = {
                    "RES": (
                        _as_float(reservoir["Lat"]),
                        _as_float(reservoir["Lon"]),
                    )
                }

                for _, f in fountains.iterrows():
                    bf_id = str(f.get("bf_id", ""))
                    node_coords[bf_id] = (
                        _as_float(f["Lat"]),
                        _as_float(f["Lon"]),
                    )

                if from_node in node_coords and to_node in node_coords:
                    pipe_lines.append({
                        "coords": [
                            list(node_coords[from_node]),
                            list(node_coords[to_node]),
                        ],
                        "label": _segment_label(s, idx),
                        "popup": _segment_popup(s, idx),
                        "color": _segment_color(s),
                        "diameter": _infer_pipe_diameter(s),
                    })
                    continue

    # Fallback: direct reservoir → each fountain.
    if not pipe_lines:
        for idx, (_, f) in enumerate(fountains.iterrows()):
            length = haversine_m(
                _as_float(reservoir["Lon"]),
                _as_float(reservoir["Lat"]),
                _as_float(f["Lon"]),
                _as_float(f["Lat"]),
            )

            label = f"Section {idx + 1} · DN40 · {length:.0f} m · tracé direct"

            pipe_lines.append({
                "coords": [
                    [_as_float(reservoir["Lat"]), _as_float(reservoir["Lon"])],
                    [_as_float(f["Lat"]), _as_float(f["Lon"])],
                ],
                "label": label,
                "popup": f"""
                <b>Conduite approximative</b><br>
                Réservoir → {f.get("bf_id", f"BF{idx + 1}")}<br>
                Diamètre: DN40<br>
                Longueur estimée: {length:.0f} m<br>
                Note: tracé direct provisoire
                """,
                "color": "#2c3e50",
                "diameter": 40,
            })

    return pipe_lines


# ---------------------------------------------------------------------
# Main map generator
# ---------------------------------------------------------------------

def generate_solution_map(
    households,
    reservoir,
    fountains,
    solution_summary,
    output_path,
):
    """
    Generate a standalone interactive HTML map.

    Parameters
    ----------
    households : pd.DataFrame
        Household and public-point data, with Lon/Lat/Type columns.

    reservoir : pd.Series
        Reservoir row with Lon/Lat/Altitude.

    fountains : pd.DataFrame
        Selected fountain locations with bf_id/Lon/Lat/Altitude/etc.

    solution_summary : dict
        Lightweight solution dictionary containing:
        - coverage_rate
        - served_population
        - total_population
        - network_length_m
        - n_prv
        - pump
        - costs
        - segments

    output_path : pathlib.Path
        Destination HTML file.
    """

    output_path.parent.mkdir(parents=True, exist_ok=True)

    served_indices = _get_served_household_indices(households, fountains)

    center_lat = _as_float(households["Lat"].mean())
    center_lon = _as_float(households["Lon"].mean())

    household_markers = []
    institution_labels = []

    # -----------------------------------------------------------------
    # Households and institutions
    # -----------------------------------------------------------------

    for idx, row in households.iterrows():
        raw_type = row.get("Type", "Menage")
        kind = _normalize_type(raw_type)
        is_served = idx in served_indices

        color = _type_color(raw_type, is_served=is_served)
        icon = _type_icon(raw_type)
        label = _type_label(raw_type)

        population = _safe(row.get("Nb personnes", "N/A"))
        altitude = _safe(row.get("Altitude", "N/A"))
        demand = _safe(row.get("demand_l_day", "N/A"))

        popup = f"""
        <b>{label}</b><br>
        ID: {idx}<br>
        Population: {population}<br>
        Altitude: {altitude} m NGF<br>
        Demande: {demand} L/jour<br>
        Statut: {"Desservi" if is_served else "Non desservi"}
        """

        radius = 4 if kind == "menage" else 8

        household_markers.append({
            "lat": _as_float(row["Lat"]),
            "lon": _as_float(row["Lon"]),
            "color": color,
            "radius": radius,
            "popup": popup,
            "icon": icon,
            "kind": kind,
            "label": label,
            "served": is_served,
        })

        # Add visible labels only for non-household points.
        if kind != "menage":
            institution_labels.append({
                "lat": _as_float(row["Lat"]),
                "lon": _as_float(row["Lon"]),
                "text": f"{icon} {label}",
                "color": color,
            })

    # -----------------------------------------------------------------
    # Fountains and service zones
    # -----------------------------------------------------------------

    fountain_markers = []
    service_circles = []

    for idx, row in fountains.iterrows():
        bf_id = row.get("bf_id", f"BF{idx + 1}")
        altitude = _safe(row.get("Altitude", "N/A"))
        pop_cov = _safe(row.get("population_covered", "N/A"))
        hh_cov = _safe(row.get("households_covered", "N/A"))
        dist_res = _safe(row.get("dist_res_m", "N/A"))
        gravity = row.get("gravity", "N/A")

        mode = "Gravitaire" if bool(gravity) else "Pompage / relevage"

        popup = f"""
        <b>Borne-fontaine sélectionnée</b><br>
        ID: {bf_id}<br>
        Altitude: {altitude} m NGF<br>
        Ménages couverts: {hh_cov}<br>
        Population couverte: {pop_cov}<br>
        Distance au réservoir: {dist_res} m<br>
        Mode: {mode}
        """

        f_lat = _as_float(row["Lat"])
        f_lon = _as_float(row["Lon"])

        fountain_markers.append({
            "lat": f_lat,
            "lon": f_lon,
            "color": "purple",
            "radius": 12,
            "popup": popup,
            "label": f"{bf_id}<br>{pop_cov} pers.<br>{altitude} m NGF",
        })

        service_circles.append({
            "lat": f_lat,
            "lon": f_lon,
            "radius_m": MAX_WALKING_DISTANCE_M,
            "label": bf_id,
        })

    # -----------------------------------------------------------------
    # Reservoir
    # -----------------------------------------------------------------

    reservoir_marker = {
        "lat": _as_float(reservoir["Lat"]),
        "lon": _as_float(reservoir["Lon"]),
        "color": "black",
        "radius": 13,
        "popup": f"""
        <b>Château d'eau / Réservoir</b><br>
        Altitude sol: {_safe(reservoir.get("Altitude", "N/A"))} m NGF<br>
        Base de cuve: altitude + 5 m
        """,
        "label": f"Réservoir<br>{_safe(reservoir.get('Altitude', 'N/A'))} m NGF",
    }

    # -----------------------------------------------------------------
    # Pipe segments
    # -----------------------------------------------------------------

    segments = solution_summary.get("segments", [])
    pipe_lines = _make_pipe_coordinates(reservoir, fountains, segments)

    # -----------------------------------------------------------------
    # Summary values
    # -----------------------------------------------------------------

    costs = solution_summary.get("costs", {})
    pump = solution_summary.get("pump", {})

    coverage_rate = solution_summary.get("coverage_rate", 0)
    served_population = solution_summary.get("served_population", 0)
    total_population = solution_summary.get("total_population", 0)
    n_fountains = len(fountains)

    pump_households = pump.get("households", "N/A")
    pump_power = pump.get("p_shaft_w", 0)

    network_length = solution_summary.get("network_length_m", 0)
    n_prv = solution_summary.get("n_prv", 0)

    capex = costs.get("capex_total", 0)
    opex = costs.get("opex_total", 0)
    lifecycle = costs.get("lifecycle", 0)
    cost_per_person = costs.get("cost_per_person", 0)

    coverage_pct = 100 * _as_float(coverage_rate)

    # -----------------------------------------------------------------
    # HTML
    # -----------------------------------------------------------------

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Carte interactive AEP — Guinée</title>

    <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />

    <style>
        html, body {{
            height: 100%;
            margin: 0;
            font-family: Arial, sans-serif;
        }}

        #map {{
            height: 100%;
            width: 100%;
        }}

        #summary {{
            position: absolute;
            top: 20px;
            left: 20px;
            z-index: 1000;
            background: white;
            padding: 14px 18px;
            border-radius: 8px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.25);
            max-width: 460px;
            font-size: 14px;
            line-height: 1.35;
        }}

        #summary h2 {{
            margin-top: 0;
            font-size: 18px;
        }}

        .legend-item {{
            margin: 4px 0;
        }}

        .dot {{
            height: 11px;
            width: 11px;
            border-radius: 50%;
            display: inline-block;
            margin-right: 6px;
        }}

        .map-label {{
            background: rgba(255, 255, 255, 0.88);
            border: 1px solid #555;
            border-radius: 4px;
            padding: 2px 5px;
            font-weight: bold;
            font-size: 11px;
            text-align: center;
            white-space: nowrap;
        }}

        .pipe-label {{
            background: rgba(255, 255, 255, 0.90);
            border: 1px solid #2c3e50;
            border-radius: 4px;
            padding: 2px 6px;
            font-size: 11px;
            font-weight: bold;
            color: #2c3e50;
            white-space: nowrap;
        }}

        #controls {{
            margin-top: 10px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
        }}

        button {{
            padding: 6px;
            border: 1px solid #aaa;
            border-radius: 4px;
            background: #f7f7f7;
            cursor: pointer;
            font-size: 12px;
        }}

        button:hover {{
            background: #e8e8e8;
        }}
    </style>
</head>

<body>
    <div id="summary">
        <h2>Solution AEP — Village Guinée</h2>

        <b>Couverture:</b> {coverage_pct:.1f}%<br>
        <b>Population desservie:</b> {float(served_population):.0f} / {float(total_population):.0f}<br>
        <b>Bornes-fontaines:</b> {n_fountains}<br>
        <b>Réseau:</b> {float(network_length):.0f} m · {n_prv} PRV<br>
        <b>Pompe relevage:</b> {pump_households} foyers · {float(pump_power):.0f} W<br>

        <hr>

        <b>CAPEX:</b> {_fmt_eur(capex)}<br>
        <b>OPEX:</b> {_fmt_eur(opex)} / an<br>
        <b>Cycle de vie:</b> {_fmt_eur(lifecycle)}<br>
        <b>Coût par personne:</b> {float(cost_per_person):.0f} €/pers.<br>

        <hr>

        <div class="legend-item"><span class="dot" style="background:purple"></span>Borne-fontaine sélectionnée</div>
        <div class="legend-item"><span class="dot" style="background:green"></span>Ménage desservi</div>
        <div class="legend-item"><span class="dot" style="background:red"></span>Ménage non desservi</div>
        <div class="legend-item"><span class="dot" style="background:black"></span>Château d'eau</div>
        <div class="legend-item"><span class="dot" style="background:#34495e"></span>École / service public</div>
        <div class="legend-item"><span class="dot" style="background:#8e44ad"></span>Mosquée</div>
        <div class="legend-item"><span class="dot" style="background:#e74c3c"></span>Hôpital / santé</div>
        <div class="legend-item"><span class="dot" style="background:#c0392b"></span>Puits</div>
        <div class="legend-item"><span class="dot" style="background:#2980b9"></span>DN renforcé</div>
        <div class="legend-item"><span class="dot" style="background:#e74c3c"></span>Booster requis</div>

        <div id="controls">
            <button onclick="toggleLayer('served')">Ménages desservis</button>
            <button onclick="toggleLayer('unserved')">Non desservis</button>
            <button onclick="toggleLayer('fountains')">Bornes</button>
            <button onclick="toggleLayer('pipes')">Conduites</button>
            <button onclick="toggleLayer('zones')">Zones 500 m</button>
            <button onclick="toggleLayer('labels')">Étiquettes</button>
        </div>
    </div>

    <div id="map"></div>

    <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

    <script>
        const map = L.map("map").setView([{center_lat}, {center_lon}], 14);

        L.tileLayer("https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png", {{
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors"
        }}).addTo(map);

        const householdMarkers = {json.dumps(household_markers)};
        const fountainMarkers = {json.dumps(fountain_markers)};
        const reservoirMarker = {json.dumps(reservoir_marker)};
        const serviceCircles = {json.dumps(service_circles)};
        const pipeLines = {json.dumps(pipe_lines)};
        const institutionLabels = {json.dumps(institution_labels)};

        const layers = {{
            served: L.featureGroup(),
            unserved: L.featureGroup(),
            fountains: L.featureGroup(),
            pipes: L.featureGroup(),
            zones: L.featureGroup(),
            labels: L.featureGroup(),
            reservoir: L.featureGroup()
        }};

        function makeDivIcon(text, className = "map-label") {{
            return L.divIcon({{
                html: `<div class="${{className}}">${{text}}</div>`,
                className: "",
                iconSize: null
            }});
        }}

        householdMarkers.forEach((m) => {{
            const marker = L.circleMarker([m.lat, m.lon], {{
                radius: m.radius,
                color: m.color,
                fillColor: m.color,
                fillOpacity: 0.85,
                weight: 2
            }}).bindPopup(m.popup);

            if (m.served) {{
                marker.addTo(layers.served);
            }} else {{
                marker.addTo(layers.unserved);
            }}
        }});

        fountainMarkers.forEach((m) => {{
            L.circleMarker([m.lat, m.lon], {{
                radius: m.radius,
                color: "purple",
                fillColor: "purple",
                fillOpacity: 0.85,
                weight: 3
            }}).bindPopup(m.popup).addTo(layers.fountains);

            L.marker([m.lat, m.lon], {{
                icon: makeDivIcon(m.label)
            }}).addTo(layers.labels);
        }});

        L.circleMarker([reservoirMarker.lat, reservoirMarker.lon], {{
            radius: reservoirMarker.radius,
            color: "black",
            fillColor: "black",
            fillOpacity: 0.85,
            weight: 3
        }}).bindPopup(reservoirMarker.popup).addTo(layers.reservoir);

        L.marker([reservoirMarker.lat, reservoirMarker.lon], {{
            icon: makeDivIcon(reservoirMarker.label)
        }}).addTo(layers.labels);

        serviceCircles.forEach((c) => {{
            L.circle([c.lat, c.lon], {{
                radius: c.radius_m,
                color: "purple",
                fillColor: "purple",
                fillOpacity: 0.08,
                weight: 1,
                opacity: 0.35
            }}).bindPopup(`${{c.label}} — rayon de service 500 m`).addTo(layers.zones);
        }});

        pipeLines.forEach((p) => {{
            const weight = Number(p.diameter) >= 50 ? 4 : 3;

            const line = L.polyline(p.coords, {{
                color: p.color,
                weight: weight,
                opacity: 0.88
            }}).bindPopup(p.popup);

            line.addTo(layers.pipes);

            const mid = p.coords[Math.floor(p.coords.length / 2)];

            L.marker(mid, {{
                icon: makeDivIcon(p.label, "pipe-label")
            }}).addTo(layers.labels);
        }});

        institutionLabels.forEach((l) => {{
            L.marker([l.lat, l.lon], {{
                icon: makeDivIcon(l.text)
            }}).addTo(layers.labels);
        }});

        Object.values(layers).forEach((layer) => layer.addTo(map));

        const allVisible = L.featureGroup([
            layers.served,
            layers.unserved,
            layers.fountains,
            layers.pipes,
            layers.reservoir
        ]);

        try {{
            map.fitBounds(allVisible.getBounds(), {{ padding: [40, 40] }});
        }} catch (e) {{
            console.warn("Could not fit bounds", e);
        }}

        function toggleLayer(name) {{
            if (map.hasLayer(layers[name])) {{
                map.removeLayer(layers[name]);
            }} else {{
                map.addLayer(layers[name]);
            }}
        }}
    </script>
</body>
</html>
"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)

    return output_path
