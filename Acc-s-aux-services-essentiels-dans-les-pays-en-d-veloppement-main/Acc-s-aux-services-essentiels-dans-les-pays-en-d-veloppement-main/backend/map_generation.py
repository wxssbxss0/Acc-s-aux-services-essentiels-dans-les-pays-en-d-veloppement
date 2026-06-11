"""
Generate standalone Leaflet HTML maps for the AEP solution.
"""

import json

from config import MAX_WALKING_DISTANCE_M
from utils import haversine_m


def _as_float(value, default=0.0):
    try:
        return float(value)
    except Exception:
        return default


def _fmt_eur(value):
    try:
        return f"{float(value):,.0f} €".replace(",", " ")
    except Exception:
        return "N/A"


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
                h_lon, h_lat,
                _as_float(f["Lon"]), _as_float(f["Lat"])
            )

            if d <= MAX_WALKING_DISTANCE_M:
                served.add(h_idx)
                break

    return served


def generate_solution_map(
    households,
    reservoir,
    fountains,
    solution_summary,
    output_path,
):
    """
    Generate a standalone HTML map.

    Inputs:
    - households: DataFrame with Lon, Lat, Altitude, Nb personnes, etc.
    - reservoir: Series with Lon, Lat, Altitude
    - fountains: DataFrame with selected fountain locations
    - solution_summary: lightweight solution dictionary
    - output_path: results/solution_map.html
    """

    output_path.parent.mkdir(parents=True, exist_ok=True)

    served_indices = _get_served_household_indices(households, fountains)

    center_lat = _as_float(households["Lat"].mean())
    center_lon = _as_float(households["Lon"].mean())

    markers = []

    # Households
    for idx, row in households.iterrows():
        is_served = idx in served_indices
        color = "green" if is_served else "red"

        population = row.get("Nb personnes", "N/A")
        altitude = row.get("Altitude", "N/A")

        demand = row.get("demand_l_day", None)
        if demand is None:
            # fallback if demand column has another name or is absent
            demand = "N/A"

        popup = f"""
        <b>Ménage</b><br>
        ID: {idx}<br>
        Population: {population}<br>
        Altitude: {altitude} m<br>
        Demand: {demand} L/jour<br>
        Status: {"Desservi" if is_served else "Non desservi"}
        """

        markers.append({
            "lat": _as_float(row["Lat"]),
            "lon": _as_float(row["Lon"]),
            "color": color,
            "radius": 5,
            "popup": popup,
        })

    # Selected fountains
    for idx, row in fountains.iterrows():
        bf_id = row.get("bf_id", f"BF_{idx}")
        altitude = row.get("Altitude", "N/A")
        pop_cov = row.get("population_covered", "N/A")
        hh_cov = row.get("households_covered", "N/A")
        dist_res = row.get("dist_res_m", "N/A")
        gravity = row.get("gravity", "N/A")

        popup = f"""
        <b>Borne-fontaine sélectionnée</b><br>
        ID: {bf_id}<br>
        Altitude: {altitude} m<br>
        Ménages couverts: {hh_cov}<br>
        Population couverte: {pop_cov}<br>
        Distance au réservoir: {dist_res} m<br>
        Gravitaire: {gravity}
        """

        markers.append({
            "lat": _as_float(row["Lat"]),
            "lon": _as_float(row["Lon"]),
            "color": "purple",
            "radius": 11,
            "popup": popup,
        })

    # Reservoir / château d'eau
    markers.append({
        "lat": _as_float(reservoir["Lat"]),
        "lon": _as_float(reservoir["Lon"]),
        "color": "black",
        "radius": 13,
        "popup": f"""
        <b>Château d'eau</b><br>
        Altitude: {reservoir.get("Altitude", "N/A")} m
        """,
    })

    costs = solution_summary.get("costs", {})

    coverage_rate = solution_summary.get("coverage_rate", 0)
    served_population = solution_summary.get("served_population", "N/A")
    total_population = solution_summary.get("total_population", "N/A")
    n_fountains = len(fountains)

    pump = solution_summary.get("pump", {})
    pump_households = pump.get("households", "N/A")
    pump_power = pump.get("p_shaft_w", "N/A")

    network_length = solution_summary.get("network_length_m", "N/A")
    n_prv = solution_summary.get("n_prv", "N/A")

    capex = costs.get("capex_total", "N/A")
    opex = costs.get("opex_total", "N/A")
    lifecycle = costs.get("lifecycle", "N/A")
    cost_per_person = costs.get("cost_per_person", "N/A")

    coverage_pct = 100 * _as_float(coverage_rate)

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Carte solution AEP — Guinée</title>

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
            max-width: 390px;
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
    </style>
</head>

<body>
    <div id="summary">
        <h2>Solution AEP — Village Guinée</h2>

        <b>Couverture:</b> {coverage_pct:.1f}%<br>
        <b>Population desservie:</b> {served_population:.0f} / {total_population:.0f}<br>
        <b>Bornes-fontaines:</b> {n_fountains}<br>
        <b>Réseau:</b> {network_length:.0f} m · {n_prv} PRV<br>
        <b>Pompe relevage:</b> {pump_households} foyers · {pump_power:.0f} W<br>

        <hr>

        <b>CAPEX:</b> {_fmt_eur(capex)}<br>
        <b>OPEX:</b> {_fmt_eur(opex)} / an<br>
        <b>Cycle de vie:</b> {_fmt_eur(lifecycle)}<br>
        <b>Coût par personne:</b> {cost_per_person:.0f} €/pers.<br>

        <hr>

        <div class="legend-item"><span class="dot" style="background:purple"></span>Borne-fontaine sélectionnée</div>
        <div class="legend-item"><span class="dot" style="background:green"></span>Ménage desservi</div>
        <div class="legend-item"><span class="dot" style="background:red"></span>Ménage non desservi</div>
        <div class="legend-item"><span class="dot" style="background:black"></span>Château d'eau</div>
    </div>

    <div id="map"></div>

    <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

    <script>
        const map = L.map("map").setView([{center_lat}, {center_lon}], 14);

        L.tileLayer("https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png", {{
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors"
        }}).addTo(map);

        const markers = {json.dumps(markers)};

        const markerLayer = L.featureGroup();

        markers.forEach((m) => {{
            const marker = L.circleMarker([m.lat, m.lon], {{
                radius: m.radius,
                color: m.color,
                fillColor: m.color,
                fillOpacity: 0.82,
                weight: 2
            }}).bindPopup(m.popup);

            marker.addTo(markerLayer);
        }});

        markerLayer.addTo(map);
        map.fitBounds(markerLayer.getBounds(), {{ padding: [40, 40] }});
    </script>
</body>
</html>
"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)

    return output_path
