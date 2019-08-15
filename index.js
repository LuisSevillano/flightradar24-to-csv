const fs = require("fs"),
  d3 = require("d3"),
  mkdirp = require("mkdirp");

const flightId = process.argv[2] || "21b090f8", // example
  url =
    "https://api.flightradar24.com/common/v1/flight-playback.json?flightId=",
  jsonURL = url + flightId;

d3.queue()
  .defer(d3.json, jsonURL)
  .await(function(err, json) {
    if (err) throw err;

    const data = json.result.response.data.flight,
      track = data.track;
    if (track) {
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

        csv.push(row);
      });

      // Export to GeoJSON
      const geojson = {};
      geojson["type"] = "FeatureCollection";
      geojson["features"] = [];

      const coordinates = [],
        properties = [];

      track.forEach(function(e) {
        const pair = [];
        pair.push(e.longitude);
        pair.push(e.latitude);
        coordinates.push(pair);
        properties.push({
          altitude: e.altitude,
          verticalSpeed: e.verticalSpeed,
          speed: e.speed
        });
      });

      const feature = {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: coordinates
        },
        properties: properties
      };

      geojson["features"].push(feature);

      // parsing as tsv file
      const csvFormated = d3.tsvFormat(csv);

      mkdirp("data", function(err) {
        if (err) console.error(err);
        else {
          fs.writeFile(`data/${flightId}.tsv`, csvFormated);
          fs.writeFile(`data/${flightId}.geojson`, JSON.stringify(geojson));
        }
      });
    } else {
      console.log("Flight data not found");
    }
  });
