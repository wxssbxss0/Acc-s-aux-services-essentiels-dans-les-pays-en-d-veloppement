import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from scipy.interpolate import griddata

# ---------------------------------------------------------
# 1. Daten laden
# ---------------------------------------------------------
df = pd.read_excel("Map_village_20241227.xlsx")
df.columns = [c.strip().lower() for c in df.columns]

# ---------------------------------------------------------
# 2. Wasserbedarf berechnen
# ---------------------------------------------------------
need_cols = ["boire", "cuisiner", "hygiene", "lessive"]
df["total_need"] = df[need_cols].sum(axis=1)

# Normierung für Farben
norm_need = (df["total_need"] - df["total_need"].min()) / (df["total_need"].max() - df["total_need"].min())

# ---------------------------------------------------------
# 3. Typen trennen
# ---------------------------------------------------------
consumers = df[df["type"].str.contains("menage", case=False)]
suppliers = df[df["type"].isin(["Puits ouvert", "Pompe a main", "Reservoir"])]

reservoir_alt = df[df["type"] == "Reservoir"]["altitude"].iloc[0]

# ---------------------------------------------------------
# 4. Höhenkarte interpolieren (für Contours)
# ---------------------------------------------------------
lon = df["lon"].values
lat = df["lat"].values
alt = df["altitude"].values

# Gitter erzeugen
grid_lon, grid_lat = np.meshgrid(
    np.linspace(lon.min(), lon.max(), 300),
    np.linspace(lat.min(), lat.max(), 300)
)

grid_alt = griddata((lon, lat), alt, (grid_lon, grid_lat), method="cubic")

# ---------------------------------------------------------
# 5. Colormap wie im Beispiel (braun → beige → blau)
# ---------------------------------------------------------
colors = ["#8B4513", "#C2B280", "#87CEEB"]
cmap_alt = LinearSegmentedColormap.from_list("altitude_map", colors)

# ---------------------------------------------------------
# 6. Plot
# ---------------------------------------------------------
fig, ax = plt.subplots(figsize=(12, 10))

# Höhenflächen
contourf = ax.contourf(
    grid_lon, grid_lat, grid_alt,
    levels=20,
    cmap=cmap_alt,
    alpha=0.8
)

# Konturlinien
contour = ax.contour(
    grid_lon, grid_lat, grid_alt,
    levels=20,
    colors="black",
    linewidths=0.6,
    alpha=0.6
)

plt.clabel(contour, inline=True, fontsize=8, fmt="%.0f m")

cbar = plt.colorbar(contourf, ax=ax)
cbar.set_label("Altitude (m)")

# 7. Verbraucher (Farbe = Wasserbedarf)
scatter_need = ax.scatter(
    consumers["lon"], consumers["lat"],
    c=norm_need[consumers.index],
    cmap="viridis",
    s=70,
    edgecolor="black",
    label="Ménages"
)

# Legende für Wasserbedarf
sm = plt.cm.ScalarMappable(
    cmap="viridis",
    norm=plt.Normalize(vmin=df["total_need"].min(),
                       vmax=df["total_need"].max())
)
sm.set_array([])

cbar_need = plt.colorbar(sm, ax=ax, fraction=0.046, pad=0.04)
cbar_need.set_label("Besoin d'eau total (L/Jour)")

# ---------------------------------------------------------
# 8. Versorger mit Symbolen
# ---------------------------------------------------------
marker_map = {
    "Puits ouvert": "^",
    "Pompe a main": "s",
    "Reservoir": "P"
}

color_map = {
    "Puits ouvert": "red",
    "Pompe a main": "green",
    "Reservoir": "purple"
}

for t in marker_map:
    subset = suppliers[suppliers["type"] == t]
    ax.scatter(
        subset["lon"], subset["lat"],
        marker=marker_map[t],
        s=200,
        color=color_map[t],
        edgecolor="black",
        linewidth=1.2,
        label=t
    )

# ---------------------------------------------------------
# 9. Roter Kreis um Verbraucher oberhalb des Reservoirs
# ---------------------------------------------------------
high = consumers[consumers["altitude"] > reservoir_alt]

ax.scatter(
    high["lon"], high["lat"],
    s=300,
    facecolors="none",
    edgecolors="red",
    linewidth=2,
    label="> Altitude Reservoir"
)

# ---------------------------------------------------------
# 10. Finalisieren
# ---------------------------------------------------------
ax.set_xlabel("Longitude (°)")
ax.set_ylabel("Latitude (°)")
ax.set_title("Carte du village – Altitude & besoins en eau")

ax.legend(loc="upper left", fontsize=9)
ax.grid(True, linestyle="--", alpha=0.3)

plt.tight_layout()
plt.show()
