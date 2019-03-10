try {
  var clear = require("clear");
  // do stuff
} catch (ex) {
  function clear() {
    console.log("\n");
  }
}

const mosca = require("mosca");
const loadData = require("./datasource");
const config = require("./config.js");

var settings = {
  port: config.server.port,
  persistence: {
    factory: mosca.persistence.Memory
  }
};

var clients = {};
var stations = {
  wl: [],
  cb: []
};
var data = {};

var server = new mosca.Server(settings);

server.on("error", function(err) {
  console.log(err);
});

server.on("clientConnected", function(client) {
  clients[client.id] = { wl: [], cb: [] };
  console.log(`New client ${client.id} connected.`);
  showState();
});

server.on("published", function(packet, client) {
  // if (packet.topic === "get") {
  //   Object.keys(client.subscriptions).forEach(function(topic) {
  //     var [stationType, stationId] = topic.split("/");
  //     if (stationType === "cb") {
  //       server.publish({
  //         topic: topic,
  //         payload: data.cb[stationId],
  //         retain: true
  //       });
  //     }
  //   });
  // }
});

const topicRegex = /^(wl|cb)\/(\d+\/|(\w|\d){32})/i;

server.on("subscribed", function(topic, client) {
  if (topicRegex.test(topic)) {
    var [stationType, stationId] = topic.split("/");
    clients[client.id][stationType].push(stationId);
  }
  console.log(`Client ${client.id} subscribed to '${topic}'.`);
  showState();
});

server.on("unsubscribed", function(topic, client) {
  if (topicRegex.test(topic)) {
    var [stationType, stationId] = topic.split("/");
    subscriptionIdx = clients[client.id][stationType].indexOf(stationId);
    clients[client.id][stationType].splice(subscriptionIdx, 1);
  }
  console.log(`Client ${client.id} unsubscribed from '${topic}'.`);
  showState();
});

server.on("clientDisconnected", function(client) {
  delete clients[client.id];
  console.log(`Client ${client.id} disconnected.`);
  showState();
});

server.on("ready", setup);

// fired when the mqtt server is ready
function setup() {
  console.log("Mosca server is up and running");
}

function showState() {
  // clear();
  if (config.server.logging) {
    console.log("–––––––––––––––––––––––––––––––––––––––");
    console.log(JSON.stringify({ clients }, null, 2));
    console.log(JSON.stringify({ stations }, null, 2));
    console.log(JSON.stringify({ data }, null, 2));
  }
}

function updateStations() {
  wlStations = Object.keys(clients).reduce(function(arr, client, index) {
    return arr.concat(clients[client].wl);
  }, []);
  stations.wl = [...new Set(wlStations)];

  cbStations = Object.keys(clients).reduce(function(arr, client, index) {
    return arr.concat(clients[client].cb);
  }, []);
  stations.cb = [...new Set(cbStations)];
}

function updateData(type, rbl, line) {}

function checkChanges(type, oldData, newData) {
  if (type == "wl") {
    for (const rbl in oldData) {
      const oldRbl = oldData[rbl];
      const newRbl = newData[rbl];

      if (oldRbl && newRbl) {
        for (const line in oldRbl) {
          const oldTimesString = getDataString(oldRbl[line]);
          const newTimesString = getDataString(newRbl[line]);
          const newTimes = newRbl[line].map(function(departure) {
            return departure.time;
          });

          // console.log(newRbl[line]);

          console.log(
            rbl,
            line,
            oldTimesString,
            newTimesString,
            oldTimesString === newTimesString ? "Same" : "Update"
          );

          if (oldTimesString !== newTimesString) {
            server.publish({
              topic: `wl/${rbl}/${line}`,
              payload: JSON.stringify(newTimes),
              retain: true
            });
          }
        }
      }
    }
  }

  if (type == "cb") {
    for (const stationid in newData) {
      const newStation = newData[stationid];
      if (oldData) {
        const oldStation = oldData[stationid];

        if (oldStation !== undefined && newStation !== undefined) {
          if (oldStation !== newStation) {
            server.publish({
              topic: `cb/${stationid}`,
              payload: JSON.stringify([newStation]),
              retain: true
            });
          }
        } else {
          server.publish({
            topic: `cb/${stationid}`,
            payload: JSON.stringify([newStation]),
            retain: true
          });
        }
      } else {
        server.publish({
          topic: `cb/${stationid}`,
          payload: JSON.stringify([newStation]),
          retain: true
        });
      }
    }
  }
}

function getDataString(times) {
  return JSON.stringify(
    times.map(function(departure) {
      // return [departure.time, +departure.barrierFree ? "T" : "F"].join("");
      return departure.time;
    })
  );
  // .join(",");
}

async function getData() {
  if (stations.wl.length > 0) {
    wlData = await loadData.wl(stations.wl);
    if (!wlData.error) {
      checkChanges("wl", data.wl, wlData);
      data.wl = wlData;
    }
  } else {
    delete data.wl;
  }

  if (stations.cb.length > 0) {
    cbData = await loadData.cb(stations.cb);
    if (!cbData.error) {
      checkChanges("cb", data.cb, cbData);
      data.cb = cbData;
    }
  } else {
    delete data.cb;
  }
}

setInterval(function loop() {
  updateStations();

  showState();
}, 5000);

setInterval(getData, 5000);
