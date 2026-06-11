"""
carte_statique.py
=================
Génère la carte PNG de la solution AEP — Village rural Guinée
Reproduit exactement l'image de la Solution 1.

Usage : python carte_statique.py
→ génère solution1_map.png dans le dossier courant

Bibliothèques :
    pip install pandas numpy scipy matplotlib openpyxl
"""

import math, warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.colors import LinearSegmentedColormap
from scipy.interpolate import griddata
warnings.filterwarnings('ignore')

# ── PARAMÈTRES ────────────────────────────────────────────────
EXCEL_PATH  = "/mnt/c/Users/Owner/OneDrive/Desktop/centrale/Block Week/Acc-s-aux-services-essentiels-dans-les-pays-en-d-veloppement-main/Acc-s-aux-services-essentiels-dans-les-pays-en-d-veloppement-main/data/raw/Map_village_20241227.xlsx"
OUTPUT_PNG  = "solution1_map.png"
RADIUS_M    = 500       # rayon de service (m) — norme Sphere
MAX_BF      = 8
RES_BASE    = 373.0     # altitude base de cuve (m NGF)
CAPEX       = 97862
BF_COLORS   = ['#E63946','#457B9D','#2A9D8F','#F4A261','#6A0572']

# ── FONCTION DISTANCE ─────────────────────────────────────────
def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin(math.radians(lat2-lat1)/2)**2 \
      + math.cos(p1)*math.cos(p2)*math.sin(math.radians(lon2-lon1)/2)**2
    return 2*R*math.atan2(math.sqrt(a), math.sqrt(1-a))

# ── CHARGEMENT DES DONNÉES ────────────────────────────────────
df    = pd.read_excel(EXCEL_PATH)
hh    = df[df['Type'].isin(['Menage','MenageI'])].copy().reset_index(drop=True)
wells = df[df['Type']=='Puits ouvert']
pumps = df[df['Type']=='Pompe a main']
bldgs = df[df['Type']=='Autre']
res   = df[df['Type']=='Reservoir'].iloc[0]

RES_LAT = float(res['Lat'])
RES_LON = float(res['Lon'])
RES_ALT = float(res['Altitude'])

hh['demand_lpd'] = hh[['Boire','Cuisiner','Hygiene','Lessive']].sum(axis=1)

# ── ALGORITHME GREEDY ─────────────────────────────────────────
lats = hh['Lat'].values;  lons = hh['Lon'].values
pops = hh['Nb personnes'].values.astype(float)
N    = len(hh)

DM = np.array([[haversine(lats[i],lons[i],lats[j],lons[j])
                for j in range(N)] for i in range(N)])

uncovered = np.ones(N, dtype=bool)
fountains = []

for _ in range(MAX_BF):
    best_idx, best_pop, best_mask = -1, 0, None
    for i in range(N):
        mask = (DM[i] <= RADIUS_M) & uncovered
        cpop = float(pops[mask].sum())
        if cpop > best_pop:
            best_pop, best_idx, best_mask = cpop, i, mask
    if best_idx < 0 or best_pop < 20:
        break
    row = hh.iloc[best_idx]
    fountains.append({
        'n'          : len(fountains)+1,
        'lat'        : float(row['Lat']),
        'lon'        : float(row['Lon']),
        'alt'        : float(row['Altitude']),
        'pop'        : int(best_pop),
        'hh_count'   : int(best_mask.sum()),
        'dist_res'   : haversine(row['Lat'],row['Lon'],RES_LAT,RES_LON),
        'covered_idx': list(np.where(best_mask)[0]),
    })
    uncovered[best_mask] = False

total_served = sum(f['pop'] for f in fountains)

# ── RÉSEAU MST (PRIM) ─────────────────────────────────────────
nodes   = [(RES_LAT,RES_LON)] + [(f['lat'],f['lon']) for f in fountains]
nn      = len(nodes)
dn      = np.array([[haversine(nodes[i][0],nodes[i][1],nodes[j][0],nodes[j][1])
                     for j in range(nn)] for i in range(nn)])
in_tree = [False]*nn;  in_tree[0] = True
edges   = []
for _ in range(nn-1):
    bd, bi, bj = 1e9, -1, -1
    for i in range(nn):
        if not in_tree[i]: continue
        for j in range(nn):
            if in_tree[j]: continue
            if dn[i,j] < bd: bd, bi, bj = dn[i,j], i, j
    in_tree[bj] = True
    edges.append((bi, bj))

# ── FIGURE ────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(14, 11))
fig.patch.set_facecolor('#F8FAFF')
ax.set_facecolor('#EEF4FF')

# Fond topographique
all_pts = df.dropna(subset=['Lat','Lon','Altitude'])
margin  = 0.003
xi = np.linspace(all_pts['Lon'].min()-margin, all_pts['Lon'].max()+margin, 200)
yi = np.linspace(all_pts['Lat'].min()-margin, all_pts['Lat'].max()+margin, 200)
XI, YI = np.meshgrid(xi, yi)
ZI = griddata((all_pts['Lon'], all_pts['Lat']), all_pts['Altitude'],
              (XI, YI), method='cubic')

topo_cmap = LinearSegmentedColormap.from_list('topo',
    ['#C8E6FF','#B5D4B5','#D4C89A','#C4A882','#B89070'], N=256)
topo = ax.contourf(XI, YI, ZI, levels=20, cmap=topo_cmap, alpha=0.45, zorder=1)
ax.contour(XI, YI, ZI, levels=10, colors='#888888', linewidths=0.3, alpha=0.5, zorder=2)

# Ligne limite gravitaire (373 m NGF)
cs = ax.contour(XI, YI, ZI, levels=[RES_BASE], colors=['#CC0000'],
                linewidths=1.5, linestyles='--', zorder=3)
ax.clabel(cs, fmt=f'{RES_BASE:.0f} m NGF\n(limite gravité)',
          fontsize=7, colors='#CC0000')

# Cercles de service
deg_lat = RADIUS_M/111000
deg_lon = RADIUS_M/109000
for f in fountains:
    col = BF_COLORS[(f['n']-1) % len(BF_COLORS)]
    ell = mpatches.Ellipse((f['lon'], f['lat']),
                           width=2*deg_lon, height=2*deg_lat,
                           fill=True, facecolor=col, alpha=0.12,
                           edgecolor=col, linewidth=1.5, linestyle='--', zorder=4)
    ax.add_patch(ell)

# Réseau de conduites (MST)
for i, j in edges:
    lw  = 2.5 if i == 0 else 1.8
    col = '#1A3A5C' if i == 0 else '#2d6a9f'
    x0, y0 = nodes[i][1], nodes[i][0]
    x1, y1 = nodes[j][1], nodes[j][0]
    ax.plot([x0,x1],[y0,y1], '-', color=col, linewidth=lw,
            alpha=0.7, zorder=5, solid_capstyle='round')

# Ménages — colorés par BF desservante
assigned = np.full(N, -1)
for f in fountains:
    for idx in f['covered_idx']:
        assigned[idx] = f['n']-1

for fn_idx, f in enumerate(fountains):
    col  = BF_COLORS[fn_idx % len(BF_COLORS)]
    mask = (assigned == fn_idx)
    sizes = np.clip(pops[mask]*8, 25, 120)
    ax.scatter(lons[mask], lats[mask], s=sizes, c=col,
               alpha=0.75, edgecolors='white', linewidths=0.4, zorder=6)

# Ménages non desservis
unc = (assigned == -1)
if unc.sum() > 0:
    ax.scatter(lons[unc], lats[unc], s=40, c='#999999',
               alpha=0.70, edgecolors='white', linewidths=0.4, zorder=6)

# Puits contaminés
ax.scatter(wells['Lon'], wells['Lat'], s=60, c='#FF4444',
           marker='X', edgecolors='#990000', linewidths=0.8, zorder=7)

# Pompes à main
ax.scatter(pumps['Lon'], pumps['Lat'], s=80, c='#2ECC71',
           marker='^', edgecolors='#1A8A4A', linewidths=0.8, zorder=7)

# Bâtiments communautaires
ax.scatter(bldgs['Lon'], bldgs['Lat'], s=90, c='#2C3E50',
           marker='s', edgecolors='#1A252F', linewidths=0.8, zorder=7)

# Réservoir
ax.scatter([RES_LON],[RES_LAT], s=350, c='#9B59B6', marker='*',
           edgecolors='#6C3483', linewidths=1.2, zorder=9)
ax.annotate(f'Réservoir\n{RES_ALT:.0f} m NGF',
            (RES_LON, RES_LAT), xytext=(8,8), textcoords='offset points',
            fontsize=7.5, fontweight='bold', color='#6C3483',
            bbox=dict(boxstyle='round,pad=0.3', facecolor='white',
                      edgecolor='#9B59B6', alpha=0.85))

# Étoiles des BF + étiquettes
for f in fountains:
    col = BF_COLORS[(f['n']-1) % len(BF_COLORS)]
    gravity_txt = '✓ Gravité' if f['alt'] < RES_BASE else '⚡ Pompe'
    ax.scatter([f['lon']],[f['lat']], s=420, c=col, marker='*',
               edgecolors='white', linewidths=1.5, zorder=10)
    label = (f"BF {f['n']}\n"
             f"{f['pop']} pers.\n"
             f"{f['alt']:.0f} m NGF\n"
             f"{gravity_txt}")
    ax.annotate(label, (f['lon'], f['lat']),
                xytext=(10,-28), textcoords='offset points',
                fontsize=7, fontweight='bold', color='#1A2535',
                bbox=dict(boxstyle='round,pad=0.35', facecolor='white',
                          edgecolor=col, alpha=0.92, linewidth=1.2))

# ── COLORBAR ──────────────────────────────────────────────────
cbar = fig.colorbar(topo, ax=ax, fraction=0.025, pad=0.02)
cbar.set_label('Altitude (m NGF)', fontsize=9)
cbar.ax.tick_params(labelsize=8)

# ── LÉGENDE ───────────────────────────────────────────────────
leg = [mpatches.Patch(color=BF_COLORS[i], alpha=0.8,
                      label=f"BF {f['n']} — {['Sud','Nord','Nord','Ouest','Centre'][i]} ({f['pop']} pers.)")
       for i,f in enumerate(fountains)]
leg += [
    mpatches.Patch(color='#999999',
                   label=f"Non desservi ({int(pops[unc].sum())} pers.)"),
    plt.Line2D([0],[0], marker='*',  color='w', markerfacecolor='#9B59B6',
               markersize=12, label="Château d'eau"),
    plt.Line2D([0],[0], marker='X',  color='w', markerfacecolor='#FF4444',
               markersize=8,  label='Puits contaminé'),
    plt.Line2D([0],[0], marker='^',  color='w', markerfacecolor='#2ECC71',
               markersize=9,  label='Pompe à main (propre)'),
    plt.Line2D([0],[0], color='#1A3A5C', linewidth=2.5, label='Conduite DN50 (tronc)'),
    plt.Line2D([0],[0], color='#2d6a9f',  linewidth=1.8, label='Conduite DN40 (branche)'),
    mpatches.Patch(facecolor='none', edgecolor='#CC0000', linestyle='--',
                   linewidth=1.5, label=f'Limite gravité ({RES_BASE:.0f} m NGF)'),
]
ax.legend(handles=leg, loc='lower left', fontsize=7.5,
          framealpha=0.93, edgecolor='#CCCCCC',
          title='Légende', title_fontsize=8.5)

# ── BARRE D'ÉCHELLE ───────────────────────────────────────────
sl = all_pts['Lon'].max() + 0.001
sb = all_pts['Lat'].min() - 0.0008
ax.plot([sl-0.0046, sl], [sb, sb], 'k-', linewidth=2.5)
ax.text(sl-0.0023, sb-0.0006, '500 m',
        ha='center', va='top', fontsize=8, fontweight='bold')

# ── FLÈCHE NORD ───────────────────────────────────────────────
ax.annotate('N', xy=(0.97,0.15), xycoords='axes fraction',
            fontsize=14, fontweight='bold', ha='center')
ax.annotate('', xy=(0.97,0.13), xytext=(0.97,0.07),
            xycoords='axes fraction',
            arrowprops=dict(arrowstyle='->', color='black', lw=2))

# ── TITRE ─────────────────────────────────────────────────────
ax.set_title(
    f"Solution 1 — 5 bornes-fontaines gravitaires\n"
    f"Village Guinée · {total_served}/{int(pops.sum())} habitants desservis "
    f"({100*total_served/pops.sum():.1f}%) · CAPEX estimé :  {CAPEX:,} €",
    fontsize=12, fontweight='bold', pad=12)
ax.set_xlabel('Longitude (°)', fontsize=10)
ax.set_ylabel('Latitude (°)',  fontsize=10)
ax.tick_params(labelsize=8)
ax.set_xlim(all_pts['Lon'].min()-0.003, all_pts['Lon'].max()+0.003)
ax.set_ylim(all_pts['Lat'].min()-0.002, all_pts['Lat'].max()+0.003)

# ── EXPORT ────────────────────────────────────────────────────
plt.tight_layout()
plt.savefig(OUTPUT_PNG, dpi=160, bbox_inches='tight',
            facecolor='#F8FAFF', edgecolor='none')
plt.close()
print(f"✅ Image exportée : {OUTPUT_PNG}")
print(f"   {total_served}/{int(pops.sum())} personnes desservies ({100*total_served/pops.sum():.1f}%)")
