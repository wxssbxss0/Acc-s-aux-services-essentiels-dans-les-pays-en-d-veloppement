from config import (
    MAX_BUDGET_EUR,
    TARGET_BUDGET_EUR,
    MAX_DAILY_WATER_L,
    MAX_WALKING_DISTANCE_M,
)


def check_budget_constraint(lifecycle_cost):
    return lifecycle_cost <= MAX_BUDGET_EUR


def check_target_budget_buffer(lifecycle_cost):
    return lifecycle_cost <= TARGET_BUDGET_EUR


def check_water_constraint(total_served_demand_l_day):
    return total_served_demand_l_day <= MAX_DAILY_WATER_L


def check_access_constraint(distance_m):
    return distance_m <= MAX_WALKING_DISTANCE_M


def summarize_constraints(solution):
    return {
        "budget_ok": check_budget_constraint(solution["lifecycle_cost_eur"]),
        "target_buffer_ok": check_target_budget_buffer(solution["lifecycle_cost_eur"]),
        "water_limit_ok": check_water_constraint(solution["served_demand_l_day"]),
        "coverage_rate": solution["served_population"] / solution["total_population"],
    }
