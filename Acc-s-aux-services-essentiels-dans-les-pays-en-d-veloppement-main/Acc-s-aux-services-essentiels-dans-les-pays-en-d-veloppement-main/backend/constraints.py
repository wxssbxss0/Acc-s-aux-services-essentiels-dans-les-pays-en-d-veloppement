"""Check the solution against the project constraints (énoncé)."""
from config import MAX_BUDGET_EUR, TARGET_BUDGET_EUR, MAX_DAILY_WATER_L


def summarize_constraints(solution):
    capex = solution["costs"]["capex_total"]
    design_demand_l = solution["served_population"] * solution["design_lpcd"]
    return {
        "budget_ok": capex <= MAX_BUDGET_EUR,
        "target_buffer_ok": capex <= TARGET_BUDGET_EUR,
        "budget_margin_eur": MAX_BUDGET_EUR - capex,
        "water_limit_ok": design_demand_l <= MAX_DAILY_WATER_L,
        "design_demand_l_day": design_demand_l,
        "coverage_rate": solution["coverage_rate"],
    }
