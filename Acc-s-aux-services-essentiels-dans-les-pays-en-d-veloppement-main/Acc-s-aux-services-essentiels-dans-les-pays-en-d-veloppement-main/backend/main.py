"""
End-to-end AEP solver — reproduces Solution_AEP_Guinee_Final.xlsx from raw data.

Pipeline:
    raw GPS data
      -> greedy 500 m coverage          (geo_analysis)
      -> design flows + Hazen-Williams   (hydraulics)
      -> relevage pump                   (hydraulics)
      -> CAPEX / OPEX / lifecycle        (cost_analysis)
      -> constraint check                (constraints)
      -> formatted 4-sheet workbook      (excel_report)

Run:
    cd backend
    python3 main.py
"""
import json

from config import (
    N_FOUNTAINS, MAX_WALKING_DISTANCE_M, DESIGN_LPCD, RESULTS_DIR,
    RESERVOIR_HYDRAULIC_LEVEL_M,
)
from geo_analysis import (
    load_village_data, get_households, get_reservoir, greedy_select_fountains,
)

from hydraulics import build_network, sizing_pump
from cost_analysis import estimate_costs
from constraints import summarize_constraints
from excel_report import build_workbook
from utils import haversine_m
from map_generation import generate_solution_map

def solve():
    village = load_village_data()
    households = get_households(village)
    reservoir = get_reservoir(village)

    total_population = float(households["Nb personnes"].fillna(0).sum())

    # 1) coverage
    fountains = greedy_select_fountains(households, N_FOUNTAINS, MAX_WALKING_DISTANCE_M)
    fountains["dist_res_m"] = [
        haversine_m(reservoir["Lon"], reservoir["Lat"], f.Lon, f.Lat)
        for f in fountains.itertuples()
    ]
    fountains["gravity"] = fountains["Altitude"] < RESERVOIR_HYDRAULIC_LEVEL_M
    served_population = float(fountains["population_covered"].sum())

    # 2) hydraulics
    segments = build_network(reservoir, fountains)
    network_length_m = sum(s["length_m"] for s in segments)
    n_prv = sum(1 for s in segments if s["prv_needed"])

    # 3) pump
    pump = sizing_pump(households)

    # 4) costs
    costs = estimate_costs(network_length_m, n_prv, served_population)

    solution = {
        "households": households,
        "reservoir": reservoir,
        "total_population": total_population,
        "served_population": served_population,
        "coverage_rate": served_population / total_population,
        "design_lpcd": DESIGN_LPCD,
        "fountains": fountains,
        "segments": segments,
        "network_length_m": network_length_m,
        "n_prv": n_prv,
        "pump": pump,
        "costs": costs,
    }
    solution["constraints"] = summarize_constraints(solution)
    return solution


def print_summary(s):
    c, cons = s["costs"], s["constraints"]
    print("=" * 64)
    print("SOLUTION AEP — Village rural Guinée")
    print("=" * 64)
    print(f"Population        : {s['total_population']:.0f} hab. "
          f"({len(s['households'])} ménages)")
    print(f"Couverture (5 BF) : {s['coverage_rate']*100:.1f} %  "
          f"({s['served_population']:.0f} pers. desservies)")
    print("\nBornes-fontaines (greedy 500 m) :")
    for _, f in s["fountains"].iterrows():
        print(f"  {f['bf_id']}: {f['households_covered']:>3d} ménages · "
              f"{f['population_covered']:>4.0f} pers · alt {f['Altitude']:.0f} m · "
              f"{f['dist_res_m']:.0f} m du réservoir")
    print(f"\nRéseau            : {s['network_length_m']:.0f} m · {s['n_prv']} PRV")
    print(f"Pompe relevage    : {s['pump']['households']} foyers > 373 m · "
          f"{s['pump']['p_shaft_w']:.0f} W")
    print(f"CAPEX             : {c['capex_total']:,.0f} €  "
          f"({'OK' if cons['budget_ok'] else 'DÉPASSÉ'} — "
          f"marge {cons['budget_margin_eur']:,.0f} €)".replace(",", " "))
    print(f"OPEX              : {c['opex_total']:,.0f} €/an".replace(",", " "))
    print(f"Cycle de vie 20 a : {c['lifecycle']:,.0f} €  "
          f"({c['cost_per_person']:.0f} €/pers.)".replace(",", " "))
    print("=" * 64)


def main():
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    solution = solve()
    print_summary(solution)

    # machine-readable summary (without the DataFrames)
    light = {k: v for k, v in solution.items()
             if k not in ("households", "reservoir", "fountains")}
    light["fountains"] = solution["fountains"].to_dict(orient="records")

    with open(RESULTS_DIR / "solution_summary.json", "w", encoding="utf-8") as fh:
        json.dump(light, fh, indent=2, ensure_ascii=False, default=str)

    out = build_workbook(solution)
    print(f"\nWorkbook généré : {out}")

    map_path = generate_solution_map(
        households=solution["households"],
        reservoir=solution["reservoir"],
        fountains=solution["fountains"],
        solution_summary=light,
        output_path=RESULTS_DIR / "solution_map.html",
    )

    print(f"Carte interactive générée : {map_path}")


if __name__ == "__main__":
    main()
