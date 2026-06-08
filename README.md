# Water Adduction System Design – Guinean Village

## Project Description

This project focuses on the design of a water adduction system for a Guinean village of approximately 1030 inhabitants where access to water is currently insufficient. A water tower is already installed at a specific location in the village, and the objective is to propose a technically and economically feasible distribution system that satisfies local water demand.

The project is framed as a response to a call for proposals issued by a local government authority. The goal is to design a system that can transport water from the reservoir to the population while respecting budgetary, technical, and sustainability constraints.

## Objective

The main objective is to design a water distribution network that best satisfies the needs of the village while respecting:

- A maximum budget of 220 k€
- The spatial distribution of households and public facilities
- The location of the existing water tower
- The sustainability of available water resources
- The technical constraints associated with pipes, fountains, household taps, irrigation systems, and/or circulation pumps

## Context

The available data include:

- A village of 1030 inhabitants
- Geographic positions of households, public wells, hand pumps, schools/commerce, and the water tower
- Elevation/altitude data for the village terrain
- Water demand estimates collected through questionnaires

## Possible System Components

The final proposed system may include a combination of:

- Main water pipes
- Secondary distribution pipes
- Public fountains
- Household taps
- Irrigation connections
- Circulation or booster pumps
- Connections from the water tower/reservoir to demand points

## Project Goals

This repository will be used to organize the data, scripts, calculations, and design choices used to build and evaluate the proposed water adduction system.

The project aims to:

1. Analyze the spatial distribution of water demand.
2. Use elevation data to understand hydraulic constraints.
3. Propose a cost-effective water distribution network.
4. Compare possible design choices.
5. Produce a final recommendation suitable for a call-for-proposals response.



## Action Items

- Identify households above the hydraulic level of the reservoir outlet.
- Estimate whether gravity-fed distribution is sufficient.
- Add a booster pump only for high-altitude demand points if necessary.
- Compare pump installation cost and operating cost against the 220 k€ project budget.


## Planned Project Architecture: Interactive GIS + Water Network Analysis

This project will be structured around two connected goals:

1. **Engineering analysis** of the village water adduction system.
2. **Interactive GIS visualization** to make the design choices easier to understand and present.

The idea is to build a system where users can zoom into the selected Guinean village, inspect household locations, altitude, demand points, and the existing water tower, then launch analyses that evaluate gravity-fed supply, pump requirements, and eventually proposed pipe network layouts.

---

## General System Flow

```text
Excel / raw village data
        ↓
Python preprocessing
        ↓
Cleaned village data / GeoJSON
        ↓
Redis cache
        ↓
Backend API
        ↓
Frontend GIS map
        ↓
User launches analysis
        ↓
Python model / background worker
        ↓
Results stored in Redis
        ↓
Frontend updates map and displays results
```

---

## Main Components

### 1. Frontend: Interactive GIS Interface

The frontend will provide a visual interface for exploring the village map.

Planned frontend features:

* Zoom from Guinea / regional scale into the selected village.
* Display village points on an interactive map.
* Show different categories of points:

  * Households
  * Commerce / schools
  * Wells
  * Hand pumps
  * Existing water tower
* Display popups for each point containing:

  * Point type
  * Coordinates
  * Altitude
  * Estimated water demand
  * Gravity-fed feasibility
  * Pump requirement status
* Toggle map layers:

  * Altitude
  * Demand
  * Existing water points
  * Proposed pipe network
  * Gravity-fed vs pump-assisted zones

The first implementation will likely use **Leaflet.js**, since it is simple and well-suited for interactive maps with markers, popups, and GeoJSON layers.

---

### 2. Backend: API + Model Execution

The backend will serve two roles:

1. Provide API endpoints that the frontend can call.
2. Run or trigger Python-based engineering analyses.

The backend does **not** directly “call” the JavaScript and CSS files. Instead, the backend can serve the frontend files and expose API endpoints. The browser loads the frontend, then the frontend JavaScript calls the backend API.

Example flow:

```text
Browser requests the app
        ↓
Backend sends index.html, JS, and CSS
        ↓
Browser runs JavaScript
        ↓
Frontend calls backend API endpoints
        ↓
Backend reads data / runs model / queries Redis
        ↓
Backend returns JSON results
        ↓
Frontend updates the map
```

---

## Proposed Repository Structure

```text
water-dev/
├── backend/
│   ├── app.py                 # Flask/FastAPI app and API routes
│   ├── data_processing.py     # Read Excel, clean data, create GeoJSON
│   ├── model.py               # Hydraulic, gravity, pump, and cost analysis
│   ├── jobs.py                # Background job logic
│   ├── redis_client.py        # Redis connection and helper functions
│   └── config.py              # Project constants and configuration
│
├── frontend/
│   ├── index.html             # Main web page
│   └── src/
│       ├── main.js            # Frontend entry point
│       ├── api.js             # Functions for calling backend endpoints
│       ├── map.js             # Map initialization and zoom logic
│       ├── layers.js          # Markers, GeoJSON layers, pipe layers
│       ├── controls.js        # Buttons, toggles, UI controls
│       └── styles.css         # Frontend styling
│
├── data/
│   ├── raw/                   # Original Excel or CSV files
│   └── clean/                 # Cleaned CSV / GeoJSON files
│
├── results/                   # Generated plots, maps, and analysis outputs
├── docs/                      # Notes, report material, presentation figures
├── environment.yml            # Conda environment
├── README.md
└── .gitignore
```

---

## Frontend / Backend Interaction

The frontend will be responsible for visualization and user interaction.

The backend will be responsible for data access, Redis caching, and engineering computations.

```text
Frontend = map, buttons, popups, visual layers
Backend = API, data processing, model execution
Redis = cache, job queue, results storage
Python model = hydraulic, gravity, pump, and cost logic
```

Example frontend actions:

```text
User clicks "Load Village Points"
        ↓
Frontend calls GET /api/village/points
        ↓
Backend returns GeoJSON
        ↓
Frontend displays points on the map
```

```text
User clicks "Run Gravity Analysis"
        ↓
Frontend calls POST /jobs/gravity-analysis
        ↓
Backend creates a background job
        ↓
Worker runs the Python analysis
        ↓
Results are stored in Redis
        ↓
Frontend polls GET /jobs/<job_id>
        ↓
Once complete, frontend calls GET /results/<job_id>
        ↓
Map updates with gravity-fed and pump-required zones
```

---

## Planned API Endpoints

Initial API endpoints may include:

```text
GET  /api/village/points
GET  /api/village/reservoir
GET  /api/village/bounds
GET  /api/village/altitude
GET  /api/village/demand
```

Analysis job endpoints:

```text
POST /jobs/gravity-analysis
POST /jobs/network-design
POST /jobs/cost-analysis
GET  /jobs/<job_id>
GET  /results/<job_id>
```

---

## Data Format

The backend should eventually serve the village data as GeoJSON, because GeoJSON is easy to display on web maps.

Example point:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [-11.435, 10.990]
  },
  "properties": {
    "id": "reservoir",
    "type": "chateau_eau",
    "altitude_m": 368,
    "hydraulic_level_m": 373,
    "demand_l_day": 0
  }
}
```

Important note: GeoJSON coordinates are ordered as:

```text
[longitude, latitude]
```

not:

```text
[latitude, longitude]
```

---

## Redis Usage

Redis should not be the permanent source of truth for the project data. The source of truth should remain the original Excel file, cleaned CSV files, or cleaned GeoJSON files.

Redis will instead be used for:

* Caching processed village coordinates
* Storing job metadata
* Managing background jobs
* Storing temporary analysis results
* Allowing the frontend to retrieve results quickly

Example Redis role:

```text
Source data:
data/raw/Map_village_20241227.xlsx

Cleaned data:
data/clean/village_points.geojson

Redis cache:
village:points
village:reservoir
job:<job_id>
result:<job_id>
```

---

## Engineering Analysis Goals

The Python model should eventually support:

### Gravity Analysis

Determine which points can be supplied by gravity from the water tower.

Basic idea:

```text
hydraulic_level = reservoir_ground_altitude + tank_height
```

For example, if the water tower ground altitude is 368 m and the tank outlet is 5 m above ground:

```text
hydraulic_level = 368 + 5 = 373 m
```

A simplified first-pass condition:

```text
If point altitude + estimated head losses < hydraulic level:
    gravity-fed supply is possible

If point altitude + estimated head losses > hydraulic level:
    pump assistance is likely required
```

### Pump Requirement Analysis

Identify high-altitude households or demand zones that may require:

* A booster / circulation pump
* A pump-assisted branch
* A local secondary storage solution

### Cost Analysis

Estimate costs for:

* Pipes
* Public fountains
* Household taps
* Irrigation connections
* Pumps
* Pump operating cost
* Maintenance allowance
* Total cost compared with the 220 k€ budget

### Network Design

Later, the model may help propose a pipe network by connecting demand points using distance, altitude, and cost constraints.

Possible future methods:

* Nearest-neighbor network
* Minimum spanning tree
* Cluster-based service zones
* Gravity-fed main network with pump-assisted branch for high-altitude points

---

## Development Plan

### Step 1: Data Processing

* Load the Excel file.
* Extract coordinates, altitude, point type, and demand.
* Clean column names.
* Export a clean CSV and GeoJSON file.

### Step 2: Basic Interactive Map

* Build a Leaflet.js map.
* Center it on Guinea.
* Add a button to zoom into the village.
* Display village points with markers and popups.

### Step 3: Backend API

* Create a Flask or FastAPI backend.
* Add endpoint `GET /api/village/points`.
* Return village data as GeoJSON.
* Connect frontend map to the backend endpoint.

### Step 4: Redis Cache

* Cache the processed village GeoJSON in Redis.
* Avoid reprocessing the Excel file every time the frontend loads the map.

### Step 5: Gravity and Pump Analysis

* Implement gravity feasibility logic in Python.
* Identify points that likely require pump assistance.
* Display results on the map using different colors.

### Step 6: Background Jobs

* Add a jobs system for heavier analyses.
* Frontend launches jobs through API endpoints.
* Backend/worker runs the model.
* Results are stored in Redis and retrieved by the frontend.

### Step 7: Final Presentation Features

* Add layer toggles.
* Add a legend.
* Show gravity-fed vs pump-assisted zones.
* Show proposed pipe routes.
* Show cost summary.
* Optional: add a globe-style intro animation before zooming into the village.

---

## Summary

The final goal is to combine a technical water network design with an interactive GIS interface. The frontend will allow users to explore the village visually, while the backend will run the hydraulic, pump, and cost analyses. Redis will support caching and background jobs, making the system feel more like a real engineering decision-support tool than a static report.



## Repository Structure

```text
water-dev/
├── data/              # Raw and cleaned project data
├── notebooks/         # Exploratory analysis and calculations
├── src/               # Python scripts and reusable functions
├── results/           # Generated figures, maps, and outputs
├── docs/              # Reports, project notes, and presentation material
├── environment.yml    # Conda environment file
└── README.md
