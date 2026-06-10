"""Hydraulic design: design flows, Hazen-Williams pipe sizing, relevage pump."""
import math

from config import (
    DESIGN_LPCD, PEAK_HOUR_FACTOR, DISTRIBUTION_HOURS,
    HW_C, COMMERCIAL_DN_MM, MAX_VELOCITY_MS,
    RESERVOIR_HYDRAULIC_LEVEL_M, MIN_PRESSURE_M, PRV_PRESSURE_M,
    PUMP_LIFT_M, PUMP_LOSSES_M, PUMP_HOURS, PUMP_EFFICIENCY, RHO, G,
)
from utils import haversine_m


# ----- Flows -------------------------------------------------------------
def design_flow_lps(population):
    """Peak design flow (L/s): dotation 20 L/p/j over 12 h with PHF = 2."""
    daily_l = population * DESIGN_LPCD
    return daily_l / (DISTRIBUTION_HOURS * 3600.0) * PEAK_HOUR_FACTOR


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

    return segments


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
