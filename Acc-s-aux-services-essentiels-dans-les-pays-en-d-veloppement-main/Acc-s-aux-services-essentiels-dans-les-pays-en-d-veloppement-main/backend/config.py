"""Central configuration — every project parameter lives here."""
from pathlib import Path 

PROJECT_ROOT = Path(__file__).resolve().parents[1]

# NOTE: the raw spreadsheets live directly in <repo>/raw, not <repo>/data/raw
RAW_DATA_DIR = PROJECT_ROOT / "data" / "raw"
CLEAN_DATA_DIR = PROJECT_ROOT / "data" / "clean"
RESULTS_DIR = PROJECT_ROOT / "results"

MAP_XLSX = RAW_DATA_DIR / "Map_village_20241227.xlsx"
COST_XLSX = RAW_DATA_DIR / "Solution1_Hydraulique_Glossaire.xlsx"
OUTPUT_XLSX = PROJECT_ROOT / "Solution_AEP_Guinee_reproduced.xlsx"

# ----- Data typing -------------------------------------------------------
HOUSEHOLD_TYPES = ("Menage", "MenageI")
RESERVOIR_TYPE = "Reservoir"

# ----- Project constraints ----------------------------------------------
MAX_BUDGET_EUR = 220_000
TARGET_BUDGET_EUR = 200_000
MAX_DAILY_WATER_M3 = 37
MAX_DAILY_WATER_L = MAX_DAILY_WATER_M3 * 1000

# ----- Coverage ----------------------------------------------------------
N_FOUNTAINS = 5
MAX_WALKING_DISTANCE_M = 500           # service radius, commonly used planning threshold

# ----- Reservoir / hydraulics -------------------------------------------
RESERVOIR_TERRAIN_ALTITUDE_M = 368
TANK_BASE_ABOVE_GROUND_M = 5

RESERVOIR_HYDRAULIC_LEVEL_M = (
    RESERVOIR_TERRAIN_ALTITUDE_M + TANK_BASE_ABOVE_GROUND_M
)                                           # 373 m NGF — water outlet elevation

# Pressure criteria at the borne-fontaine / service point
MIN_SERVICE_PRESSURE_M = 18                 # minimum acceptable pressure at BF
TARGET_SERVICE_PRESSURE_M = 20              # preferred service target
MARGINAL_SERVICE_PRESSURE_M = 18            # below this = marginal service quality

# Pressure control
PRV_PRESSURE_M = 20                         # if pressure exceeds this, use pressure reducer

# Legacy/simple pressure variable, kept for compatibility if old scripts use it
MIN_PRESSURE_M = MIN_SERVICE_PRESSURE_M

# ----- Demand / flows ----------------------------------------------------
DESIGN_LPCD = 20                            # design demand, L/person/day
PEAK_HOUR_FACTOR = 2                        # peak-hour factor
DISTRIBUTION_HOURS = 12                     # gravity distribution window, e.g. 6h-18h

# Fountain flow assumptions
FOUNTAIN_TAPS = 2                           # number of taps per fountain
TAP_FLOW_LPS = 0.10                         # conservative per-tap flow, L/s
MIN_FOUNTAIN_FLOW_LPS = FOUNTAIN_TAPS * TAP_FLOW_LPS

# Useful conversions
MIN_FOUNTAIN_FLOW_LPM = MIN_FOUNTAIN_FLOW_LPS * 60
MIN_FOUNTAIN_FLOW_LPH = MIN_FOUNTAIN_FLOW_LPS * 3600
MIN_FOUNTAIN_DAILY_CAPACITY_L = MIN_FOUNTAIN_FLOW_LPH * DISTRIBUTION_HOURS

# ----- Hazen-Williams ----------------------------------------------------
HW_C = 135                                  # HDPE PN10 new pipe roughness coefficient
COMMERCIAL_DN_MM = (40, 50, 63, 75, 90, 110)
MAX_VELOCITY_MS = 0.25                      # conservative gravity-pipe velocity criterion

# ----- Relevage pump -----------------------------------------------------
PUMP_LIFT_M = 8
PUMP_LOSSES_M = 2
PUMP_HOURS = 2
PUMP_EFFICIENCY = 0.55
RHO = 1000.0
G = 9.81

# ----- Costs -------------------------------------------------------------
BOOSTER_PUMP_EUR = 1800
BOOSTER_OPEX_EUR_PER_YEAR = 50
PIPE_EUR_PER_M = 29.4 # installed pipe cost, mixed DN40/DN50 benchmark
PIPE_COST_EUR_PER_M = {
    40: 29.4,
    50: 32.0,
    63: 38.0,
    75: 45.0,
}
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
CONTINGENCY_RATE = 0.05                     # 5% contingency
PROJECT_LIFETIME_YEARS = 20
