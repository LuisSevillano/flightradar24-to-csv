var fs = require("fs"),
  d3 = require("d3"),
  mkdirp = require("mkdirp");

var flightId = "10a8f128",
  url =
    "https://api.flightradar24.com/common/v1/flight-playback.json?flightId=",
  jsonURL = url + flightId;

d3
  .queue()
  .defer(d3.json, jsonURL)
  .await(function(err, json) {
    if (err) throw err;

    var data = json.result.response.data.flight,
      track = data.track;
    if (track) {
      var csv = [];

      track.forEach(function(d) {
        var row = {},
          keys = Object.keys(d);

        keys.forEach(function(str) {
          if (typeof d[str] == "object" && d[str] != null) {
            var subKeys = Object.keys(d[str]);

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
      var geojson = {};
      geojson["type"] = "FeatureCollection";
      geojson["features"] = [];

      var coordinates = [],
        properties = [];

      track.forEach(function(e) {
        var pair = [];
        pair.push(e.longitude);
        pair.push(e.latitude);
        coordinates.push(pair);
        properties.push({
          altitude: e.altitude,
          verticalSpeed: e.verticalSpeed,
          speed: e.speed
        });
      });

      var feature = {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: coordinates
        },
        properties: properties
      };

      geojson["features"].push(feature);

      // parsing as tsv file
      var csvFormated = d3.tsvFormat(csv);

      mkdirp("data", function(err) {
        if (err) console.error(err);
        else {
          fs.writeFile("data/data.tsv", csvFormated);
          fs.writeFile("data/data.geojson", JSON.stringify(geojson));
        }
      });
    } else {
      console.log("Flight data not found");
    }
  });
