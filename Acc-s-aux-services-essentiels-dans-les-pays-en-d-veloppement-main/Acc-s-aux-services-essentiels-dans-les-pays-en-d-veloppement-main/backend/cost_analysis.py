"""Cost model: CAPEX bill of quantities, OPEX, 20-year lifecycle (Excel-matching)."""
import pandas as pd

from config import (
    COST_XLSX, N_FOUNTAINS, PIPE_EUR_PER_M, FOUNTAIN_EUR, VALVES_FORFAIT_EUR,
    PRV_EUR, CHLORINATOR_EUR, SOLAR_PUMP_KIT_EUR, PUMP_PIPE_DN25_LEN_M,
    PUMP_PIPE_DN25_EUR_PER_M, STUDIES_EUR, TRAINING_PER_TECH_EUR, N_TECHNICIANS,
    CONTINGENCY_RATE, PROJECT_LIFETIME_YEARS,
)


def load_cost_glossary(path=COST_XLSX):
    """Reference price glossary (kept for traceability / sourcing)."""
    df = pd.read_excel(path, sheet_name="Glossaire_Prix", header=2)
    df.columns = [str(c).strip() for c in df.columns]
    return df


def estimate_costs(network_length_m, n_prv, served_population):
    """
    CAPEX / OPEX / lifecycle. Only the pipe-network line is data-driven
    (length from the routing algorithm); the rest are documented West-Africa
    benchmarks (WASHCost, IRC WASH) and lump sums.
    """
    capex_items = [
        ("Réseau de conduites posées (DN40/DN50)", round(network_length_m * PIPE_EUR_PER_M)),
        ("5 bornes-fontaines (dalle + 2 robinets + drainage)", N_FOUNTAINS * FOUNTAIN_EUR),
        ("Vannes + ventouses + regards béton (forfait)", VALVES_FORFAIT_EUR),
        (f"{n_prv} réducteurs de pression PRV DN40", n_prv * PRV_EUR),
        ("Chlorateur gravitaire (sortie réservoir)", CHLORINATOR_EUR),
        ("Pompe solaire 200W + panneau + batterie", SOLAR_PUMP_KIT_EUR),
        ("Conduite DN25 pompe de relevage (200 m)",
         PUMP_PIPE_DN25_LEN_M * PUMP_PIPE_DN25_EUR_PER_M),
        ("Études + topographie + supervision chantier", STUDIES_EUR),
        ("Formation de 3 techniciens locaux", N_TECHNICIANS * TRAINING_PER_TECH_EUR),
    ]
    subtotal = sum(v for _, v in capex_items)
    contingency = round(CONTINGENCY_RATE * subtotal)
    capex_items.append(("Imprévus (5%)", contingency))
    capex_total = subtotal + contingency

    opex_items = [
        ("Salaire fontainier / opérateur (90 €/mois)", 1080),
        ("Chlore et produits de traitement", 300),
        ("Maintenance préventive", 600),
        ("Stock de pièces de rechange", 500),
        ("Provision réhabilitation (à 10 ans)", 1500),
        ("Analyses qualité eau (2×/an)", 150),
        ("Remplacement compteurs (amorti)", 200),
        ("Énergie pompe solaire", 0),
    ]
    opex_total = sum(v for _, v in opex_items)

    lifecycle = capex_total + PROJECT_LIFETIME_YEARS * opex_total
    return {
        "capex_items": capex_items,
        "capex_subtotal": subtotal,
        "capex_total": capex_total,
        "opex_items": opex_items,
        "opex_total": opex_total,
        "lifecycle": lifecycle,
        "cost_per_person": lifecycle / served_population if served_population else 0.0,
    }
