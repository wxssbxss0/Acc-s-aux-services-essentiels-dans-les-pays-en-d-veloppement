// frontend/src/api.js

const LOCAL_GEOJSON_PATH = "/data/clean/village_points.geojson";

export async function getVillagePoints() {
  const response = await fetch(LOCAL_GEOJSON_PATH);

  if (!response.ok) {
    throw new Error(
      `Failed to load village GeoJSON from ${LOCAL_GEOJSON_PATH}. ` +
      `Make sure you launched the server from the project root.`
    );
  }

  return await response.json();
}

// Temporary fake job function until backend exists
export async function startGravityAnalysis() {
  return {
    job_id: "local-preview",
    status: "complete",
    message: "Backend not connected yet. Showing precomputed GeoJSON only."
  };
}

// Temporary fake job status
export async function getJobStatus(jobId) {
  return {
    job_id: jobId,
    status: "complete",
    result_ready: true
  };
}
