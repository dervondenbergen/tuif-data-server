const got = require("got");
const queryString = require("query-string");

async function loadData(stations) {
  try {
    const response = await got(
      "https://api.citybik.es/v2/networks/citybike-wien"
    );

    const body = JSON.parse(response.body);

    if (body.network) {
      bikestations = body.network.stations;

      data = {};

      bikestations
        .filter(function(station) {
          return ~stations.indexOf(station.id);
        })
        .forEach(function(station) {
          data[station.id] = station.free_bikes;
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

//loadData(["30865b5a6af188b6560f668c3bc800d4"]);
// loadData([1487, 1486]);

module.exports = loadData;
