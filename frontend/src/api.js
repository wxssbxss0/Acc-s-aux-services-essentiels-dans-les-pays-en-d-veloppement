const API_BASE = "http://localhost:5000";

export async function getVillagePoints() {
    const response = await fetch(`${API_BASE}/api/village-points`);

    if (!response.ok) {
        throw new Error(`Failed to fetch village points: ${response.statusText}`);
    }

    return await response.json();
}

export async function startGravityAnalysis() {
    const response = await fetch(`${API_BASE}/api/gravity-analysis`, {
        method: "POST",
    });

    if (!response.ok) {
        throw new Error(`Failed to start gravity analysis: ${response.statusText}`);
    }

    return await response.json();
}

export async function getJobStatus(jobId) {
  const response = await fetch(`${API_BASE}/jobs/${jobId}`);

  if (!response.ok) {
    throw new Error("Failed to get job status");
  }

  return await response.json();
}