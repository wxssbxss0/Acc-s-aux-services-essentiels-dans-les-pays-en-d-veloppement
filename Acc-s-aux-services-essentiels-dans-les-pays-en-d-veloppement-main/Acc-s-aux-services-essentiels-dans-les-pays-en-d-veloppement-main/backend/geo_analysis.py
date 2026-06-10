"""Geospatial layer: load village points, run the greedy coverage algorithm."""
import pandas as pd

from config import (
    MAP_XLSX,
    HOUSEHOLD_TYPES,
    RESERVOIR_TYPE,
    RESERVOIR_HYDRAULIC_LEVEL_M,
)
from utils import haversine_m

DEMAND_COLS = ["Boire", "Cuisiner", "Hygiene", "Lessive"]


def load_village_data(path=MAP_XLSX):
    """Read Map_village and annotate households / reservoir / demand."""
    df = pd.read_excel(path)
    df.columns = [str(c).strip() for c in df.columns]
    df["Type"] = df["Type"].astype(str).str.strip()

    df["demand_l_day"] = df[DEMAND_COLS].fillna(0).sum(axis=1)
    df["is_household"] = df["Type"].isin(HOUSEHOLD_TYPES)
    # The reservoir row is typed "Reservoir" in Map_village (not "Chateau").
    df["is_reservoir"] = df["Type"].str.contains(
        "Reservoir|Chateau", case=False, na=False
    )
    df["pump_required"] = df["Altitude"] > RESERVOIR_HYDRAULIC_LEVEL_M
    return df


def get_households(df):
    return df[df["is_household"]].copy().reset_index(drop=True)


def get_reservoir(df):
    return df[df["is_reservoir"]].iloc[0]


def greedy_select_fountains(households, n_fountains, radius_m):
    """
    Greedy maximum-coverage placement — the heart of the solution.

    THIS replaces the old `candidates.head(n_fountains)`, which simply took
    the first 5 households in file order (all clustered together -> ~33%).

    Candidate sites = every household location. At each step we place a
    fountain where it covers the MOST still-uncovered people within
    `radius_m`, mark them served, and repeat. 5 fountains -> ~94% coverage.

    Returns a DataFrame (one row per fountain, ordered BF1..BFn) with the
    population and number of households each fountain newly covers.
    """
    hh = households.reset_index(drop=True)
    lon = hh["Lon"].to_numpy()
    lat = hh["Lat"].to_numpy()
    pop = hh["Nb personnes"].fillna(0).to_numpy()
    n = len(hh)

    within = [
        [haversine_m(lon[i], lat[i], lon[j], lat[j]) <= radius_m for j in range(n)]
        for i in range(n)
    ]

    served = [False] * n
    records = []

    for k in range(n_fountains):
        best_i, best_gain, best_members = -1, -1.0, []
        for c in range(n):
            members = [j for j in range(n) if within[c][j] and not served[j]]
            gain = sum(pop[j] for j in members)
            if gain > best_gain:
                best_i, best_gain, best_members = c, gain, members

        if best_i < 0 or best_gain <= 0:
            break

        for j in best_members:
            served[j] = True
        records.append({
            "bf_id": f"BF{k + 1}",
            "Lon": float(lon[best_i]),
            "Lat": float(lat[best_i]),
            "Altitude": float(hh.iloc[best_i]["Altitude"]),
            "households_covered": len(best_members),
            "population_covered": float(best_gain),
        })

    return pd.DataFrame(records)
