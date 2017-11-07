var fs = require('fs'),
    d3 = require('d3'),
    mkdirp = require('mkdirp'),
    csv2geojson = require('csv2geojson');

var flightId = 'f71049c',
    url = 'https://api.flightradar24.com/common/v1/flight-playback.json?flightId=',
    jsonURL = url + flightId;

d3.queue()
    .defer(d3.json, jsonURL)
    .await(function(err, json) {
        if (err) throw err;

        var data = json.result.response.data.flight,
            track = data.track,
            csv = [];

        track.forEach(function(d) {

            var row = {},
                keys = Object.keys(d);

            keys.forEach(function(str) {

                if ((typeof d[str] == 'object') && d[str] != null) {

                    var subKeys = Object.keys(d[str]);

                    subKeys.forEach(function(subKey) {

                        row[str + "_" + subKey] = d[str][subKey];

                    })

                } else if (d[str] != null) {

                    row[str] = d[str];

                }
            })

            csv.push(row);
        })

        // parsing as tsv file
        var csvFormated = d3.tsvFormat(csv);
        
        // export as geojson
        csv2geojson.csv2geojson(csvFormated, {
            latfield: 'latitude',
            lonfield: 'longitude',
            delimiter: '\t'
        }, function(err, geojson) {
            if (err) console.log(err);

            mkdirp('data', function(err) {
                if (err) console.error(err)
                else {
                    fs.writeFile('data/data.tsv', csvFormated);
                    fs.writeFile('data/data.geojson', JSON.stringify(geojson));
                }
            });
        });


    })
