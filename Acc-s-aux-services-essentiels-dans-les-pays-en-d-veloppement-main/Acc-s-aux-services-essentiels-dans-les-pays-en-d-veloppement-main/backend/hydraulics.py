"""Hydraulic design: design flows, Ha`:wqzen-Williams pipe sizing, relevage pump."""
import math
from config import (
    DESIGN_LPCD, PEAK_HOUR_FACTOR, DISTRIBUTION_HOURS,
    HW_C, COMMERCIAL_DN_MM, MAX_VELOCITY_MS,
    RESERVOIR_HYDRAULIC_LEVEL_M, MIN_PRESSURE_M, PRV_PRESSURE_M,
    PUMP_LIFT_M, PUMP_LOSSES_M, PUMP_HOURS, PUMP_EFFICIENCY, RHO, G,
    MIN_FOUNTAIN_FLOW_LPS, MIN_SERVICE_PRESSURE_M, TARGET_SERVICE_PRESSURE_M,
    PIPE_COST_EUR_PER_M, BOOSTER_PUMP_EUR,
)
from utils import haversine_m


# ----- Flows -------------------------------------------------------------
def design_flow_components(population):
    """
    Returns demand-based flow and minimum fountain-service flow.

    We size the fountain using the stricter of:
    1. demand during peak operating hours
    2. minimum practical flow from the public taps
    """
    daily_l = population * DESIGN_LPCD

    q_avg_lps = daily_l / 86400.0
    q_distribution_lps = daily_l / (DISTRIBUTION_HOURS * 3600.0)
    q_peak_lps = q_distribution_lps * PEAK_HOUR_FACTOR

    # Minimum usable flow from the public fountain taps
    q_tap_lps = MIN_FOUNTAIN_FLOW_LPS

    q_design_lps = max(q_peak_lps, q_tap_lps)

    return {
        "daily_l": daily_l,
        "q_avg_lps": q_avg_lps,
        "q_distribution_lps": q_distribution_lps,
        "q_peak_lps": q_peak_lps,
        "q_tap_lps": q_tap_lps,
        "q_design_lps": q_design_lps,
    }


def design_flow_lps(population):
    return design_flow_components(population)["q_design_lps"]


# ----- Hazen-Williams ----------------------------------------------------
def hazen_williams_hf(length_m, q_lps, dn_mm, c=HW_C):
    """Head loss hf (m): hf = 10.67 L Q^1.852 / (C^1.852 D^4.87)."""
    if q_lps <= 0:
        return 0.0
    q, d = q_lps / 1000.0, dn_mm / 1000.0
    return 10.67 * length_m * q ** 1.852 / (c ** 1.852 * d ** 4.87)


def velocity_ms(q_lps, dn_mm):
    area = math.pi / 4 * (dn_mm / 1000.0) ** 2
    return (q_lps / 1000.0) / area if area else 0.0


def pick_diameter(q_lps):
    """Smallest commercial DN keeping velocity <= MAX_VELOCITY_MS."""
    for dn in COMMERCIAL_DN_MM:
        if velocity_ms(q_lps, dn) <= MAX_VELOCITY_MS:
            return dn
    return COMMERCIAL_DN_MM[-1]

def classify_pressure(h_final_m):
    if h_final_m >= TARGET_SERVICE_PRESSURE_M:
        return "PASS_20"
    if h_final_m >= MIN_SERVICE_PRESSURE_M:
        return "PASS_18_MARGINAL"
    return "FAIL"

def apply_hydraulic_corrections(segments, nodes):
    """
    Applies the corrected recommended configuration:
    - Try larger diameter where friction losses are the problem.
    - Add booster pump where static head is insufficient.
    """

    corrective_items = []

    for s in segments:
        bf = s["to"]
        if not str(bf).startswith("BF"):
            continue

        altitude = nodes[bf][2]
        static_head = RESERVOIR_HYDRAULIC_LEVEL_M - altitude

        h_final = s["pressure_m"]
        s["h_final_m"] = h_final
        s["pressure_status"] = classify_pressure(h_final)
        s["solution_retained"] = "Gravité pure"
        s["booster_required"] = False
        s["booster_head_m"] = 0.0
        s["corrective_cost_eur"] = 0

        if h_final >= TARGET_SERVICE_PRESSURE_M:
            continue

        # If static head itself is below 18, diameter cannot solve it.
        # Need a booster pump.
        if static_head < MIN_SERVICE_PRESSURE_M:
            booster_head = TARGET_SERVICE_PRESSURE_M - h_final
            s["solution_retained"] = "Gravité + pompe booster"
            s["booster_required"] = True
            s["booster_head_m"] = booster_head
            s["dn_mm"] = max(s["dn_mm"], 50)
            s["corrective_cost_eur"] = BOOSTER_PUMP_EUR

            corrective_items.append({
                "bf": bf,
                "solution": "Gravité + pompe booster",
                "diameter": f"DN{s['dn_mm']}",
                "h_final_m": TARGET_SERVICE_PRESSURE_M,
                "status_18": "PASS",
                "status_20": "PASS",
                "cost_eur": BOOSTER_PUMP_EUR,
                "justification": f"Charge statique {static_head:.1f} mCE insuffisante — pompe requise",
            })
            continue

        # Otherwise, try increasing diameter to reduce friction losses.
        upgraded = False
        for dn in COMMERCIAL_DN_MM:
            if dn <= s["dn_mm"]:
                continue

            hf_new = hazen_williams_hf(s["length_m"], s["q_lps"], dn)
            h_new = static_head - hf_new

            if h_new >= MIN_SERVICE_PRESSURE_M:
                old_dn = s["dn_mm"]
                s["dn_mm"] = dn
                s["hf_m"] = hf_new
                s["velocity_ms"] = velocity_ms(s["q_lps"], dn)
                s["pressure_m"] = h_new
                s["h_final_m"] = h_new
                s["pressure_status"] = classify_pressure(h_new)
                s["solution_retained"] = "Gravité + diamètre"

                extra = round(
                    s["length_m"] *
                    (PIPE_COST_EUR_PER_M[dn] - PIPE_COST_EUR_PER_M.get(old_dn, PIPE_COST_EUR_PER_M[40]))
                )
                s["corrective_cost_eur"] = extra

                corrective_items.append({
                    "bf": bf,
                    "solution": "Gravité + diamètre",
                    "diameter": f"DN{dn}",
                    "h_final_m": h_new,
                    "status_18": "PASS",
                    "status_20": "PASS" if h_new >= TARGET_SERVICE_PRESSURE_M else "MARGINAL",
                    "cost_eur": extra,
                    "justification": f"DN{old_dn} → DN{dn} pour atteindre {h_new:.1f} mCE",
                })
                upgraded = True
                break

        if not upgraded and s["pressure_m"] < MIN_SERVICE_PRESSURE_M:
            booster_head = TARGET_SERVICE_PRESSURE_M - s["pressure_m"]
            s["solution_retained"] = "Gravité + pompe booster"
            s["booster_required"] = True
            s["booster_head_m"] = booster_head
            s["corrective_cost_eur"] = BOOSTER_PUMP_EUR

            corrective_items.append({
                "bf": bf,
                "solution": "Gravité + pompe booster",
                "diameter": f"DN{s['dn_mm']}",
                "h_final_m": TARGET_SERVICE_PRESSURE_M,
                "status_18": "PASS",
                "status_20": "PASS",
                "cost_eur": BOOSTER_PUMP_EUR,
                "justification": "Diamètre insuffisant pour garantir 18–20 mCE — booster requis",
            })

    return segments, corrective_items


# ----- Network -----------------------------------------------------------
# Branch topology rooted at the reservoir (RES), as documented in the dossier:
# BF5 feeds BF1 (both centre-south); the others are direct antennas.
NETWORK_EDGES = [("RES", "BF2"), ("RES", "BF3"), ("RES", "BF4"),
                 ("RES", "BF5"), ("BF5", "BF1")]


def build_network(reservoir, fountains):
    """
    fountains: DataFrame ordered BF1..BFn with Lon/Lat/Altitude/population_covered.
    Returns a list of segment dicts (length, Q, DN, velocity, hf, pressure, PRV).
    """
    nodes = {"RES": (float(reservoir["Lon"]), float(reservoir["Lat"]),
                     RESERVOIR_HYDRAULIC_LEVEL_M)}
    bf_pop = {}
    for _, f in fountains.iterrows():
        nodes[f["bf_id"]] = (f["Lon"], f["Lat"], f["Altitude"])
        bf_pop[f["bf_id"]] = f["population_covered"]

    children = {}
    for u, v in NETWORK_EDGES:
        children.setdefault(u, []).append(v)

    def subtree_bfs(node):
        out, stack = [], [node]
        while stack:
            cur = stack.pop()
            if cur.startswith("BF"):
                out.append(cur)
            stack.extend(children.get(cur, []))
        return out

    segments = []
    for u, v in NETWORK_EDGES:
        length = haversine_m(nodes[u][0], nodes[u][1], nodes[v][0], nodes[v][1])
        pop_down = sum(bf_pop[b] for b in subtree_bfs(v))
        q = design_flow_lps(pop_down)
        dn = pick_diameter(q)
        segments.append({
            "from": u, "to": v, "length_m": length, "q_lps": q,
            "dn_mm": dn, "velocity_ms": velocity_ms(q, dn),
            "hf_m": hazen_williams_hf(length, q, dn),
        })

    # residual pressure at each BF = head(373) - alt(BF) - sum(hf on path)
    parent = {v: u for u, v in NETWORK_EDGES}
    seg_hf = {(s["from"], s["to"]): s["hf_m"] for s in segments}

    def path_hf(bf):
        total, cur = 0.0, bf
        while cur in parent:
            total += seg_hf[(parent[cur], cur)]
            cur = parent[cur]
        return total

    for s in segments:
        bf = s["to"]
        s["pressure_m"] = RESERVOIR_HYDRAULIC_LEVEL_M - nodes[bf][2] - path_hf(bf)
        s["prv_needed"] = s["pressure_m"] > PRV_PRESSURE_M
    
    segments, corrective_items = apply_hydraulic_corrections(segments, nodes)
    return segments, corrective_items


# ----- Relevage pump -----------------------------------------------------
def sizing_pump(households):
    """Size the small solar pump for households above the tank outlet (373 m)."""
    high = households[households["Altitude"] > RESERVOIR_HYDRAULIC_LEVEL_M]
    pop = float(high["Nb personnes"].fillna(0).sum())
    daily_l = pop * DESIGN_LPCD
    hm = PUMP_LIFT_M + MIN_PRESSURE_M + PUMP_LOSSES_M
    q_lps = daily_l / (PUMP_HOURS * 3600.0) if PUMP_HOURS else 0.0
    p_hyd = RHO * G * (q_lps / 1000.0) * hm
    return {
        "households": int(len(high)), "population": pop, "daily_l": daily_l,
        "hm_m": hm, "q_lps": q_lps, "p_hyd_w": p_hyd,
        "p_shaft_w": p_hyd / PUMP_EFFICIENCY if PUMP_EFFICIENCY else 0.0,
    }
