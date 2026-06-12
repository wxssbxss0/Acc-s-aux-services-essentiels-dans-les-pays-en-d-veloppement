"""
Cost model: CAPEX, OPEX, corrective hydraulic costs, and 20-year lifecycle.

This version supports:
- diameter-aware pipe cost using actual segment DN values
- corrective costs from hydraulic validation:
    - DN upgrade
    - booster pump
- operation and maintenance costs
- worker wages
- lifecycle cost calculation

Expected use from main.py:

    costs = estimate_costs(
        network_length_m=network_length_m,
        n_prv=n_prv,
        served_population=served_population,
        segments=segments,
        corrective_items=corrective_items,
    )
"""

import pandas as pd

from config import (
    COST_XLSX,
    N_FOUNTAINS,
    PIPE_EUR_PER_M,
    FOUNTAIN_EUR,
    VALVES_FORFAIT_EUR,
    PRV_EUR,
    CHLORINATOR_EUR,
    SOLAR_PUMP_KIT_EUR,
    PUMP_PIPE_DN25_LEN_M,
    PUMP_PIPE_DN25_EUR_PER_M,
    STUDIES_EUR,
    TRAINING_PER_TECH_EUR,
    N_TECHNICIANS,
    CONTINGENCY_RATE,
    PROJECT_LIFETIME_YEARS,
)


# ---------------------------------------------------------------------
# Optional fallback constants.
# These make the file robust if you have not yet added the new constants
# to config.py.
# ---------------------------------------------------------------------

PIPE_COST_EUR_PER_M_DEFAULT = {
    40: 13,
    50: 16,
    63: 22,
    75: 27,
}

BOOSTER_OPEX_EUR_PER_YEAR_DEFAULT = 50


def _get_config_value(name, default):
    """
    Safely get optional values from config.py without breaking the code
    if the constant does not exist yet.
    """
    try:
        import config
        return getattr(config, name, default)
    except Exception:
        return default


PIPE_COST_EUR_PER_M = _get_config_value(
    "PIPE_COST_EUR_PER_M",
    PIPE_COST_EUR_PER_M_DEFAULT,
)

BOOSTER_OPEX_EUR_PER_YEAR = _get_config_value(
    "BOOSTER_OPEX_EUR_PER_YEAR",
    BOOSTER_OPEX_EUR_PER_YEAR_DEFAULT,
)


# ---------------------------------------------------------------------
# Loading glossary
# ---------------------------------------------------------------------

def load_cost_glossary(path=COST_XLSX):
    """
    Reference price glossary.

    This is kept for traceability. The actual model uses documented
    constants and the computed network geometry.
    """
    df = pd.read_excel(path, sheet_name="Glossaire_Prix", header=2)
    df.columns = [str(c).strip() for c in df.columns]
    return df


# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------

def _safe_float(value, default=0.0):
    try:
        return float(value)
    except Exception:
        return default


def _safe_int(value, default=0):
    try:
        return int(round(float(value)))
    except Exception:
        return default


def _pipe_unit_cost(dn_mm):
    """
    Return pipe cost per meter for the selected diameter.
    Falls back to PIPE_EUR_PER_M if no diameter-specific cost is found.
    """
    try:
        dn = int(round(float(dn_mm)))
    except Exception:
        return PIPE_EUR_PER_M

    return PIPE_COST_EUR_PER_M.get(dn, PIPE_EUR_PER_M)


def _compute_pipe_cost_from_segments(segments, network_length_m):
    """
    Computes pipe cost from actual network segments if available.

    Each segment should ideally contain:
        length_m
        dn_mm

    If segments are missing, fall back to:
        network_length_m * PIPE_EUR_PER_M
    """
    if not segments:
        return round(network_length_m * PIPE_EUR_PER_M)

    total = 0

    for s in segments:
        length = _safe_float(s.get("length_m", 0))
        dn = s.get("dn_mm", 40)
        unit = _pipe_unit_cost(dn)
        total += length * unit

    return round(total)


def _split_corrective_costs(corrective_items):
    """
    Separates corrective hydraulic costs into:
    - diameter upgrade costs
    - booster pump costs
    - other corrective costs
    """
    corrective_items = corrective_items or []

    diameter_upgrade_total = 0
    booster_total = 0
    other_total = 0

    n_boosters = 0

    for item in corrective_items:
        cost = _safe_float(item.get("cost_eur", 0))
        solution = str(item.get("solution", "")).lower()

        if "diam" in solution or "dn" in solution:
            diameter_upgrade_total += cost
        elif "pompe" in solution or "booster" in solution:
            booster_total += cost
            n_boosters += 1
        else:
            other_total += cost

    return {
        "diameter_upgrade_total": round(diameter_upgrade_total),
        "booster_total": round(booster_total),
        "other_corrective_total": round(other_total),
        "n_boosters": n_boosters,
        "corrective_total": round(
            diameter_upgrade_total + booster_total + other_total
        ),
    }


# ---------------------------------------------------------------------
# Main cost model
# ---------------------------------------------------------------------

def estimate_costs(
    network_length_m,
    n_prv,
    served_population,
    segments=None,
    corrective_items=None,
):
    """
    Estimate CAPEX, OPEX, and 20-year lifecycle cost.

    Parameters
    ----------
    network_length_m : float
        Total network pipe length in meters.

    n_prv : int
        Number of pressure reducing valves.

    served_population : float
        Population served by the solution.

    segments : list[dict], optional
        Hydraulic network segments. Used to compute pipe cost by diameter.

    corrective_items : list[dict], optional
        Hydraulic correction decisions, for example:
            {
                "bf": "BF2",
                "solution": "Gravité + pompe booster",
                "diameter": "DN50",
                "h_final_m": 20.0,
                "status_18": "PASS",
                "status_20": "PASS",
                "cost_eur": 1800,
                "justification": "Static head insufficient"
            }

    Returns
    -------
    dict
        Cost summary:
        - capex_items
        - capex_subtotal
        - contingency
        - capex_total
        - opex_items
        - opex_total
        - lifecycle
        - cost_per_person
    """

    corrective_items = corrective_items or []

    pipe_cost = _compute_pipe_cost_from_segments(
        segments=segments,
        network_length_m=network_length_m,
    )

    corrective_breakdown = _split_corrective_costs(corrective_items)

    diameter_upgrade_total = corrective_breakdown["diameter_upgrade_total"]
    booster_total = corrective_breakdown["booster_total"]
    other_corrective_total = corrective_breakdown["other_corrective_total"]
    n_boosters = corrective_breakdown["n_boosters"]

    # -----------------------------------------------------------------
    # CAPEX
    # -----------------------------------------------------------------

    capex_items = [
        (
            "Réseau de conduites posées, coût par diamètre réel",
            pipe_cost,
        ),
        (
            f"{N_FOUNTAINS} bornes-fontaines "
            "(dalle + 2 robinets + drainage)",
            N_FOUNTAINS * FOUNTAIN_EUR,
        ),
        (
            "Vannes + ventouses + regards béton (forfait)",
            VALVES_FORFAIT_EUR,
        ),
        (
            f"{n_prv} réducteurs de pression PRV DN40",
            n_prv * PRV_EUR,
        ),
        (
            "Chlorateur gravitaire en sortie de réservoir",
            CHLORINATOR_EUR,
        ),
        (
            "Surcoût augmentation diamètre, par exemple DN40 → DN50",
            diameter_upgrade_total,
        ),
        (
            "Pompes booster solaires ciblées",
            booster_total,
        ),
        (
            "Autres correctifs hydrauliques",
            other_corrective_total,
        ),
        (
            "Pompe solaire de relevage + panneau + batterie",
            SOLAR_PUMP_KIT_EUR,
        ),
        (
            f"Conduite DN25 pompe de relevage "
            f"({PUMP_PIPE_DN25_LEN_M} m)",
            PUMP_PIPE_DN25_LEN_M * PUMP_PIPE_DN25_EUR_PER_M,
        ),
        (
            "Études + topographie + supervision chantier",
            STUDIES_EUR,
        ),
        (
            f"Formation de {N_TECHNICIANS} techniciens locaux",
            N_TECHNICIANS * TRAINING_PER_TECH_EUR,
        ),
    ]

    # Remove zero-value corrective items from display, but keep structure.
    capex_items = [
        (label, round(value))
        for label, value in capex_items
        if value != 0
    ]

    capex_subtotal = sum(value for _, value in capex_items)
    contingency = round(CONTINGENCY_RATE * capex_subtotal)
    capex_items.append(
        (
            f"Imprévus ({CONTINGENCY_RATE * 100:.0f}%)",
            contingency,
        )
    )

    capex_total = capex_subtotal + contingency

    # -----------------------------------------------------------------
    # OPEX
    # -----------------------------------------------------------------

    # Existing baseline OPEX logic, with explicit worker salary.
    opex_items = [
        (
            "Salaire fontainier / opérateur local "
            "(90 €/mois)",
            1080,
        ),
        (
            "Chlore et produits de traitement",
            300,
        ),
        (
            "Maintenance préventive du réseau",
            600,
        ),
        (
            "Stock de pièces de rechange",
            500,
        ),
        (
            "Provision réhabilitation lourde à 10 ans",
            1500,
        ),
        (
            "Analyses qualité de l’eau (2×/an)",
            150,
        ),
        (
            "Remplacement / amortissement compteurs",
            200,
        ),
        (
            "Énergie pompe solaire principale",
            0,
        ),
    ]

    if n_boosters > 0:
        opex_items.append(
            (
                f"Maintenance annuelle de {n_boosters} pompe(s) booster",
                n_boosters * BOOSTER_OPEX_EUR_PER_YEAR,
            )
        )

    opex_total = sum(value for _, value in opex_items)

    # -----------------------------------------------------------------
    # Lifecycle
    # -----------------------------------------------------------------

    lifecycle = capex_total + PROJECT_LIFETIME_YEARS * opex_total

    return {
        "capex_items": capex_items,
        "capex_subtotal": capex_subtotal,
        "contingency": contingency,
        "capex_total": capex_total,
        "opex_items": opex_items,
        "opex_total": opex_total,
        "lifecycle": lifecycle,
        "cost_per_person": lifecycle / served_population if served_population else 0.0,
        "pipe_cost": pipe_cost,
        "corrective_breakdown": corrective_breakdown,
        "corrective_items": corrective_items,
    }
