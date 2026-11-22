# -*- coding: utf-8 -*-
"""从 NOAA GML 四份 CSV + OWID 全球排放数据生成站点所需 JSON。可重复运行。"""
import json, csv, statistics, urllib.request, os
from collections import defaultdict

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(ROOT)
OUT = os.path.join(ROOT, "data")
os.makedirs(OUT, exist_ok=True)

UNITS = {"co2": "ppm", "ch4": "ppb", "n2o": "ppb", "sf6": "ppt"}
FILES = {"co2": "co2_mm_gl.csv", "ch4": "ch4_mm_gl.csv",
         "n2o": "n2o_mm_gl.csv", "sf6": "sf6_mm_gl.csv"}
PPM_TO_GTCO2 = 7.82  # 1 ppm 大气 CO2 ≈ 7.82 GtCO2


def load_noaa(fname):
    rows = []
    with open(os.path.join(SRC, fname), encoding="utf-8") as f:
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            p = line.strip().split(",")
            if len(p) == 7 and p[0].isdigit():
                rows.append({"year": int(p[0]), "month": int(p[1]),
                             "decimal": float(p[2]), "avg": float(p[3]),
                             "avg_unc": float(p[4]), "trend": float(p[5]),
                             "trend_unc": float(p[6])})
    return rows


def annual(rows):
    d = defaultdict(list)
    for r in rows:
        d[r["year"]].append(r["avg"])
    return {y: statistics.mean(v) for y, v in d.items() if len(v) == 12}


def seasonal_amplitude(rows):
    """每年 (月均 - 该月趋势) 的季节距平峰谷差，即季节振幅。"""
    d = defaultdict(list)
    for r in rows:
        d[r["year"]].append(r["avg"] - r["trend"])
    out = {}
    for y, v in d.items():
        if len(v) == 12:
            out[y] = round(max(v) - min(v), 3)
    return out


# ---------- 读取四气体 ----------
gas = {}
for k, fn in FILES.items():
    rows = load_noaa(fn)
    ann = annual(rows)
    gas[k] = {
        "unit": UNITS[k],
        "monthly": [[round(r["decimal"], 3), r["avg"], r["trend"]] for r in rows],
        "annual": [[y, round(ann[y], 2)] for y in sorted(ann)],
        "amplitude": [[y, seasonal_amplitude(rows)[y]] for y in sorted(seasonal_amplitude(rows))],
        "first": round(rows[0]["avg"], 2),
        "last": round(rows[-1]["avg"], 2),
        "first_year": rows[0]["year"],
        "last_year": rows[-1]["year"],
    }

# ---------- OWID 排放数据 ----------
def load_emissions():
    cache = os.path.join(OUT, "_owid_world_emissions.csv")
    if os.path.exists(cache):
        with open(cache, encoding="utf-8") as f:
            return {int(r["year"]): r for r in csv.DictReader(f)}
    rawpath = os.path.join(OUT, "_owid_raw.csv")
    if os.path.exists(rawpath):
        with open(rawpath, encoding="utf-8", errors="ignore") as f:
            raw = f.read()
    else:
        url = "https://cdn.jsdelivr.net/gh/owid/co2-data@master/owid-co2-data.csv"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        raw = urllib.request.urlopen(req, timeout=120).read().decode("utf-8", errors="ignore")
    import io
    world = {}
    for r in csv.DictReader(io.StringIO(raw)):
        if r.get("country") == "World" and r.get("year"):
            world[int(r["year"])] = r
    keep = ["year", "co2", "co2_including_luc", "co2_growth_abs", "coal_co2", "oil_co2", "gas_co2"]
    with open(cache, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=keep)
        w.writeheader()
        for y in sorted(world):
            w.writerow({k: world[y].get(k, "") for k in keep})
    return world


emis = load_emissions()
co2ann = dict((y, v) for y, v in gas["co2"]["annual"])

# 大气 CO2 增量（ppm/yr）→ GtCO2，与排放对齐计算滞留比例
growth = []
for y in sorted(co2ann):
    if y - 1 not in co2ann or y not in emis:
        continue
    dppm = co2ann[y] - co2ann[y - 1]
    atm_gt = dppm * PPM_TO_GTCO2
    e = emis[y]
    fossil = float(e["co2"]) / 1000.0 if e.get("co2") else None      # GtCO2
    incl = float(e["co2_including_luc"]) / 1000.0 if e.get("co2_including_luc") else None
    if fossil is None or incl is None or fossil <= 0:
        continue
    growth.append({
        "year": y,
        "dppm": round(dppm, 3),
        "atm_gtco2": round(atm_gt, 2),
        "fossil": round(fossil, 2),
        "incl_luc": round(incl, 2),
        "af_fossil": round(atm_gt / fossil, 4),
        "af_incl": round(atm_gt / incl, 4),
    })

payload = {
    "meta": {
        "source": "NOAA GML 全球月均温室气体序列 + Our World in Data / Global Carbon Budget 全球排放",
        "ppm_to_gtco2": PPM_TO_GTCO2,
        "generated": "2026-11-19",
        "note": "末段数据为初值，会随标准气重新定标修订。",
    },
    "gases": gas,
    "growth": growth,
}
with open(os.path.join(OUT, "climate.json"), "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

print("gases:", {k: (len(v["monthly"]), len(v["annual"])) for k, v in gas.items()})
print("co2 amplitude sample:", gas["co2"]["amplitude"][:3], "...", gas["co2"]["amplitude"][-3:])
print("growth rows:", len(growth), "sample:", growth[0], "...", growth[-1])
print("size:", os.path.getsize(os.path.join(OUT, "climate.json")), "bytes")
