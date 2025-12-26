const express = require("express");
const aedes = require("aedes")();
const net = require("net");
const http = require("http");
const socketIo = require("socket.io");
const mqtt = require("mqtt");

const app = express();
const httpServer = http.createServer(app);
const io = socketIo(httpServer, { cors: { origin: "*" } });

const mqttBroker = net.createServer(aedes.handle);
mqttBroker.listen(1883, () => console.log("MQTT broker on port 1883"));

// status tracking
let lastEspSeen = 0; // timestamp ms of last message from ESP
let mqttClientConnected = false;
let brokerClients = 0;

const client = mqtt.connect("mqtt://localhost:1883");
client.on("connect", () => {
  mqttClientConnected = true;
  console.log("MQTT client connected");
  client.subscribe("sensor/heart_rate");
  client.subscribe("sensor/wave");
  client.subscribe("sensor/spo2");
  io.emit("status", getStatus());
});
client.on("close", () => {
  mqttClientConnected = false;
  io.emit("status", getStatus());
});
client.on("offline", () => {
  mqttClientConnected = false;
  io.emit("status", getStatus());
});

client.on("message", (topic, message) => {
  const data = message.toString();
  lastEspSeen = Date.now();
  console.log(`Received on ${topic}: ${data}`);
  if (topic === "sensor/heart_rate") {
    io.emit("heart_rate", { time: Date.now(), value: parseInt(data, 10) });
  } else if (topic === "sensor/spo2") {
    io.emit("spo2", parseInt(data, 10));
  } else if (topic === "sensor/wave") {
    try {
      const obj = JSON.parse(data);
      io.emit("wave", obj);
    } catch (e) {
      // fallback: emit raw string
      io.emit("wave", { raw: data });
    }
  }
  // emit status update when ESP sends data
  io.emit("status", getStatus());
});

// track connected clients on broker (for visibility)
aedes.on("client", function (clientObj) {
  brokerClients = Math.max(0, brokerClients + 1);
  io.emit("status", getStatus());
});
aedes.on("clientDisconnect", function (clientObj) {
  brokerClients = Math.max(0, brokerClients - 1);
  io.emit("status", getStatus());
});

function getStatus() {
  const now = Date.now();
  const espOnline = lastEspSeen && now - lastEspSeen < 8000; // consider ESP online if seen within 8s
  return {
    mqttClientConnected,
    brokerClients,
    lastEspSeen: lastEspSeen || null,
    espOnline,
  };
}

// periodic status broadcast
setInterval(() => io.emit("status", getStatus()), 2000);

httpServer.listen(3001, () => console.log("HTTP server on port 3001"));

// Simple health route + status endpoint
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.get("/status", (req, res) => res.json(getStatus()));
