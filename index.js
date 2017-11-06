var fs = require('fs'),
    d3 = require('d3'),
    mkdirp = require('mkdirp');

var flightId = 'f71049c',
    url = 'https://api.flightradar24.com/common/v1/flight-playback.json?flightId=',
    jsonURL = url + flightId;

d3.queue()
    .defer(d3.json, jsonURL)
    .await(function(error, json) {
        if (error) throw error;

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

        mkdirp('data', function(err) {
            if (err) console.error(err)
            else fs.writeFile('data/data.tsv', d3.tsvFormat(csv));
        });

    })
