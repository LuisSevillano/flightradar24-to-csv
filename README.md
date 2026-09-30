### FlightRadar24 to CSV

NodeJS script to download and convert [FlightRadar24](https://www.flightradar24.com) data to `tsv`, time-series `csv`, `GeoJSON`, and an `HTML` flight profile chart (altitude / speed vs time, like the FR24 one).

Video [demo](https://www.youtube.com/watch?v=8HmZG8u3OgQ) (old flow, TSV only).

## Requirements

```shell
node --version  # v16+
npm install     # installs node-fetch, d3-dsv
```

## Quick start

```shell
# 1. With flightId + timestamp (recommended, see below for how to get them)
node index.js 41e663ed 1790736300

# 2. Pasting the full URL you see in Network
node index.js "https://api.flightradar24.com/common/v1/flight-playback.json?flightId=41e663ed&timestamp=1790736300"

# 3. Offline mode (required if Cloudflare returns 403)
node index.js --file ./41e663ed.json --id 41e663ed

node index.js --help
```

Real example: flight `FZ1073` / `41e663ed` on `2026-09-30`.

## How to find `flightId` and `timestamp`

### A. From the flight page (quick)

1. Go to [FlightRadar24 Data](https://www.flightradar24.com/data), search by flight number (e.g. `FZ1073`), registration, or origin/destination.
2. In the history list, click _play_ on the flight you want.
3. Look at the URL: `flightradar24.com/data/flights/fz1073#41e663ed` — everything after `#` is the `flightId`.

### B. From the Network tab (reliable, also gives you the `timestamp`)

This is the recommended method because the current API requires both `flightId` **and** `timestamp`:

1. Open the flight on FlightRadar24 and press _play_ to start playback.
2. Open DevTools: `F12` or `Cmd+Opt+I` (Mac) / `Ctrl+Shift+I` (Win/Linux) > **Network** tab.
3. In the filter box type `flight-playback.json`.
4. You will see a request like:
   ```
   https://api.flightradar24.com/common/v1/flight-playback.json?flightId=41e663ed&timestamp=1790736300
   ```
5. There are your two values:
   - `flightId=41e663ed`
   - `timestamp=1790736300` (unix, flight date; e.g. `1790736300` = `2026-09-30T02:45:00Z`)
6. Right-click the request:
   - _Copy > Copy URL_ to use mode 2, or
   - _Save response_ as `41e663ed.json` to use offline mode.

## If it fails with 403 (Cloudflare "Just a moment...")

`api.flightradar24.com` sits behind Cloudflare. `node-fetch` cannot solve its JS challenge, so you will see:

```
HTTP 403 Forbidden
Cloudflare has blocked the request...
```

Your browser does pass it (which is why the URL works in Network). Workarounds:

**Option 1 — offline mode (most reliable):**

```shell
# 1. In Network, right-click flight-playback.json > Save response > 41e663ed.json
# 2. Convert locally, no fighting with Cloudflare:
node index.js --file ./41e663ed.json --id 41e663ed
```

**Option 2 — reuse browser cookies:**

1. In DevTools > Application > Cookies, copy your `flightradar24.com` cookie values (especially `cf_clearance`).
2. Retry:

```shell
FR24_COOKIE="cf_clearance=XXX; ..." node index.js 41e663ed 1790736300
```

This does not always work because the token expires quickly; if it fails, go back to option 1.

## What it generates (`data/` folder)

For `41e663ed_dubai_..._to_tel_aviv_...` you get 4 files:

| File | What it is for |
| ---- | -------------- |
| `.tsv` | Full track table (lat/lon, altitude, speed, heading, squawk, `timestamp` + `datetime_utc`). For Excel / QGIS. |
| `_timeseries.csv` | Clean time → altitude → speed series. Columns: `timestamp,datetime_utc,elapsed_min,altitude_ft,altitude_m,speed_kts,speed_kmh,vspeed_fpm,heading,latitude,longitude`. Best for analysis and custom charts. |
| `.geojson` | `LineString` with the trajectory + per-point properties (`timestamp`, `datetime_utc`, altitude, speed). For QGIS, kepler.gl, Mapbox. |
| `_profile.html` | Interactive FR24-style chart (blue altitude, orange speed, dual Y axis vs UTC time). Just open it in the browser, no server needed. |

`.tsv` example:

| latitude | longitude | altitude_feet | altitude_meters | speed_kmh | speed_kts | speed_mph | verticalSpeed_fpm | verticalSpeed_ms | heading | squawk | timestamp | datetime_utc |
| -------- | --------- | ------------- | --------------- | --------- | --------- | --------- | ----------------- | ---------------- | ------- | ------ | --------- | ------------ |
| 25.263597 | 55.343006 | 0 | 0 | 3.7 | 2 | 2.3 | 0 | 0 | 33 | 0 | 1790736592 | 2026-09-30T02:49:52.000Z |
| 25.263508 | 55.342953 | 0 | 0 | 3.7 | 2 | 2.3 | 0 | 0 | 30 | 0 | 1790736601 | 2026-09-30T02:50:01.000Z |

## Notes on variables

- `timestamp` is unix time in seconds. `datetime_utc` is the same instant in ISO UTC (`2026-09-30T02:49:52.000Z`). `elapsed_min` is minutes since the first point.
- **Ground speed:** `speed_kts` / `speed_kmh` / `speed_mph` are ground speed (what FR24 shows in the "speed" box). Same magnitude, different units. They come from basic ADS-B.
- Airspeed (IAS/TAS/Mach) only appears in the `ems` field (Extended Mode S) when the aircraft broadcasts it and your subscription allows it. On many flights (e.g. this FZ1073: 714 points with `ems: null`) it is missing, so it is not exported.
- `squawk 7700` = emergency. In the FZ1073 example the track ends at `28.38,36.59` with `7700` and status `diverted` (diverted to TUU/Tabuk, never reaches Tel Aviv).

## Mini analysis guide

1. **Quick profile:** open `_profile.html` and hover to see altitude/speed at each moment. Use it like the FR24 chart to spot cruise, descent, holds, or the diversion point.
2. **Excel/Sheets:** open `_timeseries.csv`, build a pivot or line chart with `datetime_utc` on X and `altitude_ft` + `speed_kts` (secondary axis) on Y.
3. **Map:** drag the `.geojson` into [kepler.gl](https://kepler.gl/demo) or QGIS to see the route and cross-check it with the profile.
4. **Cross variables:** filter by `altitude_ft > 30000` to isolate cruise, or compute `elapsed_min` between takeoff and TOD (top of descent) to compare flights.

## Limitations

- FlightRadar24 only keeps history for a few weeks/months depending on subscription; if the `flightId` is old the API returns an empty `track`.
- Direct fetching may be blocked by Cloudflare at any time; the long-term supported flow is `--file` mode.

## Terms

Please check [Flightradar24 Terms of Service](https://www.flightradar24.com/terms-and-conditions). The information provided through this repository is intended strictly for educational purposes only.
