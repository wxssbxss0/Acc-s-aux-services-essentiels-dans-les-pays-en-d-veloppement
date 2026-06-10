"""Central configuration — every project parameter lives here."""
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]

# NOTE: the raw spreadsheets live directly in <repo>/raw, not <repo>/data/raw
RAW_DATA_DIR = PROJECT_ROOT / "raw"
CLEAN_DATA_DIR = PROJECT_ROOT / "data" / "clean"
RESULTS_DIR = PROJECT_ROOT / "results"

MAP_XLSX = RAW_DATA_DIR / "Map_village_20241227.xlsx"
COST_XLSX = RAW_DATA_DIR / "Solution1_Hydraulique_Glossaire.xlsx"
OUTPUT_XLSX = PROJECT_ROOT / "Solution_AEP_Guinee_reproduced.xlsx"

# ----- Data typing -------------------------------------------------------
HOUSEHOLD_TYPES = ("Menage", "MenageI")
RESERVOIR_TYPE = "Reservoir"

# ----- Project constraints (énoncé) -------------------------------------
MAX_BUDGET_EUR = 220_000
TARGET_BUDGET_EUR = 200_000
MAX_DAILY_WATER_M3 = 37
MAX_DAILY_WATER_L = MAX_DAILY_WATER_M3 * 1000

# ----- Coverage ----------------------------------------------------------
N_FOUNTAINS = 5
MAX_WALKING_DISTANCE_M = 500           # rayon Sphere/OMS

# ----- Reservoir / hydraulics -------------------------------------------
RESERVOIR_TERRAIN_ALTITUDE_M = 368
TANK_BASE_ABOVE_GROUND_M = 5
RESERVOIR_HYDRAULIC_LEVEL_M = (        # 373 m NGF — altitude de sortie d'eau
    RESERVOIR_TERRAIN_ALTITUDE_M + TANK_BASE_ABOVE_GROUND_M
)
MIN_PRESSURE_M = 5                     # pression mini admissible à la borne
PRV_PRESSURE_M = 20                    # au-dessus -> réducteur de pression

# ----- Demand / flows ----------------------------------------------------
DESIGN_LPCD = 20                       # dotation conception (L/pers/jour) — OMS
PEAK_HOUR_FACTOR = 2                   # facteur de pointe horaire
DISTRIBUTION_HOURS = 12                # fenêtre gravitaire 6h-18h

# ----- Hazen-Williams ----------------------------------------------------
HW_C = 135                             # rugosité HDPE PN10 neuf
COMMERCIAL_DN_MM = (40, 50, 63, 75, 90, 110)
MAX_VELOCITY_MS = 0.25                 # critère conduite gravitaire

# ----- Relevage pump -----------------------------------------------------
PUMP_LIFT_M = 8
PUMP_LOSSES_M = 2
PUMP_HOURS = 2
PUMP_EFFICIENCY = 0.55
RHO = 1000.0
G = 9.81

# ----- Costs -------------------------------------------------------------
PIPE_EUR_PER_M = 29.4                  # prix posé mixte DN40/DN50 (benchmark AO)
FOUNTAIN_EUR = 2740
VALVES_FORFAIT_EUR = 3500
PRV_EUR = 130
CHLORINATOR_EUR = 500
SOLAR_PUMP_KIT_EUR = 600
PUMP_PIPE_DN25_LEN_M = 200
PUMP_PIPE_DN25_EUR_PER_M = 10
STUDIES_EUR = 7500
TRAINING_PER_TECH_EUR = 400
N_TECHNICIANS = 3
CONTINGENCY_RATE = 0.05                # imprévus 5%
PROJECT_LIFETIME_YEARS = 20
