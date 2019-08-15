### FlightRadar24 to CSV

NodeJS script to download and parse data from [Flight Radar](https://www.flightradar24.com) in `tsv` and `GeoJSON` format.  
To generate the files:

- If the aircraft number is known modify the value of `flightId` variable in the `index.js` script and run `npm install` or just run `node index.js` followed by the `flightId`. For example:
```shell
$ node index.js 21b090f8
```

- If just know the flight number but not the `flightId` use [FlightRadar24](https://www.flightradar24.com/data) data portal to get it:
  1. Search by flight number id, by aircraft, origin/destination airport etc.
  1. Click on _play_ on the desired flight in the Flight history list.
  1. Get the value from URL after the `#` symbol: _flightradar24.com/data/flights/vy1292#**21b394f6**_
  1. Finally run `node index.js flightId`.

After the `script` you will get a folder with the files inside.

| latitude   | longitude    | altitude_feet | altitude_meters | speed_kmh | speed_kts | speed_mph | verticalSpeed_fpm | verticalSpeed_ms | heading | squawk | timestamp  |
| ---------- | ------------ | ------------- | --------------- | --------- | --------- | --------- | ----------------- | ---------------- | ------- | ------ | ---------- |
| 33\.643417 | \-84\.441605 | 0             | 0               | 18\.5     | 10        | 11\.5     | 0                 | 0                | 278     | 0      | 1509928818 |
| 33\.643372 | \-84\.441307 | 0             | 0               | 18\.5     | 10        | 11\.5     | 0                 | 0                | 317     | 0      | 1509928839 |
| 33\.643661 | \-84\.441185 | 0             | 0               | 35\.2     | 19        | 21\.9     | 0                 | 0                | 357     | 7144   | 1509929041 |

```
{
   "type":"FeatureCollection",
   "features":[
      {
         "type":"Feature",
         "geometry":{
            "type":"LineString",
            "coordinates":[
               [
                  0.225525,
                  51.878933
               ]
...
```
## Note:

The default value of this tool gets the data from the `DL1680` flight that flies from Atlanta to San Francisco. FlightRadar24 keeps only the data for a few weeks so it's likely when you use this script with the default example it won't work properly.
