export const GUINEA_CENTER = [9.9456, -10.7081];
export const MAP_ZOOM = 7;

export function createMap() {
  const map = L.map("map").setView([9.9456, -9.6966], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  return map;
}

export function zoomToGuinea(map) {
  map.flyTo([9.9456, -9.6966], 7, {
    duration: 1.5
  });
}

export function zoomToVillage(map) {
  map.flyTo(VILLAGE_CENTER, 15, {
    duration: 2.0
  });
}