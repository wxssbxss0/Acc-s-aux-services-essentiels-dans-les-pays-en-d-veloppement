// frontend/src/main.js

import { getVillagePoints, startGravityAnalysis, getJobStatus } from "./api.js";
import { createMap, zoomToGuinea, zoomToVillage } from "./map.js";
import { addVillagePoints } from "./layers.js";

console.log("main.js loaded");

const map = createMap();

let villageLayer = null;
let cachedVillageData = null;

const statusDiv = document.getElementById("status");

function setStatus(message) {
  console.log(message);
  statusDiv.textContent = message;
}

document.getElementById("zoom-guinea").addEventListener("click", () => {
  setStatus("Zooming to Guinea...");
  zoomToGuinea(map);
});

document.getElementById("zoom-village").addEventListener("click", () => {
  setStatus("Zooming to village...");
  zoomToVillage(map);
});

document.getElementById("load-points").addEventListener("click", async () => {
  try {
    setStatus("Loading village points from GeoJSON...");

    const data = await getVillagePoints();
    cachedVillageData = data;

    if (villageLayer) {
      map.removeLayer(villageLayer);
    }

    villageLayer = addVillagePoints(map, data);

    const nPoints = data.features ? data.features.length : 0;
    setStatus(`Loaded ${nPoints} village points.`);
  } catch (error) {
    console.error(error);
    setStatus(error.message);
  }
});

document.getElementById("run-gravity").addEventListener("click", async () => {
  try {
    setStatus("Running local gravity preview...");

    if (!cachedVillageData) {
      cachedVillageData = await getVillagePoints();
    }

    const features = cachedVillageData.features || [];

    const pumpRequired = features.filter(
      (f) => f.properties && f.properties.pump_required === true
    ).length;

    const gravityPossible = features.filter(
      (f) => f.properties && f.properties.gravity_possible === true
    ).length;

    const job = await startGravityAnalysis();
    const status = await getJobStatus(job.job_id);

    setStatus(
      `Gravity preview complete. Gravity possible: ${gravityPossible} points. ` +
      `Pump required: ${pumpRequired} points. Job status: ${status.status}.`
    );
  } catch (error) {
    console.error(error);
    setStatus(error.message);
  }
});

// Auto-load points on page load
window.addEventListener("load", async () => {
  try {
    setStatus("Page loaded. Auto-loading village points...");
    const data = await getVillagePoints();
    cachedVillageData = data;
    villageLayer = addVillagePoints(map, data);

    const nPoints = data.features ? data.features.length : 0;
    setStatus(`Auto-loaded ${nPoints} village points.`);
  } catch (error) {
    console.warn(error);
    setStatus("Frontend loaded. Click buttons once GeoJSON path is fixed.");
  }
});
