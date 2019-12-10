const fetch = require("node-fetch");
const fs = require("fs");
const tsvFormat = require("d3-dsv").tsvFormat;
const mkdirp = require("mkdirp");

const settings = { method: "Get" };
const flightId = process.argv[2] || "21b736e8", // example
  url =
    "https://api.flightradar24.com/common/v1/flight-playback.json?flightId=",
  jsonURL = url + flightId;

fetch(jsonURL, settings)
  .then(res => res.json())
  .then(json => {
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
      const csvFormated = tsvFormat(csv);

      /// get origin and destination names to use them in file name
      const origin = clearPropName("origin");
      const dest = clearPropName("destination");

      mkdirp("data", function(err) {
        if (err) console.error(err);
        else {
          const fileName = `${flightId}_${origin}_to_${dest}`;
          fs.writeFile(`data/${fileName}.tsv`, csvFormated, function(
            err,
            result
          ) {
            if (err) console.log("error", err);
            else console.log(`File ${fileName}.tsv written successfully`);
          });
          fs.writeFile(
            `data/${fileName}.geojson`,
            JSON.stringify(geojson),

            function(err, result) {
              if (err) console.log("error", err);
              else console.log(`File ${fileName}.geojson written successfully`);
            }
          );
        }
      });
    } else {
      console.log("Flight data not found");
    }

    // clear property name, replace spaces, etc.
    function clearPropName(prop) {
      const reg = /\s/gi;
      if (data.airport[prop] && data.airport[prop].name) {
        return data.airport[prop].name.toLowerCase().replace(reg, "_");
      }
      return "unknown";
    }
  })
  .catch(err => console.log(err));
