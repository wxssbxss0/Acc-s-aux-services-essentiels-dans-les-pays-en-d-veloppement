import json
import pandas as pd

from config import (
    MAP_XLSX,
    CLEAN_DATA_DIR,
    RESERVOIR_HYDRAULIC_LEVEL_M,
    MIN_SERVICE_HEAD_M,
    DEFAULT_HEAD_LOSS_M,
)
from utils import haversine_m


def load_village_data(path=MAP_XLSX):
    df = pd.read_excel(path)

    # Clean column names
    df.columns = [str(c).strip() for c in df.columns]

    # Compute daily demand in L/day
    demand_cols = ["Boire", "Cuisiner", "Hygiene", "Lessive"]
    df["demand_l_day"] = df[demand_cols].fillna(0).sum(axis=1)

    # Normalize useful categories
    df["Type"] = df["Type"].astype(str).str.strip()
    df["is_household"] = df["Type"].isin(["Menage", "MenageI"])
    df["is_reservoir"] = df["Type"].str.contains("Chateau", case=False, na=False)

    # Basic hydraulic feasibility
    df["required_head_m"] = (
        df["Altitude"] + MIN_SERVICE_HEAD_M + DEFAULT_HEAD_LOSS_M
    )

    df["gravity_possible"] = (
        RESERVOIR_HYDRAULIC_LEVEL_M >= df["required_head_m"]
    )

    df["pump_required"] = ~df["gravity_possible"]

    return df


def get_households(df):
    return df[df["is_household"]].copy()


def get_candidate_locations(df):
    """
    First simple version:
    use existing household coordinates as possible candidate fountain locations.
    Later we can add cluster centers.
    """
    candidates = df[df["is_household"]].copy()
    candidates = candidates[["Lon", "Lat", "Altitude"]].copy()
    candidates = candidates.reset_index(drop=True)
    candidates["candidate_id"] = ["cand_" + str(i) for i in range(len(candidates))]
    return candidates


def compute_distance_matrix(households, candidates):
    rows = []

    for i, h in households.iterrows():
        for j, c in candidates.iterrows():
            rows.append(
                {
                    "household_index": i,
                    "candidate_id": c["candidate_id"],
                    "distance_m": haversine_m(
                        h["Lon"], h["Lat"],
                        c["Lon"], c["Lat"]
                    ),
                }
            )

    return pd.DataFrame(rows)


def export_geojson(df, output_path=None):
    if output_path is None:
        output_path = CLEAN_DATA_DIR / "village_points.geojson"

    features = []

    for idx, row in df.iterrows():
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [row["Lon"], row["Lat"]],
            },
            "properties": {
                "id": int(idx),
                "type": row["Type"],
                "altitude_m": float(row["Altitude"]),
                "population": int(row["Nb personnes"]) if not pd.isna(row["Nb personnes"]) else 0,
                "demand_l_day": float(row["demand_l_day"]),
                "gravity_possible": bool(row["gravity_possible"]),
                "pump_required": bool(row["pump_required"]),
            },
        }
        features.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "features": features,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2, ensure_ascii=False)

    return output_path
