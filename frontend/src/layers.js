function getPointColor(type) {
  if (type === "chateau_eau") return "purple";
  if (type === "menage") return "blue";
  if (type === "puits") return "red";
  if (type === "pompe_main") return "green";
  if (type === "commerce_ecole") return "black";
  return "gray";
}

export function addVillagePoints(map, geojsonData) {
  const layer = L.geoJSON(geojsonData, {
    pointToLayer: function (feature, latlng) {
      const type = feature.properties.type;
      const color = getPointColor(type);

      return L.circleMarker(latlng, {
        radius: type === "chateau_eau" ? 8 : 5,
        color: color,
        fillColor: color,
        fillOpacity: 0.8
      });
    },

    onEachFeature: function (feature, layer) {
      const p = feature.properties;

      layer.bindPopup(`
        <strong>${p.type}</strong><br>
        Altitude: ${p.altitude_m ?? "N/A"} m<br>
        Demand: ${p.demand_l_day ?? "N/A"} L/day<br>
        Hydraulic level: ${p.hydraulic_level_m ?? "N/A"} m
      `);
    }
  });

  layer.addTo(map);
  return layer;
}