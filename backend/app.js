/*
  ===============================
  Smart Medicine Box - Backend v2.0
  ===============================
  MongoDB primary storage
  Medicine quantity tracking
  Detailed logging with device info
  Auto-sync with ESP32
  Enhanced API endpoints
  ===============================
  /**
   * Author: Bùi Thanh Quân - CT070242
   * Thiết kế hệ thống Nhúng - ACTVN - HVKTMM
   */

const express = require("express");
const mongoose = require("mongoose");
const socketIo = require("socket.io");
const http = require("http");
const aedes = require("aedes")();
const net = require("net");
const cors = require("cors");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(express.json());
app.use(cors());

// ============ MONGODB ============
const mongodbUri =
  process.env.MONGODB_URI || "mongodb://localhost:27017/smartmedbox";

mongoose
  .connect(mongodbUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log("✓ MongoDB connected");
    await initializeDatabase();
  })
  .catch((err) => {
    console.error("✗ MongoDB error:", err);
    process.exit(1);
  });

// ============ SCHEMAS ============
const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  uid: { type: String, required: true, unique: true },
  closeUid: { type: String, default: "" },
  quantity: { type: Number, required: true },
  expiryDate: { type: String, default: "" },
  servoPin: { type: Number, default: 1 },
  numReminders: { type: Number, default: 0 },
  reminderTimes: [String],
  reminderTimeout: { type: Number, default: 2 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const logSchema = new mongoose.Schema({
  deviceID: { type: String, default: "ESP32MedBox001" },
  timestamp: { type: String, required: true },
  cardUID: { type: String, required: true },
  action: { type: String, required: true },
  servo: { type: String, default: "Servo1" },
  details: { type: String, default: "" },
  success: { type: Boolean, required: true },
  createdAt: { type: Date, default: Date.now, expires: 2592000 },
});

const configSchema = new mongoose.Schema({
  servoTimeout: { type: Number, default: 10000 },
  lockRFIDOutsideReminder: { type: Boolean, default: false },
  wifiSSID: { type: String, default: "" },
  wifiPassword: { type: String, default: "" },
  updatedAt: { type: Date, default: Date.now },
});

const recipientSchema = new mongoose.Schema({
  chatID: { type: Number, required: true, unique: true },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const sensorSchema = new mongoose.Schema({
  deviceID: { type: String, default: "ESP32MedBox001" },
  heartRate: { type: Number, required: true },
  spo2: { type: Number, required: true },
  timestamp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 604800 },
});

const Medicine = mongoose.model("Medicine", medicineSchema);
const Log = mongoose.model("Log", logSchema);
const Config = mongoose.model("Config", configSchema);
const Recipient = mongoose.model("Recipient", recipientSchema);
const Sensor = mongoose.model("Sensor", sensorSchema);

// ============ DATABASE INIT ============
async function initializeDatabase() {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const names = collections.map((c) => c.name);

    if (!names.includes("medicines")) {
      await db.createCollection("medicines");
      await db
        .collection("medicines")
        .createIndex({ uid: 1 }, { unique: true });
      console.log("  ✓ medicines collection");
    }

    if (!names.includes("logs")) {
      await db.createCollection("logs");
      await db
        .collection("logs")
        .createIndex({ createdAt: 1 }, { expireAfterSeconds: 2592000 });
      console.log("  ✓ logs collection");
    }

    if (!names.includes("config")) {
      await db.createCollection("config");
      const count = await db.collection("config").countDocuments();
      if (count === 0) {
        await db.collection("config").insertOne({
          servoTimeout: 10000,
          lockRFIDOutsideReminder: false,
          updatedAt: new Date(),
        });
      }
      console.log("  ✓ config collection");
    }

    if (!names.includes("telegram_recipients")) {
      await db.createCollection("telegram_recipients");
      await db
        .collection("telegram_recipients")
        .createIndex({ chatID: 1 }, { unique: true });
      console.log("  ✓ telegram_recipients collection");
    }

    if (!names.includes("sensors")) {
      await db.createCollection("sensors");
      await db
        .collection("sensors")
        .createIndex({ createdAt: 1 }, { expireAfterSeconds: 604800 });
      console.log("  ✓ sensors collection");
    }

    console.log("✓ Database initialized\n");
  } catch (err) {
    console.error("✗ Database init error:", err.message);
  }
}

// ============ MQTT BROKER ============
const mqttServer = net.createServer(aedes.handle);
const MQTT_PORT = process.env.MQTT_PORT || 1883;

mqttServer.listen(MQTT_PORT, () => {
  console.log(`✓ MQTT Broker on port ${MQTT_PORT}`);
});

aedes.on("client", (client) => {
  console.log(`[MQTT] Client connected: ${client.id}`);
});

aedes.on("clientDisconnect", (client) => {
  console.log(`[MQTT] Client disconnected: ${client.id}`);
});

// ============ MQTT PUBLISH HANDLER ============
aedes.on("publish", async (packet, client) => {
  const topic = packet.topic;
  const payload = packet.payload.toString();

  if (topic.startsWith("$SYS/")) return;

  if (process.env.DEBUG !== "false") {
    console.log(`[MQTT] ${topic}: ${payload.substring(0, 100)}`);
  }

  try {
    let data = JSON.parse(payload);

    // ===== LOGS =====
    if (topic === "smartmedbox/logs") {
      const newLog = new Log({
        deviceID: data.deviceID || "ESP32MedBox001",
        timestamp: data.timestamp,
        cardUID: data.cardUID,
        action: data.action,
        servo: data.servo || "Servo1",
        details: data.details || "",
        success: data.success,
      });
      await newLog.save();
      io.emit("new_log", newLog);
      console.log(`  💾 Log saved: ${data.action}`);
    }

    // ===== STATUS =====
    else if (topic === "smartmedbox/status") {
      io.emit("status_update", data);
      global.currentStatus = data;
    }

    // ===== SENSORS =====
    else if (topic === "smartmedbox/sensors") {
      const newSensor = new Sensor({
        deviceID: data.deviceID || "ESP32MedBox001",
        heartRate: data.heartRate,
        spo2: data.spo2,
        timestamp: data.timestamp,
      });
      await newSensor.save();
      io.emit("sensor_data", newSensor);
      console.log(`  💓 Sensor: HR ${data.heartRate} | SpO2 ${data.spo2}%`);
    }

    // ===== MEDICINE QUANTITY UPDATE =====
    else if (topic === "smartmedbox/medicine_update") {
      const medID = data.medicineID;
      const newQty = data.quantity;

      await Medicine.findByIdAndUpdate(medID, {
        quantity: newQty,
        updatedAt: Date.now(),
      });

      io.emit("medicine_qty_updated", { medicineID: medID, quantity: newQty });
      console.log(`  📦 Medicine qty updated: ${medID} -> ${newQty}`);
    }

    // ===== LOAD ALL REQUEST =====
    else if (topic === "smartmedbox/request") {
      if (data.type === "load_all") {
        console.log(`[MQTT] Load request from ${data.deviceID || "unknown"}`);

        const medicines = await Medicine.find();
        const config = (await Config.findOne()) || {
          servoTimeout: 10000,
          lockRFIDOutsideReminder: false,
        };
        const recipients = await Recipient.find();

        // Send medicines with MongoDB _id
        const medicineResponse = {
          type: "load_medicines",
          count: medicines.length,
          medicines: medicines.map((m) => ({
            _id: m._id.toString(),
            name: m.name,
            uid: m.uid,
            closeUid: m.closeUid,
            quantity: m.quantity,
            expiryDate: m.expiryDate,
            servoPin: m.servoPin,
            numReminders: m.numReminders,
            reminderTimes: m.reminderTimes,
            reminderTimeout: m.reminderTimeout,
          })),
        };

        const configResponse = {
          type: "config",
          servoTimeout: config.servoTimeout,
          lockRFIDOutsideReminder: config.lockRFIDOutsideReminder,
        };

        const recipientResponse = {
          type: "load_recipients",
          count: recipients.length,
          recipients: recipients.map((r) => ({
            chatID: r.chatID,
            active: r.active,
          })),
        };

        // Publish responses
        aedes.publish({
          topic: "smartmedbox/data",
          payload: JSON.stringify(medicineResponse),
        });

        setTimeout(() => {
          aedes.publish({
            topic: "smartmedbox/config",
            payload: JSON.stringify(configResponse),
          });
        }, 500);

        setTimeout(() => {
          aedes.publish({
            topic: "smartmedbox/data",
            payload: JSON.stringify(recipientResponse),
          });
        }, 1000);

        console.log(
          `  ✓ Sent ${medicines.length} medicines, config, ${recipients.length} recipients`
        );
      }
    }
  } catch (err) {
    console.error("[MQTT] Parse error:", err.message);
  }
});

global.currentStatus = {};

// ============ SOCKET.IO ============
io.on("connection", (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);
  socket.emit("initial_status", global.currentStatus);

  socket.on("disconnect", () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// ============ HELPER FUNCTIONS ============
async function publishMedicinesToESP32() {
  try {
    const medicines = await Medicine.find();
    const response = {
      type: "load_medicines",
      count: medicines.length,
      medicines: medicines.map((m) => ({
        _id: m._id.toString(),
        name: m.name,
        uid: m.uid,
        closeUid: m.closeUid,
        quantity: m.quantity,
        expiryDate: m.expiryDate,
        servoPin: m.servoPin,
        numReminders: m.numReminders,
        reminderTimes: m.reminderTimes,
        reminderTimeout: m.reminderTimeout,
      })),
    };

    aedes.publish({
      topic: "smartmedbox/data",
      payload: JSON.stringify(response),
    });

    console.log(`[AUTO] Published ${medicines.length} medicines to ESP32`);
    return true;
  } catch (err) {
    console.error("[AUTO] Error publishing medicines:", err.message);
    return false;
  }
}

// ============ REST API ============

// Status
app.get("/status", async (req, res) => {
  try {
    const config = await Config.findOne();
    const medicines = await Medicine.find();
    res.json({
      ...global.currentStatus,
      medicineCount: medicines.length,
      config: config || { servoTimeout: 10000, lockRFIDOutsideReminder: false },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Control
app.post("/control", (req, res) => {
  const { action } = req.body;
  if (!action) return res.status(400).json({ error: "Action required" });

  aedes.publish({
    topic: "smartmedbox/commands",
    payload: JSON.stringify({ type: "control", action }),
  });

  res.json({ message: `Command sent: ${action}` });
});

// Medicines - List
app.get("/medicines", async (req, res) => {
  try {
    const medicines = await Medicine.find().sort({ createdAt: -1 });
    res.json(medicines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Medicines - Create
app.post("/medicines", async (req, res) => {
  try {
    const {
      name,
      uid,
      closeUid,
      quantity,
      expiryDate,
      servoPin,
      numReminders,
      reminderTimes,
      reminderTimeout,
    } = req.body;

    if (!name || !uid || quantity === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newMedicine = new Medicine({
      name,
      uid: uid.toLowerCase(),
      closeUid: closeUid || "",
      quantity,
      expiryDate: expiryDate || "",
      servoPin: servoPin || 1,
      numReminders: numReminders || 0,
      reminderTimes: reminderTimes || [],
      reminderTimeout: reminderTimeout || 2,
    });

    await newMedicine.save();
    io.emit("medicines_updated");
    await publishMedicinesToESP32();

    res.status(201).json(newMedicine);
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).json({ error: "UID already exists" });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Medicines - Update
app.put("/medicines/:id", async (req, res) => {
  try {
    const {
      name,
      uid,
      closeUid,
      quantity,
      expiryDate,
      servoPin,
      numReminders,
      reminderTimes,
      reminderTimeout,
    } = req.body;

    const medicine = await Medicine.findByIdAndUpdate(
      req.params.id,
      {
        name,
        uid: uid.toLowerCase(),
        closeUid: closeUid || "",
        quantity,
        expiryDate: expiryDate || "",
        servoPin: servoPin || 1,
        numReminders: numReminders || 0,
        reminderTimes: reminderTimes || [],
        reminderTimeout: reminderTimeout || 2,
        updatedAt: Date.now(),
      },
      { new: true }
    );

    io.emit("medicines_updated");
    await publishMedicinesToESP32();
    res.json(medicine);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Medicines - Delete
app.delete("/medicines/:id", async (req, res) => {
  try {
    await Medicine.findByIdAndDelete(req.params.id);
    io.emit("medicines_updated");
    await publishMedicinesToESP32();
    res.json({ message: "Medicine deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Medicines - Update Quantity Only
app.patch("/medicines/:id/quantity", async (req, res) => {
  try {
    const { quantity } = req.body;
    const medicine = await Medicine.findByIdAndUpdate(
      req.params.id,
      { quantity, updatedAt: Date.now() },
      { new: true }
    );

    io.emit("medicine_qty_updated", { medicineID: req.params.id, quantity });
    await publishMedicinesToESP32();
    res.json(medicine);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logs - List
app.get("/logs", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await Log.find().sort({ createdAt: -1 }).limit(limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logs - By Card UID
app.get("/logs/:cardUID", async (req, res) => {
  try {
    const logs = await Log.find({ cardUID: req.params.cardUID })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logs - By Action
app.get("/logs/action/:action", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const logs = await Log.find({ action: req.params.action })
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Config - Get
app.get("/config", async (req, res) => {
  try {
    let config = await Config.findOne();
    if (!config) {
      config = new Config();
      await config.save();
    }
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Config - Update
app.post("/config", async (req, res) => {
  try {
    const { servoTimeout, lockRFIDOutsideReminder, wifiSSID, wifiPassword } =
      req.body;

    let config = await Config.findOne();
    if (!config) config = new Config();

    if (servoTimeout !== undefined) config.servoTimeout = servoTimeout;
    if (lockRFIDOutsideReminder !== undefined)
      config.lockRFIDOutsideReminder = lockRFIDOutsideReminder;
    if (wifiSSID !== undefined) config.wifiSSID = wifiSSID;
    if (wifiPassword !== undefined) config.wifiPassword = wifiPassword;
    config.updatedAt = Date.now();

    await config.save();

    aedes.publish({
      topic: "smartmedbox/config",
      payload: JSON.stringify({
        type: "config",
        servoTimeout: config.servoTimeout,
        lockRFIDOutsideReminder: config.lockRFIDOutsideReminder,
      }),
    });

    io.emit("config_updated", config);
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recipients - List
app.get("/recipients", async (req, res) => {
  try {
    const recipients = await Recipient.find().sort({ createdAt: -1 });
    res.json(recipients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recipients - Create
app.post("/recipients", async (req, res) => {
  try {
    const { chatID } = req.body;
    if (!chatID) return res.status(400).json({ error: "chatID required" });

    const newRecipient = new Recipient({ chatID, active: true });
    await newRecipient.save();

    const recipients = await Recipient.find();
    aedes.publish({
      topic: "smartmedbox/data",
      payload: JSON.stringify({
        type: "load_recipients",
        count: recipients.length,
        recipients: recipients.map((r) => ({
          chatID: r.chatID,
          active: r.active,
        })),
      }),
    });

    io.emit("recipients_updated");
    res.status(201).json(newRecipient);
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).json({ error: "chatID already exists" });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Recipients - Delete
app.delete("/recipients/:id", async (req, res) => {
  try {
    await Recipient.findByIdAndDelete(req.params.id);

    const recipients = await Recipient.find();
    aedes.publish({
      topic: "smartmedbox/data",
      payload: JSON.stringify({
        type: "load_recipients",
        count: recipients.length,
        recipients: recipients.map((r) => ({
          chatID: r.chatID,
          active: r.active,
        })),
      }),
    });

    io.emit("recipients_updated");
    res.json({ message: "Recipient deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sensors - List
app.get("/sensors", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const sensors = await Sensor.find().sort({ createdAt: -1 }).limit(limit);
    res.json(sensors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sensors - Latest
app.get("/sensors/latest", async (req, res) => {
  try {
    const latest = await Sensor.findOne().sort({ createdAt: -1 });
    res.json(latest || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stats
app.get("/stats", async (req, res) => {
  try {
    const medicineCount = await Medicine.countDocuments();
    const logCount = await Log.countDocuments();
    const recipientCount = await Recipient.countDocuments();
    const latestLogs = await Log.find().sort({ createdAt: -1 }).limit(5);
    const latestSensor = await Sensor.findOne().sort({ createdAt: -1 });

    res.json({
      medicineCount,
      logCount,
      recipientCount,
      latestLogs,
      latestSensor: latestSensor || {},
      currentStatus: global.currentStatus,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health Check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1,
    mqtt: true,
  });
});

// Debug - View Medicines
app.get("/debug/medicines", async (req, res) => {
  try {
    const medicines = await Medicine.find();
    res.json({ total: medicines.length, medicines });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug - Manually Sync to ESP32
app.post("/debug/sync", async (req, res) => {
  try {
    const success = await publishMedicinesToESP32();
    res.json({ success, message: "Manual sync triggered" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ START SERVER ============
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════╗`);
  console.log(`║  Backend v2.0 - Port ${PORT}        ║`);
  console.log(`╚════════════════════════════════════╝`);
  console.log(`✓ HTTP API: http://localhost:${PORT}`);
  console.log(`✓ Socket.IO: ws://localhost:${PORT}`);
  console.log(`✓ MQTT Broker: port ${MQTT_PORT}`);
  console.log(`✓ MongoDB: ${mongodbUri}\n`);
});

module.exports = { app, io, aedes };
