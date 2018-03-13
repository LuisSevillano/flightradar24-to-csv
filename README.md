### FlightRadar24 to CSV

A `nodejs` script to download and parse data from [Flight Radar](https://www.flightradar24.com) in `tsv` and `GeoJSON` format.  
To get the files with flight data:

* If the aircraft number is known modify the value of `flightId` variable in the `index.js` script and run `npm install` .
* If just know the flight number use [FlightRadar24](https://www.flightradar24.com/data) site to get it:
  * Search by flight number id.
  * Click on _play_ on the desired flight in the Flight history list.
  * Copy the value from URL after the `#` symbol.
  * Finally run `npm install`.

After the `script` you will get a folder with the files inside.

Some information about this script:

* The default value of this tool gets the data from the `DL1680` flight that flies from Atlanta to San Francisco. FlightRadar24 keeps only the data for a few weeks so it's likely when you use this script with the default example it won't work properly.

```csv
latitude	longitude	altitude_feet	altitude_meters	speed_kmh	speed_kts	speed_mph	verticalSpeed_fpm	verticalSpeed_ms	heading	squawk	timestamp
33.643417	-84.441605	0	0	18.5	10	11.5	0	0	278	0	1509928818
33.643372	-84.441307	0	0	18.5	10	11.5	0	0	317	0	1509928839
33.643661	-84.441185	0	0	35.2	19	21.9	0	0	357	7144	1509929041
```
