import json
import pandas as pd

from config import CLEAN_DATA_DIR, RESULTS_DIR, MAX_WALKING_DISTANCE_M
from geo_analysis import (
    load_village_data,
    get_households,
    get_candidate_locations,
    compute_distance_matrix,
    export_geojson,
)
from cost_analysis import (
    load_cost_glossary,
    estimate_capex,
    estimate_annual_opex,
    estimate_lifecycle_cost,
)
from constraints import summarize_constraints


def evaluate_simple_solution(n_fountains=5):
    """
    First skeleton solution:
    - load village data
    - create candidate locations
    - pick a small number of candidate fountains
    - estimate coverage based on 500 m access
    - estimate rough costs
    - check constraints
    """

    village_df = load_village_data()
    cost_df = load_cost_glossary()

    households = get_households(village_df)
    candidates = get_candidate_locations(village_df)

    # For now, choose the first n candidates.
    # Later replace this with optimization/greedy clustering.
    selected = candidates.head(n_fountains).copy()

    distance_matrix = compute_distance_matrix(households, selected)

    served_household_indices = (
        distance_matrix[
            distance_matrix["distance_m"] <= MAX_WALKING_DISTANCE_M
        ]["household_index"]
        .unique()
        .tolist()
    )

    served_households = households.loc[served_household_indices].copy()

    total_population = households["Nb personnes"].sum()
    served_population = served_households["Nb personnes"].sum()

    total_demand = households["demand_l_day"].sum()
    served_demand = served_households["demand_l_day"].sum()

    # Approximate pipe length:
    # first version = sum of distance from selected fountains to reservoir or simple estimate.
    # Replace this later with actual network geometry.
    approximate_pipe_length_m = 1000 * n_fountains

    # Pump count:
    # selected fountains needing pump based on altitude/hydraulic constraint
    n_pumps = int((selected["Altitude"] > 368).sum())

    capex_details = estimate_capex(
        n_fountains=n_fountains,
        pipe_length_m=approximate_pipe_length_m,
        n_pumps=n_pumps,
        cost_df=cost_df,
    )

    annual_opex = estimate_annual_opex(
        n_fountains=n_fountains,
        n_pumps=n_pumps,
    )

    lcc_details = estimate_lifecycle_cost(
        capex=capex_details["capex_eur"],
        annual_opex=annual_opex,
        renewals=n_pumps * 1500,
    )

    solution = {
        "n_fountains": n_fountains,
        "n_pumps": n_pumps,
        "total_population": int(total_population),
        "served_population": int(served_population),
        "coverage_rate": float(served_population / total_population),
        "total_demand_l_day": float(total_demand),
        "served_demand_l_day": float(served_demand),
        "pipe_length_m_estimate": float(approximate_pipe_length_m),
        **capex_details,
        **lcc_details,
    }

    solution["constraints"] = summarize_constraints(solution)

    return solution, village_df, selected, served_households


def main():
    CLEAN_DATA_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    solution, village_df, selected, served_households = evaluate_simple_solution(
        n_fountains=5
    )

    # Export GeoJSON for frontend
    geojson_path = export_geojson(village_df)

    # Export selected fountains
    selected.to_csv(RESULTS_DIR / "selected_fountains.csv", index=False)

    # Export served households
    served_households.to_csv(RESULTS_DIR / "served_households.csv", index=False)

    # Export solution summary
    with open(RESULTS_DIR / "solution_summary.json", "w", encoding="utf-8") as f:
        json.dump(solution, f, indent=2, ensure_ascii=False)

    print("Analysis complete.")
    print(f"GeoJSON exported to: {geojson_path}")
    print(json.dumps(solution, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
