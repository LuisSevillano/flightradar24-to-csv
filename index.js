const fetch = require("node-fetch");
const fs = require("fs");
const dsv = require("d3-dsv");
const tsvFormat = dsv.tsvFormat;
const csvFormat = dsv.csvFormat;

const API_BASE =
  "https://api.flightradar24.com/common/v1/flight-playback.json";

function printUsage() {
  console.log(`
Uso:
  node index.js <flightId> [timestamp]
  node index.js "<full-api-url-con-timestamp>"
  node index.js --file <respuesta.json> [--id <flightId>]

Ejemplos:
  node index.js 41e663ed 1790736300
  node index.js "https://api.flightradar24.com/common/v1/flight-playback.json?flightId=41e663ed&timestamp=1790736300"
  node index.js --file ./41e663ed.json --id 41e663ed

Si el fetch directo da 403 (Cloudflare):
  1. Abre en Chrome la URL que ves en Network (la que ya te funciona).
  2. Click derecho sobre la petición flight-playback.json > Save response / Guardar respuesta como 41e663ed.json
     (o en Preview > copiar y pegar en un fichero).
  3. Corre: node index.js --file ./41e663ed.json --id 41e663ed

También puedes pasar cookies del navegador si lo necesitas:
  FR24_COOKIE="cf_clearance=XXX; ..." node index.js 41e663ed 1790736300
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  // Modo offline: --file <path> [--id <flightId>]
  const fileIdx = args.indexOf("--file");
  if (fileIdx !== -1) {
    const filePath = args[fileIdx + 1];
    if (!filePath) {
      console.error("Falta la ruta después de --file");
      printUsage();
      process.exit(1);
    }
    const idIdx = args.indexOf("--id");
    const flightId = idIdx !== -1 && args[idIdx + 1] ? args[idIdx + 1] : "fromfile";
    return { mode: "file", filePath, flightId };
  }

  // Acepta URL completa o flightId suelto
  let flightId = args[0];
  let timestamp = args[1];

  if (/^https?:\/\//.test(flightId)) {
    try {
      const u = new URL(flightId);
      const qFlightId = u.searchParams.get("flightId");
      const qTimestamp = u.searchParams.get("timestamp");
      if (qFlightId) flightId = qFlightId;
      if (qTimestamp) timestamp = qTimestamp;
    } catch (e) {
      console.error("URL no válida:", e.message);
      process.exit(1);
    }
  }

  // Limpia flightId por si viene con # o espacios
  flightId = String(flightId).trim().split("#").pop().trim();

  if (!/^[0-9a-fA-F]+$/.test(flightId)) {
    console.warn(
      `Aviso: flightId "${flightId}" no parece hexadecimal, sigo igualmente...`
    );
  }

  if (timestamp) {
    timestamp = String(timestamp).trim();
    if (!/^\d+$/.test(timestamp)) {
      console.error(`timestamp "${timestamp}" no es un unix timestamp válido.`);
      process.exit(1);
    }
  }

  return { mode: "fetch", flightId, timestamp };
}

function buildUrl(flightId, timestamp) {
  let url = `${API_BASE}?flightId=${encodeURIComponent(flightId)}`;
  if (timestamp) url += `&timestamp=${encodeURIComponent(timestamp)}`;
  return url;
}

function buildHeaders() {
  const headers = {
    // Cloudflare filtra por TLS + headers. Sin un navegador real suele devolver
    // 403 "Just a moment...". Estos headers ayudan pero no garantizan el bypass.
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
    Origin: "https://www.flightradar24.com",
    Referer: "https://www.flightradar24.com/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    // client hints que Chrome envía de verdad
    "sec-ch-ua": '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"'
  };
  if (process.env.FR24_COOKIE) {
    headers.Cookie = process.env.FR24_COOKIE;
  }
  return headers;
}

function clearPropName(data, prop) {
  const reg = /\s/gi;
  if (data.airport && data.airport[prop] && data.airport[prop].name) {
    return data.airport[prop].name.toLowerCase().replace(reg, "_");
  }
  // Estructura alternativa que a veces devuelve la API
  if (data.airport && data.airport[prop] && data.airport[prop].code) {
    const c = data.airport[prop].code.iata || data.airport[prop].code.icao;
    if (c) return String(c).toLowerCase();
  }
  return "unknown";
}

function getNested(obj, path, fallback = null) {
  return path.reduce(
    (acc, k) => (acc != null && acc[k] != null ? acc[k] : null),
    obj
  ) ?? fallback;
}

function buildTimeSeries(track) {
  const sorted = [...track]
    .filter(d => d && d.timestamp != null)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (!sorted.length) return [];
  const t0 = sorted[0].timestamp;
  return sorted.map(d => {
    const ts = d.timestamp;
    const altFt = getNested(d, ["altitude", "feet"], null);
    const altM = getNested(d, ["altitude", "meters"], null);
    const spdKts = getNested(d, ["speed", "kts"], null);
    const spdKmh = getNested(d, ["speed", "kmh"], null);
    const vsFpm = getNested(d, ["verticalSpeed", "fpm"], null);
    return {
      timestamp: ts,
      datetime_utc: new Date(ts * 1000).toISOString(),
      elapsed_min: +((ts - t0) / 60).toFixed(2),
      altitude_ft: altFt,
      altitude_m: altM,
      speed_kts: spdKts,
      speed_kmh: spdKmh,
      vspeed_fpm: vsFpm,
      heading: d.heading ?? null,
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null
    };
  });
}

function buildProfileHtml({ flightId, flightLabel, originName, destName, series }) {
  const t0 = series[0]?.datetime_utc || "";
  const t1 = series[series.length - 1]?.datetime_utc || "";
  const esc = s =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const dataJson = JSON.stringify(
    series.map(r => ({ t: r.datetime_utc, alt: r.altitude_ft, spd: r.speed_kts }))
  ).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(flightLabel)} (${esc(flightId)})</title>
<style>
  html, body { background: #000; color: #fff; }
  body { font-family: monospace; margin: 24px; }
  p { font-size: 13px; line-height: 1.6; }
  figure { margin: 24px 0; }
  figcaption { font-size: 12px; margin-bottom: 6px; }
  [aria-label="tip"] rect, g.tip rect { fill: #fff; stroke: #fff; }
  [aria-label="tip"] text, g.tip text { fill: #000; }
</style>
</head>
<body>
<p>${esc(flightLabel)} &middot; ${esc(originName)} &rarr; ${esc(destName)}<br>flightId ${esc(flightId)} &middot; ${series.length} points &middot; ${esc(t0)} &rarr; ${esc(t1)}</p>
<figure><figcaption>Altitude (ft) vs time (UTC)</figcaption><div id="alt"></div></figure>
<figure><figcaption>Speed (kts) vs time (UTC)</figcaption><div id="spd"></div></figure>
<script type="module">
import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/+esm";
const data = ${dataJson}.map(d => ({...d, t: new Date(d.t)}));
const dark = {background: "#000", color: "#fff"};
document.getElementById("alt").appendChild(Plot.plot({
  style: dark,
  width: 900,
  height: 300,
  marginLeft: 70,
  x: {type: "time", label: "UTC"},
  y: {label: "Altitude (ft)", grid: true},
  marks: [
    Plot.areaY(data, {x: "t", y: "alt", fill: "#4a90e2", fillOpacity: 0.3}),
    Plot.lineY(data, {x: "t", y: "alt", stroke: "#4a90e2", strokeWidth: 1.5}),
    Plot.ruleY([0]),
    Plot.tip(data, Plot.pointerX({x: "t", y: "alt", title: d => d.t.toISOString() + "\\n" + (d.alt ?? "—") + " ft"}))
  ]
}));
document.getElementById("spd").appendChild(Plot.plot({
  style: dark,
  width: 900,
  height: 260,
  marginLeft: 70,
  x: {type: "time", label: "UTC"},
  y: {label: "Speed (kts)", grid: true},
  marks: [
    Plot.lineY(data, {x: "t", y: "spd", stroke: "#e2a63d", strokeWidth: 1.5}),
    Plot.ruleY([0]),
    Plot.tip(data, Plot.pointerX({x: "t", y: "spd", title: d => d.t.toISOString() + "\\n" + (d.spd ?? "—") + " kts"}))
  ]
}));
</script>
</body>
</html>`;
}

function convertAndSave(flight, flightId) {
  const track = flight.track;
  if (!track || !track.length) {
    console.log("Flight data not found (track vacío o ausente).");
    console.log(
      "Si el vuelo es muy antiguo o el flightId/timestamp no cuadran, la API devuelve track vacío."
    );
    return;
  }

  const csv = [];

  track.forEach(function(d) {
    const row = {},
      keys = Object.keys(d);

    keys.forEach(function(str) {
      if (typeof d[str] == "object" && d[str] != null) {
        const subKeys = Object.keys(d[str]);

        subKeys.forEach(function(subKey) {
          row[str + "_" + subKey] = d[str][subKey];
        });
      } else if (d[str] != null) {
        row[str] = d[str];
      }
    });

    // timestamp -> datetime legible (UTC ISO). Se mantiene el unix original.
    if (row.timestamp != null && row.timestamp !== "") {
      const ts = Number(row.timestamp);
      if (Number.isFinite(ts)) {
        row.datetime_utc = new Date(ts * 1000).toISOString();
      }
    }

    csv.push(row);
  });

  // Export to GeoJSON
  const geojson = {};
  geojson["type"] = "FeatureCollection";
  geojson["features"] = [];

  const coordinates = [],
    properties = [];

  track.forEach(function(e) {
    if (e.longitude == null || e.latitude == null) return;
    const pair = [];
    pair.push(e.longitude);
    pair.push(e.latitude);
    coordinates.push(pair);
    properties.push({
      altitude: e.altitude,
      verticalSpeed: e.verticalSpeed,
      speed: e.speed,
      timestamp: e.timestamp,
      datetime_utc:
        e.timestamp != null
          ? new Date(Number(e.timestamp) * 1000).toISOString()
          : null,
      heading: e.heading
    });
  });

  const feature = {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: coordinates
    },
    properties: {
      flightId: flightId,
      points: properties
    }
  };

  geojson["features"].push(feature);

  // parsing as tsv file
  const csvFormated = tsvFormat(csv);

  /// get origin and destination names to use them in file name
  const origin = clearPropName(flight, "origin");
  const dest = clearPropName(flight, "destination");

  // Serie temporal altitud/velocidad vs tiempo (como el gráfico de FR24)
  const series = buildTimeSeries(track);
  const seriesCsv = csvFormat(series);

  const flightLabel =
    (flight.identification &&
      (flight.identification.number?.default ||
        flight.identification.callsign)) ||
    flightId;
  const originName =
    flight.airport?.origin?.name || flight.airport?.origin?.code?.iata || origin;
  const destName =
    flight.airport?.destination?.name ||
    flight.airport?.real?.name ||
    flight.airport?.destination?.code?.iata ||
    dest;
  const profileHtml = buildProfileHtml({
    flightId,
    flightLabel,
    originName,
    destName,
    series
  });

  if (!fs.existsSync("data")) {
    fs.mkdirSync("data", { recursive: true });
  }

  const fileName = `${flightId}_${origin}_to_${dest}`;
  fs.writeFile(`data/${fileName}.tsv`, csvFormated, function(err) {
    if (err) console.log("error", err);
    else console.log(`File data/${fileName}.tsv written successfully`);
  });
  fs.writeFile(
    `data/${fileName}.geojson`,
    JSON.stringify(geojson),
    function(err) {
      if (err) console.log("error", err);
      else console.log(`File data/${fileName}.geojson written successfully`);
    }
  );
  fs.writeFile(`data/${fileName}_timeseries.csv`, seriesCsv, function(err) {
    if (err) console.log("error", err);
    else
      console.log(
        `File data/${fileName}_timeseries.csv written successfully (${series.length} puntos: tiempo, altitud, velocidad)`
      );
  });
  fs.writeFile(`data/${fileName}_profile.html`, profileHtml, function(err) {
    if (err) console.log("error", err);
    else
      console.log(
        `File data/${fileName}_profile.html written successfully (gráfico altitud/velocidad estilo FR24, ábrelo en el navegador)`
      );
  });
}

async function runFetch(flightId, timestamp) {
  const jsonURL = buildUrl(flightId, timestamp);
  console.log("Fetching:", jsonURL);

  let res;
  try {
    res = await fetch(jsonURL, { method: "GET", headers: buildHeaders() });
  } catch (err) {
    console.error("Error de red:", err.message);
    process.exit(1);
  }

  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`HTTP ${res.status} ${res.statusText}`);
    if (res.status === 403 || body.includes("Just a moment")) {
      console.error(`
Cloudflare ha bloqueado la petición (403 "Just a moment...").
node-fetch no resuelve el challenge JS de Cloudflare, pero tu navegador sí
(por eso ves la URL funcionando en Network).

Solución rápida para tu vuelo fz1073 / 41e663ed:
  1. En DevTools > Network, click derecho en:
       ${jsonURL}
     > "Save response" y guárdalo como 41e663ed.json
  2. Luego corre:
       node index.js --file ./41e663ed.json --id 41e663ed

Alternativa: exporta las cookies del navegador y reintenta:
  FR24_COOKIE="copia_de_tus_cookies" node index.js ${flightId}${timestamp ? " " + timestamp : ""}
`);
    } else {
      console.error(body.slice(0, 2000));
    }
    process.exit(1);
  }

  if (!contentType.includes("json")) {
    const body = await res.text();
    if (body.includes("Just a moment") || body.startsWith("<!DOCTYPE")) {
      console.error(`
La API devolvió HTML en vez de JSON (Cloudflare challenge).
Guarda la respuesta desde el navegador y usa el modo offline:
  node index.js --file ./41e663ed.json --id ${flightId}
`);
    } else {
      console.error("Respuesta inesperada (no JSON):", body.slice(0, 1000));
    }
    process.exit(1);
  }

  let json;
  try {
    json = await res.json();
  } catch (err) {
    console.error("No se pudo parsear el JSON:", err.message);
    process.exit(1);
  }

  const flight =
    json &&
    json.result &&
    json.result.response &&
    json.result.response.data &&
    json.result.response.data.flight;

  if (!flight) {
    console.error("Flight data not found. Respuesta:");
    console.error(JSON.stringify(json).slice(0, 2000));
    process.exit(1);
  }

  convertAndSave(flight, flightId);
}

function runFile(filePath, flightId) {
  if (!fs.existsSync(filePath)) {
    console.error(`Fichero no encontrado: ${filePath}`);
    process.exit(1);
  }
  let json;
  try {
    json = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error("No se pudo leer/parsear el fichero:", err.message);
    process.exit(1);
  }
  const flight =
    (json.result &&
      json.result.response &&
      json.result.response.data &&
      json.result.response.data.flight) ||
    json.flight ||
    json.data?.flight ||
    json;
  if (!flight.track) {
    console.error(
      "El JSON no contiene .result.response.data.flight.track. ¿Guardaste la respuesta completa de flight-playback.json?"
    );
    process.exit(1);
  }
  // Si el usuario no pasó --id, intenta deducirlo del nombre del fichero
  if (flightId === "fromfile") {
    const m = filePath.match(/([0-9a-fA-F]{6,})/);
    if (m) flightId = m[1];
  }
  convertAndSave(flight, flightId);
}

(function main() {
  const parsed = parseArgs(process.argv);
  if (parsed.mode === "file") {
    runFile(parsed.filePath, parsed.flightId);
  } else {
    runFetch(parsed.flightId, parsed.timestamp);
  }
})();
