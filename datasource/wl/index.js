const got = require("got");
const queryString = require("query-string");

const config = require("../../config.js");

async function loadData(stations) {
  try {
    const query = queryString.stringify({
      rbl: stations,
      sender: config.wl.secret,
      activateTrafficInfo: ["stoerunglang", "stoerungkurz"]
    });

    const response = await got(
      "https://www.wienerlinien.at/ogd_realtime/monitor",
      { query }
    );

    const body = JSON.parse(response.body);

    if (body.message.messageCode === 1) {
      monitors = body.data.monitors;

      // Infos zu verspätungen und welche Linies es betrifft
      // trafficInfos = body.data.trafficInfos

      data = {};

      monitors.forEach(function(monitor) {
        rbl = monitor.locationStop.properties.attributes.rbl;

        data[rbl] = data[rbl] || {};

        lines = monitor.lines.forEach(function(line) {
          departures = [];

          departureCount =
            line.departures.departure.length > 2
              ? 2
              : line.departures.departure.length;

          for (let index = 0; index < departureCount; index++) {
            var d = {};

            departure = line.departures.departure[index];

            d.barrierFree = departure.vehicle
              ? departure.vehicle.barrierFree
              : line.barrierFree;
            d.time = departure.departureTime.countdown;

            departures.push(d);
          }

          data[rbl][line.name] = departures;
        });
      });

      return data;
    } else {
      return { error: true };
    }
  } catch (error) {
    console.log(error);
    return { error: true };
    //=> 'Internal server error ...'
  }
}

// loadData([1375]);
// loadData([1487, 1486]);

module.exports = loadData;
