import { getVillagePoints, startGravityAnalysis, getJobStatus } from "./api.js";
import { createMap, zoomToGuinea, zoomToVillage } from "./map.js";
import { addVillagePoints } from "./layers.js";

const map = createMap();
let villageLayer = null;

const statusDiv = document.getElementById("status");

document.getElementById("zoom-guinea").addEventListener("click", () => {
  zoomToGuinea(map);
});

document.getElementById("zoom-village").addEventListener("click", () => {
  zoomToVillage(map);
});

document.getElementById("load-points").addEventListener("click", async () => {
  try {
    statusDiv.textContent = "Loading village points...";

    const data = await getVillagePoints();

    if (villageLayer) {
      map.removeLayer(villageLayer);
    }

    villageLayer = addVillagePoints(map, data);
    zoomToVillage(map);

    statusDiv.textContent = "Village points loaded.";
  } catch (error) {
    statusDiv.textContent = error.message;
  }
});

document.getElementById("run-gravity").addEventListener("click", async () => {
  try {
    statusDiv.textContent = "Starting gravity analysis...";

    const job = await startGravityAnalysis();
    const jobId = job.job_id;

    statusDiv.textContent = `Job started: ${jobId}`;

    const interval = setInterval(async () => {
      const status = await getJobStatus(jobId);
      statusDiv.textContent = `Job ${jobId}: ${status.status}`;

      if (status.status === "complete" || status.status === "failed") {
        clearInterval(interval);
      }
    }, 1000);
  } catch (error) {
    statusDiv.textContent = error.message;
  }
});