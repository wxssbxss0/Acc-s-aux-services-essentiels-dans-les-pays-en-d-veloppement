import pandas as pd

from config import (
    COST_XLSX,
    CONTINGENCY_RATE,
    PROJECT_LIFETIME_YEARS,
)


def load_cost_glossary(path=COST_XLSX):
    """
    Reads the Glossaire_Prix sheet from the hydraulic/cost workbook.
    """
    df = pd.read_excel(path, sheet_name="Glossaire_Prix", header=2)
    df.columns = [str(c).strip() for c in df.columns]
    return df


def get_average_price(cost_df, keyword, default_value):
    """
    Searches the price glossary for a keyword and returns the average price.
    Falls back to default_value if not found.
    """
    matches = cost_df[
        cost_df["Item / Description"]
        .astype(str)
        .str.contains(keyword, case=False, na=False)
    ]

    if matches.empty:
        return default_value

    values = pd.to_numeric(matches["Prix moyen (€)"], errors="coerce").dropna()

    if values.empty:
        return default_value

    return float(values.iloc[0])


def estimate_capex(
    n_fountains,
    pipe_length_m,
    n_pumps,
    cost_df,
):
    """
    Simplified CAPEX estimate.
    Later this can become more detailed with pipe diameters and installation types.
    """

    pipe_cost_per_m = get_average_price(
        cost_df,
        keyword="HDPE DN50 posé",
        default_value=18.0,
    )

    fountain_cost = get_average_price(
        cost_df,
        keyword="borne",
        default_value=2500.0,
    )

    pump_cost = get_average_price(
        cost_df,
        keyword="pompe",
        default_value=3000.0,
    )

    pipe_cost = pipe_length_m * pipe_cost_per_m
    fountains_cost = n_fountains * fountain_cost
    pumps_cost = n_pumps * pump_cost

    capex = pipe_cost + fountains_cost + pumps_cost

    return {
        "pipe_cost_eur": pipe_cost,
        "fountains_cost_eur": fountains_cost,
        "pumps_cost_eur": pumps_cost,
        "capex_eur": capex,
    }


def estimate_annual_opex(n_fountains, n_pumps):
    """
    First rough OPEX model.
    You can replace these numbers with better values from the professor/data.
    """
    maintenance_per_fountain_per_year = 150
    maintenance_per_pump_per_year = 300
    electricity_per_pump_per_year = 250
    worker_salary_per_year = 1200

    opex = (
        n_fountains * maintenance_per_fountain_per_year
        + n_pumps * (maintenance_per_pump_per_year + electricity_per_pump_per_year)
        + worker_salary_per_year
    )

    return opex


def estimate_lifecycle_cost(capex, annual_opex, renewals=0):
    contingency = CONTINGENCY_RATE * capex

    lifecycle_cost = (
        capex
        + contingency
        + PROJECT_LIFETIME_YEARS * annual_opex
        + renewals
    )

    return {
        "capex_eur": capex,
        "contingency_eur": contingency,
        "annual_opex_eur": annual_opex,
        "twenty_year_opex_eur": PROJECT_LIFETIME_YEARS * annual_opex,
        "renewals_eur": renewals,
        "lifecycle_cost_eur": lifecycle_cost,
    }
