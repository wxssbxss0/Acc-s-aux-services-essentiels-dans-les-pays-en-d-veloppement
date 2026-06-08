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
