// frontend/src/layers.js

function normalizeType(type) {
  return String(type || "").toLowerCase();
}

function getPointColor(type) {
  const t = normalizeType(type);

  if (t.includes("chateau")) return "purple";
  if (t.includes("menage")) return "blue";
  if (t.includes("puits")) return "red";
  if (t.includes("pompe")) return "green";
  if (t.includes("commerce") || t.includes("ecole")) return "black";

  return "gray";
}

function getPointRadius(type) {
  const t = normalizeType(type);

  if (t.includes("chateau")) return 9;
  if (t.includes("pompe") || t.includes("puits")) return 7;

  return 5;
}

export function addVillagePoints(map, geojsonData) {
  const layer = L.geoJSON(geojsonData, {
    pointToLayer: function (feature, latlng) {
      const p = feature.properties || {};
      const color = getPointColor(p.type);

      return L.circleMarker(latlng, {
        radius: getPointRadius(p.type),
        color: color,
        fillColor: color,
        fillOpacity: 0.85,
        weight: 2
      });
    },

    onEachFeature: function (feature, layer) {
      const p = feature.properties || {};

      const gravityText =
        p.gravity_possible === true
          ? "Yes"
          : p.gravity_possible === false
          ? "No"
          : "N/A";

      const pumpText =
        p.pump_required === true
          ? "Yes"
          : p.pump_required === false
          ? "No"
          : "N/A";

      layer.bindPopup(`
        <strong>${p.type ?? "Unknown point"}</strong><br>
        ID: ${p.id ?? "N/A"}<br>
        Altitude: ${p.altitude_m ?? "N/A"} m<br>
        Population: ${p.population ?? "N/A"}<br>
        Demand: ${p.demand_l_day ?? "N/A"} L/day<br>
        Gravity possible: ${gravityText}<br>
        Pump required: ${pumpText}
      `);
    }
  });

  layer.addTo(map);

  try {
    map.fitBounds(layer.getBounds(), {
      padding: [40, 40]
    });
  } catch (error) {
    console.warn("Could not fit bounds:", error);
  }

  return layer;
}	
