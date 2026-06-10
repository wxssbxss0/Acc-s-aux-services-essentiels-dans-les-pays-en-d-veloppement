// frontend/src/map.js

export const GUINEA_CENTER = [9.9456, -9.6966];
export const VILLAGE_CENTER = [10.990, -11.435];

export function createMap() {
  const map = L.map("map").setView(GUINEA_CENTER, 7);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  return map;
}

export function zoomToGuinea(map) {
  map.flyTo(GUINEA_CENTER, 7, {
    duration: 1.5
  });
}

export function zoomToVillage(map) {
  map.flyTo(VILLAGE_CENTER, 15, {
    duration: 2.0
  });
}
