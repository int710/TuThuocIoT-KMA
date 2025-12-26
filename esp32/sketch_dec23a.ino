/*
  ===============================
  SMART MEDICINE BOX - ESP32 FIRMWARE v2.0
  ===============================
  ✓ MongoDB-first architecture (minimal EEPROM)
  ✓ Full MQTT sync with backend
  ✓ Realtime reminder system
  ✓ Medicine quantity tracking
  ✓ Detailed logging
  ✓ WDT protection (ESP-IDF 5.x compatible)
  ✓ MAX30102 optimized algorithm
  ===============================
*/

#include <SPI.h>
#include <MFRC522.h>
#include <ESP32Servo.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <EEPROM.h>
#include <ArduinoJson.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <Wire.h>
#include <UniversalTelegramBot.h>
#include <WiFiClientSecure.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"
#include "esp_task_wdt.h"

// ============ CONFIGURATION ============
#define BOT_TOKEN "xxxxx"
#define MAX_RECIPIENTS 5
#define MAX_MEDICINES 10
#define MAX_REMINDERS 5
#define MAX30102_BUFFER 100

// Chân kết nối ESP32 và linh kiện
#define SS_PIN 5
#define RST_PIN 22
#define SERVO_PIN 21
#define BUZZER_PIN 4
#define LED_PIN 13
#define BUTTON_PIN 14
#define SDA_PIN 25
#define SCL_PIN 26

// WDT configuration (ESP-IDF 5.x)
#define WDT_TIMEOUT_SEC 30

// EEPROM (lưu mỗi wifi - còn lại ở mongodb)
#define EEPROM_SIZE 128
#define SSID_ADDR 0
#define PASS_ADDR 64

// Test thuật toán mới
#define MAX30102_BUFFER 100
uint32_t irBuffer[MAX30102_BUFFER];
uint32_t redBuffer[MAX30102_BUFFER];


// ============ HARDWARE ============
MFRC522 rfid(SS_PIN, RST_PIN);
Servo servo;
MAX30105 sensor;
WiFiUDP ntpUDP;
NTPClient ntp(ntpUDP, "pool.ntp.org", 7 * 3600, 60000);
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
WiFiClientSecure telegramSecure;
UniversalTelegramBot bot(BOT_TOKEN, telegramSecure);

// ============ DATA STRUCTURES ============
struct Medicine {
  String id;  // MongoDB _id
  String name;
  String uid;
  String closeUid;
  String expiry;
  int qty;
  int servo;
  int timeout;
  int numReminders;
  String times[MAX_REMINDERS];
  bool taken;
  time_t lastTrigger;
};

struct ReminderState {
  bool active;
  bool missed;
  bool extendedBuzz;
  int medIdx;
  time_t start;
  time_t end;
  unsigned long buzzStart;
};

struct SensorData {
  uint32_t ir[MAX30102_BUFFER];
  uint32_t red[MAX30102_BUFFER];
  int idx;
  int hr;
  int spo2;
  bool valid;
  unsigned long lastPub;
};

struct Recipient {
  long long chatID;
  bool active;
};

struct SystemStatus {
  bool servoOpen;
  bool wifiConnected;
  bool mqttConnected;
  int totalAccess;
  String lastAccess;
  unsigned long uptime;
};

// ============ GLOBAL VARIABLES ============
String deviceID = "ESP32 TuThuoc001";
String ssid = "khongcowifi";
String pass = "12345679";
// const char* mqttServer = "192.168.1.176";
const char* mqttServer = "10.166.85.81";
int mqttPort = 1883;

Medicine medicines[MAX_MEDICINES];
int medCount = 0;

ReminderState reminder = { false, false, false, -1, 0, 0, 0 };
SensorData sensorData = { { 0 }, { 0 }, 0, 0, 0, false, 0 };
Recipient recipients[MAX_RECIPIENTS];
int recipientCount = 0;

SystemStatus sysStatus = { false, false, false, 0, "", 0 };

unsigned long servoTimeout = 10000;
bool lockRFID = false;
bool emergencyMode = false;

unsigned long lastServoTime = 0;
unsigned long lastNTP = 0;
unsigned long lastMQTT = 0;
unsigned long lastBot = 0;
unsigned long lastBtn = 0;
unsigned long lastWiFiCheck = 0;
unsigned long lastStatusPublish = 0;

long lastTelegramID = 0;

// ============ FUNCTION DECLARATIONS ============
void initWDT();
void feedWDT();
void initHardware();
void connectWiFi();
void reconnectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int len);
void loadAllData();
void publishStatus();
void publishLog(String uid, String action, String details, bool success);
void publishSensor(int hr, int spo2);
void updateMedicineQty(String medID, int newQty);

void handleRFID();
void handleButton();
void handleServo();
void handleBuzzer();
void handleSensor();
void handleTelegram();

void checkReminders();
void startReminder(int idx);
void confirmMedicine(int idx);
void missReminder(int idx);

String getTimestamp();
time_t parseTime(String hm);
void beep(int ms);
void sendAll(String msg);
String readEEPROM(int addr);
void writeEEPROM(int addr, String data);

// ============ SETUP ============
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n╔════════════════════════════════════╗");
  Serial.println("║  Smart Medicine Box v2.0 - IoT    ║");
  Serial.println("╚════════════════════════════════════╝\n");

  // Initialize WDT (ESP-IDF 5.x compatible)
  initWDT();

  // Initialize hardware
  EEPROM.begin(EEPROM_SIZE);
  initHardware();

  // Load WiFi credentials from EEPROM
  String savedSSID = readEEPROM(SSID_ADDR);
  String savedPass = readEEPROM(PASS_ADDR);
  if (savedSSID.length() > 0) {
    ssid = savedSSID;
    pass = savedPass;
  }

  // Connect WiFi
  connectWiFi();

  if (sysStatus.wifiConnected) {
    ntp.begin();
    ntp.update();
    telegramSecure.setInsecure();

    mqtt.setServer(mqttServer, mqttPort);
    mqtt.setCallback(mqttCallback);
    mqtt.setBufferSize(2048);
    reconnectMQTT();

    delay(1000);
    loadAllData();
  }

  Serial.println("Hệ thống sẵn sàng, Khởi động thành công\n");
  sysStatus.uptime = millis();
  feedWDT();
}

// ============ MAIN LOOP ============
void loop() {
  feedWDT();

  // WiFi management
  if (millis() - lastWiFiCheck > 30000) {
    lastWiFiCheck = millis();
    if (WiFi.status() != WL_CONNECTED) {
      if (sysStatus.wifiConnected) {
        Serial.println("⚠ WiFi disconnected");
        sysStatus.wifiConnected = false;
      }
      connectWiFi();
    } else if (!sysStatus.wifiConnected) {
      sysStatus.wifiConnected = true;
      ntp.begin();
    }
  }

  // MQTT management
  if (sysStatus.wifiConnected) {
    if (!mqtt.connected()) {
      if (millis() - lastMQTT > 5000) {
        lastMQTT = millis();
        reconnectMQTT();
      }
    } else {
      mqtt.loop();
      sysStatus.mqttConnected = true;
    }

    // NTP sync
    if (millis() - lastNTP > 300000) {
      ntp.update();
      lastNTP = millis();
    }

    // Check reminders
    checkReminders();

    // Telegram bot
    if (millis() - lastBot > 10000) {
      lastBot = millis();
      handleTelegram();
    }

    // Publish status every 30s
    if (millis() - lastStatusPublish > 30000) {
      lastStatusPublish = millis();
      publishStatus();
    }
  }

  // Hardware handlers
  handleRFID();
  handleButton();
  handleServo();
  handleBuzzer();
  handleSensor();

  delay(10);
}

// ============ WDT FUNCTIONS (ESP-IDF 5.x) ============
void initWDT() {
  esp_task_wdt_config_t wdt_config = {
    .timeout_ms = WDT_TIMEOUT_SEC * 1000,
    .idle_core_mask = 0,
    .trigger_panic = true
  };

  esp_task_wdt_init(&wdt_config);
  esp_task_wdt_add(NULL);
  Serial.println("✓ WDT initialized (30s timeout)");
}

void feedWDT() {
  esp_task_wdt_reset();
}

// ============ HARDWARE INITIALIZATION ============
void initHardware() {
  Serial.println("⚙ Initializing hardware...");

  // SPI & RFID
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("  ✓ RFID quét uid");

  // GPIO
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

  // Servo
  servo.attach(SERVO_PIN);
  servo.write(85);
  Serial.println("  ✓ Servo motor");

  // I2C & MAX30102
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);

  if (sensor.begin(Wire, I2C_SPEED_FAST)) {
    // CẤU HÌNH CHUẨN CHO SpO2:
    byte ledBrightness = 60;  // Độ sáng LED (0-255)
    byte sampleAverage = 4;   // Trung bình mẫu (1, 2, 4, 8, 16, 32)
    byte ledMode = 2;         // 2 = Red + IR (Bắt buộc để đo SpO2)
    int sampleRate = 100;     // Tốc độ lấy mẫu (50, 100, 200...)
    int pulseWidth = 411;     // Độ rộng xung (69, 118, 215, 411)
    int adcRange = 4096;      // Dải ADC (2048, 4096, 8192, 16384)

    sensor.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
    Serial.println("   ✓ MAX30102 sensor configured for SpO2");
  } else {
    Serial.println("   ✗ MAX30102 not found");
  }

  Serial.println("✓ Hardware initialized\n");
}

// ============ WIFI & MQTT ============
void connectWiFi() {
  if (ssid.length() == 0) {
    Serial.println("✗ No WiFi credentials");
    return;
  }

  Serial.print("📡 Connecting to: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), pass.c_str());

  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 20) {
    delay(500);
    Serial.print(".");
    tries++;
    feedWDT();
  }

  if (WiFi.status() == WL_CONNECTED) {
    sysStatus.wifiConnected = true;
    Serial.println("\n✓ WiFi connected");
    Serial.print("  IP: ");
    Serial.println(WiFi.localIP());
  } else {
    sysStatus.wifiConnected = false;
    Serial.println("\n✗ WiFi failed");
  }
}

void reconnectMQTT() {
  if (!sysStatus.wifiConnected || mqtt.connected()) return;

  Serial.print("📤 MQTT connecting... ");

  String clientID = deviceID + String(random(0xffff), HEX);
  if (mqtt.connect(clientID.c_str())) {
    mqtt.subscribe("smartmedbox/commands");
    mqtt.subscribe("smartmedbox/config");
    mqtt.subscribe("smartmedbox/data");
    Serial.println("OK");
    sysStatus.mqttConnected = true;
    publishStatus();
  } else {
    Serial.print("FAILED (rc=");
    Serial.print(mqtt.state());
    Serial.println(")");
    sysStatus.mqttConnected = false;
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int len) {
  String msg = "";
  for (unsigned int i = 0; i < len; i++) {
    msg += (char)payload[i];
  }

  String topicStr(topic);
  if (topicStr.startsWith("$SYS/") || msg.length() == 0 || msg[0] != '{') {
    return;
  }

  DynamicJsonDocument doc(2048);
  if (deserializeJson(doc, msg)) {
    Serial.println("⚠ MQTT JSON parse error");
    return;
  }

  String type = doc["type"] | "";

  // ===== CONTROL COMMANDS =====
  if (type == "control") {
    String action = doc["action"] | "";

    if (action == "open" && !sysStatus.servoOpen) {
      servo.write(0);
      sysStatus.servoOpen = true;
      digitalWrite(LED_PIN, HIGH);
      lastServoTime = millis();
      sysStatus.lastAccess = getTimestamp();
      sysStatus.totalAccess++;
      beep(100);
      publishStatus();
      publishLog("WEB_CONTROL", "open", "Mở thủ công từ web", true);

      if (reminder.active && reminder.medIdx >= 0) {
        confirmMedicine(reminder.medIdx);
      }
    } else if (action == "close" && sysStatus.servoOpen) {
      servo.write(85);
      sysStatus.servoOpen = false;
      digitalWrite(LED_PIN, LOW);
      beep(100);
      publishStatus();
      publishLog("WEB_CONTROL", "close", "Đóng thủ công từ web", true);
    }

    else if (action == "buzzer_on") {
      digitalWrite(BUZZER_PIN, HIGH);
      publishLog("WEB", "buzzer_on", "Còi bật từ Web", true);
    } else if (action == "buzzer_off") {
      digitalWrite(BUZZER_PIN, LOW);
      publishLog("WEB", "buzzer_off", "Còi tắt từ Web", true);
    }

    else if (action == "led_on") {
      digitalWrite(LED_PIN, HIGH);
      publishLog("WEB", "led", "Led bật từ Web", true);
    } else if (action == "led_off") {
      digitalWrite(LED_PIN, LOW);
      publishLog("WEB", "led", "Led tắt từ Web", true);
    }
  }

  // ===== CONFIG UPDATE =====
  else if (type == "config") {
    if (doc.containsKey("servoTimeout")) {
      servoTimeout = doc["servoTimeout"];
      Serial.print("⚙ Servo timeout updated: ");
      Serial.println(servoTimeout);
    }
    if (doc.containsKey("lockRFIDOutsideReminder")) {
      lockRFID = doc["lockRFIDOutsideReminder"];
      Serial.print("⚙ RFID lock: ");
      Serial.println(lockRFID ? "ON" : "OFF");
    }
  }

  // ===== LOAD MEDICINES =====
  else if (type == "load_medicines") {
    medCount = doc["count"] | 0;
    if (medCount > MAX_MEDICINES) medCount = MAX_MEDICINES;

    Serial.print("📦 Loading ");
    Serial.print(medCount);
    Serial.println(" medicines...");

    for (int i = 0; i < medCount; i++) {
      JsonObject m = doc["medicines"][i];

      medicines[i].id = m["_id"] | "";
      medicines[i].name = m["name"] | "";
      medicines[i].uid = m["uid"] | "";
      medicines[i].closeUid = m["closeUid"] | "";
      medicines[i].qty = m["quantity"] | 0;
      medicines[i].expiry = m["expiryDate"] | "";
      medicines[i].servo = m["servoPin"] | 1;
      medicines[i].timeout = m["reminderTimeout"] | 2;
      medicines[i].numReminders = m["numReminders"] | 0;
      medicines[i].taken = false;
      medicines[i].lastTrigger = 0;

      for (int j = 0; j < medicines[i].numReminders && j < MAX_REMINDERS; j++) {
        medicines[i].times[j] = m["reminderTimes"][j] | "";
        medicines[i].times[j].trim();
      }

      Serial.print("  [");
      Serial.print(i);
      Serial.print("] ");
      Serial.print(medicines[i].name);
      Serial.print(" (qty: ");
      Serial.print(medicines[i].qty);
      Serial.print(", reminders: ");
      Serial.print(medicines[i].numReminders);
      Serial.println(")");
    }

    Serial.println("✓ Medicines loaded\n");
  }

  // ===== LOAD RECIPIENTS =====
  else if (type == "load_recipients") {
    recipientCount = doc["count"] | 0;
    if (recipientCount > MAX_RECIPIENTS) recipientCount = MAX_RECIPIENTS;

    for (int i = 0; i < recipientCount; i++) {
      recipients[i].chatID = doc["recipients"][i]["chatID"] | 0LL;
      recipients[i].active = true;
    }

    Serial.print("📱 Loaded ");
    Serial.print(recipientCount);
    Serial.println(" Telegram recipients");
  }
}

void loadAllData() {
  if (!mqtt.connected()) return;

  Serial.println("🔄 Requesting data from backend...");

  DynamicJsonDocument doc(128);
  doc["type"] = "load_all";
  doc["deviceID"] = deviceID;

  String msg;
  serializeJson(doc, msg);
  mqtt.publish("smartmedbox/request", msg.c_str());
}

void publishStatus() {
  if (!mqtt.connected()) return;

  DynamicJsonDocument doc(512);
  doc["type"] = "status";
  doc["deviceID"] = deviceID;
  doc["servoOpen"] = sysStatus.servoOpen;
  doc["wifiConnected"] = sysStatus.wifiConnected;
  doc["mqttConnected"] = sysStatus.mqttConnected;
  doc["lastAccess"] = sysStatus.lastAccess;
  doc["totalAccess"] = sysStatus.totalAccess;
  doc["reminderActive"] = reminder.active;
  doc["reminderMissed"] = reminder.missed;
  doc["uptime"] = millis() / 1000;
  doc["timestamp"] = getTimestamp();

  doc["ledOn"] = (digitalRead(LED_PIN) == HIGH);
  doc["buzzerOn"] = (digitalRead(BUZZER_PIN) == HIGH);

  String msg;
  serializeJson(doc, msg);
  mqtt.publish("smartmedbox/status", msg.c_str());
}

void publishLog(String uid, String action, String details, bool success) {
  if (!mqtt.connected()) return;

  DynamicJsonDocument doc(512);
  doc["type"] = "log";
  doc["deviceID"] = deviceID;
  doc["timestamp"] = getTimestamp();
  doc["cardUID"] = uid;
  doc["action"] = action;
  doc["servo"] = "Servo1";
  doc["details"] = details;
  doc["success"] = success;

  String msg;
  serializeJson(doc, msg);
  mqtt.publish("smartmedbox/logs", msg.c_str());
}

void publishSensor(int hr, int spo2) {
  if (!mqtt.connected()) return;

  DynamicJsonDocument doc(256);
  doc["type"] = "sensor";
  doc["deviceID"] = deviceID;
  doc["heartRate"] = hr;
  doc["spo2"] = spo2;
  doc["timestamp"] = getTimestamp();

  String msg;
  serializeJson(doc, msg);
  mqtt.publish("smartmedbox/sensors", msg.c_str());
}

void updateMedicineQty(String medID, int newQty) {
  if (!mqtt.connected()) return;

  DynamicJsonDocument doc(256);
  doc["type"] = "update_quantity";
  doc["medicineID"] = medID;
  doc["quantity"] = newQty;

  String msg;
  serializeJson(doc, msg);
  mqtt.publish("smartmedbox/medicine_update", msg.c_str());

  Serial.print("📤 Updated qty for ");
  Serial.print(medID);
  Serial.print(": ");
  Serial.println(newQty);
}

// ============ RFID HANDLER ============
void handleRFID() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toLowerCase();

  Serial.print("💳 RFID: ");
  Serial.println(uid);

  beep(100);

  // Check RFID lock
  if (lockRFID && !reminder.active) {
    Serial.println("⚠ RFID locked (no active reminder)");
    beep(300);
    publishLog(uid, "rfid_locked", "RFID locked outside reminder", false);
    rfid.PICC_HaltA();
    return;
  }

  // Search medicine
  bool found = false;
  for (int i = 0; i < medCount; i++) {
    // Open card
    if (medicines[i].uid == uid) {
      servo.write(0);
      sysStatus.servoOpen = true;
      digitalWrite(LED_PIN, HIGH);
      lastServoTime = millis();
      sysStatus.lastAccess = getTimestamp();
      sysStatus.totalAccess++;

      // Decrease quantity
      if (medicines[i].qty > 0) {
        medicines[i].qty--;
        updateMedicineQty(medicines[i].id, medicines[i].qty);
      }

      beep(100);
      publishStatus();
      publishLog(uid, "open", "Opened: " + medicines[i].name + " (qty: " + String(medicines[i].qty) + ")", true);

      // Confirm if in reminder
      if (reminder.active && reminder.medIdx == i) {
        confirmMedicine(i);
      }

      found = true;
      break;
    }
    // Close card
    else if (medicines[i].closeUid.length() > 0 && medicines[i].closeUid == uid) {
      servo.write(85);
      sysStatus.servoOpen = false;
      digitalWrite(LED_PIN, LOW);
      beep(100);
      publishStatus();
      publishLog(uid, "close", "Closed: " + medicines[i].name, true);
      found = true;
      break;
    }
  }

  if (!found) {
    Serial.println("⚠ Invalid card");
    beep(300);
    publishLog(uid, "invalid_card", "Unknown RFID card", false);
  }

  rfid.PICC_HaltA();
}

// ============ BUTTON HANDLER ============
void handleButton() {
  if (digitalRead(BUTTON_PIN) == LOW && millis() - lastBtn > 3000) {
    lastBtn = millis();
    emergencyMode = !emergencyMode;

    if (emergencyMode && !sysStatus.servoOpen) {
      servo.write(0);
      sysStatus.servoOpen = true;
      digitalWrite(LED_PIN, HIGH);
      lastServoTime = millis();
      beep(200);
      publishStatus();
      publishLog("EMERGENCY_BTN", "emergency_open", "Emergency button pressed", true);
      sendAll("🚨 EMERGENCY: Box opened by emergency button!");
    } else if (!emergencyMode && sysStatus.servoOpen) {
      servo.write(85);
      sysStatus.servoOpen = false;
      digitalWrite(LED_PIN, LOW);
      beep(200);
      publishStatus();
      publishLog("EMERGENCY_BTN", "emergency_close", "Emergency closed", true);
    }
  }
}

// ============ SERVO HANDLER ============
void handleServo() {
  if (sysStatus.servoOpen && !emergencyMode) {
    if (millis() - lastServoTime >= servoTimeout) {
      servo.write(85);
      sysStatus.servoOpen = false;
      digitalWrite(LED_PIN, LOW);
      publishStatus();
      publishLog("AUTO_CLOSE", "auto_close", "Servo auto-closed after timeout", true);
    }
  }
}

// ============ REMINDER SYSTEM ============
void checkReminders() {
  static unsigned long lastCheck = 0;
  if (millis() - lastCheck < 1000) return;
  lastCheck = millis();

  if (!ntp.isTimeSet()) return;

  time_t now = ntp.getEpochTime();

  // Handle active reminder
  if (reminder.active) {
    if (now >= reminder.end && !reminder.missed) {
      missReminder(reminder.medIdx);
    }
    if (reminder.extendedBuzz && millis() >= reminder.buzzStart + 60000) {
      reminder.extendedBuzz = false;
      digitalWrite(BUZZER_PIN, LOW);
      digitalWrite(LED_PIN, LOW);
      Serial.println("⏰ Extended buzzer stopped");
    }
    return;
  }

  // Check for new reminders
  for (int i = 0; i < medCount; i++) {
    if (medicines[i].taken) continue;

    for (int j = 0; j < medicines[i].numReminders; j++) {
      if (medicines[i].times[j].length() < 5) continue;

      time_t rt = parseTime(medicines[i].times[j]);

      if (now >= rt && now < rt + (medicines[i].timeout * 60)) {
        if (medicines[i].lastTrigger != rt) {
          medicines[i].lastTrigger = rt;
          startReminder(i);
          return;
        }
      }
    }
  }
}

void startReminder(int idx) {
  if (idx < 0 || idx >= medCount) return;

  reminder.active = true;
  reminder.missed = false;
  reminder.medIdx = idx;
  reminder.start = ntp.getEpochTime();
  reminder.end = reminder.start + (medicines[idx].timeout * 60);
  reminder.extendedBuzz = false;

  digitalWrite(LED_PIN, HIGH);

  String msg = "⏰ 【 NHẮC NHỞ UỐNG THUỐC 】 ⏰\n";
  msg += "------------------------------------\n";
  msg += "💊 Tên thuốc: " + medicines[idx].name + "\n";
  msg += "📦 Số lượng còn lại: " + String(medicines[idx].qty) + " viên\n";
  msg += "⏳ Thời gian chờ: " + String(medicines[idx].timeout) + " phút\n";
  msg += "------------------------------------\n";
  msg += "⚠️ Vui lòng uống thuốc đúng giờ để bảo vệ sức khỏe của bạn! ❤️";

  sendAll(msg);
  publishStatus();
  publishLog("REMINDER", "reminder_start", "Reminder started: " + medicines[idx].name, true);

  Serial.print("⏰ Reminder started: ");
  Serial.println(medicines[idx].name);
}

void confirmMedicine(int idx) {
  if (idx < 0 || idx >= medCount) return;

  medicines[idx].taken = true;
  reminder.active = false;
  reminder.missed = false;
  reminder.extendedBuzz = false;

  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

  String msg = "✅ ĐÃ UỐNG: " + medicines[idx].name + "\n";
  msg += "📅 Ngày: " + getTimestamp() + "\n";
  msg += "📦 Số lượng còn: " + String(medicines[idx].qty) + "\n";

  if (medicines[idx].qty <= 5) {
    msg += "\n⚠️ *CẢNH BÁO:* Thuốc trong kho còn rất ít (" + String(medicines[idx].qty) + "). Vui lòng mua thêm ngay! 🛒";
  } else {
    msg += "🌟 Tuyệt vời! Lộ trình điều trị đang được thực hiện rất tốt.\n";
    msg += "\n🍀 Chúc bạn một ngày tốt lành!";
  }

  sendAll(msg);
  publishStatus();
  publishLog("MEDICINE_TAKEN", "confirm", "Medicine confirmed: " + medicines[idx].name, true);

  Serial.print("✅ Medicine confirmed: ");
  Serial.println(medicines[idx].name);
}

void missReminder(int idx) {
  if (idx < 0 || idx >= medCount) return;

  reminder.missed = true;
  reminder.extendedBuzz = true;
  reminder.buzzStart = millis();

  String msg = "❌ BỎ THUỐC!\n";
  msg += "Tên thuốc: " + medicines[idx].name + "\n";
  msg += "Thời gian: " + getTimestamp() + "\n";
  msg += "⚠️ Hãy uống thuốc ngay lập tức!";

  sendAll(msg);
  publishStatus();
  publishLog("REMINDER_MISSED", "missed", "Missed dose: " + medicines[idx].name, false);

  Serial.print("❌ Reminder missed: ");
  Serial.println(medicines[idx].name);
}

void handleBuzzer() {
  if (!reminder.active && !reminder.extendedBuzz) {
    digitalWrite(BUZZER_PIN, LOW);
    return;
  }

  static unsigned long lastToggle = 0;
  if (millis() - lastToggle >= 500) {
    lastToggle = millis();
    digitalWrite(BUZZER_PIN, !digitalRead(BUZZER_PIN));
  }
}

// ============ MAX30102 SENSOR ============
void handleSensor() {
  // 1. Yêu cầu cảm biến kiểm tra và đẩy dữ liệu vào bộ đệm của thư viện
  sensor.check();

  // 2. Đọc tất cả các mẫu đang chờ trong FIFO
  while (sensor.available()) {
    // Đọc dữ liệu thô
    uint32_t irValue = sensor.getIR();
    uint32_t redValue = sensor.getRed();

    // Di chuyển mẫu mới vào buffer theo kiểu cuốn chiếu (Sliding Window)
    // Việc này giúp mảng luôn chứa 100 mẫu mới nhất để thuật toán chính xác nhất
    for (int i = 1; i < MAX30102_BUFFER; i++) {
      irBuffer[i - 1] = irBuffer[i];
      redBuffer[i - 1] = redBuffer[i];
    }
    irBuffer[MAX30102_BUFFER - 1] = irValue;
    redBuffer[MAX30102_BUFFER - 1] = redValue;

    // Báo cho cảm biến đã đọc xong mẫu này để lấy mẫu tiếp theo
    sensor.nextSample();

    // 3. Kiểm tra sự hiện diện của ngón tay
    // Nếu giá trị IR quá thấp (< 50000), nghĩa là không có ngón tay
    if (irValue < 50000) {
      sensorData.valid = false;
      // Reset các chỉ số về 0 khi nhấc tay ra
      sensorData.hr = 0;
      sensorData.spo2 = 0;
      return;
    }

    // 4. Chỉ thực hiện tính toán SpO2/HR sau mỗi 25 mẫu mới (~0.25 giây/lần)
    // Việc này giúp giảm tải cho CPU ESP32 nhưng vẫn đảm bảo mượt mà
    static int sampleCount = 0;
    sampleCount++;

    if (sampleCount >= 25) {
      sampleCount = 0;

      int32_t hr_val, spo2_val;
      int8_t hr_valid, spo2_valid;

      // Gọi thuật toán chuẩn Maxim
      maxim_heart_rate_and_oxygen_saturation(
        irBuffer, MAX30102_BUFFER,
        redBuffer,
        &spo2_val, &spo2_valid,
        &hr_val, &hr_valid);

      // 5. Lọc dữ liệu rác (Post-processing)
      // Chỉ chấp nhận kết quả nếu thuật toán báo valid và nằm trong khoảng sinh lý người
      if (hr_valid && spo2_valid && hr_val >= 40 && hr_val <= 160 && spo2_val >= 70 && spo2_val <= 100) {
        sensorData.hr = hr_val;
        sensorData.spo2 = spo2_val;
        sensorData.valid = true;

        // 6. Gửi dữ liệu qua MQTT/Web mỗi 5 giây
        if (millis() - sensorData.lastPub >= 5000) {
          sensorData.lastPub = millis();
          publishSensor(sensorData.hr, sensorData.spo2);

          Serial.printf("📊 [REALTIME] HR: %d BPM | SpO2: %d%%\n", sensorData.hr, sensorData.spo2);
        }
      } else {
        // Nếu thuật toán chưa hội tụ đủ dữ liệu (đang tính toán), ta giữ nguyên sensorData.valid = true
        // nhưng không cập nhật số mới để tránh nhảy số loạn xạ (BPM = -999)
        Serial.println("... Đang ổn định tín hiệu ...");
      }
    }
  }
}

// ============ TELEGRAM HANDLER ============
void handleTelegram() {
  int num = bot.getUpdates(lastTelegramID + 1);
  if (num > 0) lastTelegramID = bot.messages[num - 1].update_id;

  for (int i = 0; i < num; i++) {
    String chat = bot.messages[i].chat_id;
    String text = bot.messages[i].text;

    if (text == "/start") {
      String welcome = "🏥 Hộp Thuốc Thông Minh v2.0\n\n";
      welcome += "Các lệnh khả dụng:\n";
      welcome += "/status - Trạng thái hệ thống\n";
      welcome += "/open - Mở hộp thuốc\n";
      welcome += "/close - Đóng hộp thuốc\n";
      welcome += "/medicines - Danh sách thuốc\n";
      welcome += "/logs - Nhật ký hoạt động\n";
      welcome += "/sensor - Dữ liệu sức khỏe mới nhất";
      bot.sendMessage(chat, welcome);
    }

    else if (text == "/status") {
      String status = "📊 TRẠNG THÁI HỆ THỐNG\n\n";
      status += "Hộp thuốc: " + String(sysStatus.servoOpen ? "ĐANG MỞ 🔓" : "ĐÃ ĐÓNG 🔒") + "\n";
      status += "WiFi: " + String(sysStatus.wifiConnected ? "Đã kết nối ✓" : "Mất kết nối ✗") + "\n";
      status += "MQTT: " + String(sysStatus.mqttConnected ? "Đã kết nối ✓" : "Mất kết nối ✗") + "\n";
      status += "Tổng lượt truy cập: " + String(sysStatus.totalAccess) + "\n";
      status += "Truy cập cuối: " + sysStatus.lastAccess + "\n";
      status += "Nhắc nhở: " + String(reminder.active ? "ĐANG BẬT ⏰" : "Không có") + "\n";
      status += "Thời gian hoạt động: " + String(millis() / 1000) + " giây";
      bot.sendMessage(chat, status);
    }

    else if (text == "/open") {
      servo.write(0);
      sysStatus.servoOpen = true;
      digitalWrite(LED_PIN, HIGH);
      lastServoTime = millis();
      publishStatus();
      bot.sendMessage(chat, "✓ Hộp thuốc đã được mở");
      publishLog("TELEGRAM", "open", "Mở qua Telegram", true);
    }

    else if (text == "/close") {
      servo.write(85);
      sysStatus.servoOpen = false;
      digitalWrite(LED_PIN, LOW);
      publishStatus();
      bot.sendMessage(chat, "✓ Hộp thuốc đã được đóng");
      publishLog("TELEGRAM", "close", "Đóng qua Telegram", true);
    }

    else if (text == "/medicines") {
      String list = "💊 DANH SÁCH THUỐC (" + String(medCount) + ")\n\n";
      for (int j = 0; j < medCount; j++) {
        list += String(j + 1) + ". " + medicines[j].name + "\n";
        list += "   Số lượng: " + String(medicines[j].qty) + "\n";
        list += "   Số lần nhắc: " + String(medicines[j].numReminders) + "\n\n";
      }
      bot.sendMessage(chat, list);
    }

    else if (text == "/sensor") {
      if (sensorData.valid) {
        String sensor = "💓 DỮ LIỆU SỨC KHỎE\n\n";
        sensor += "Nhịp tim: " + String(sensorData.hr) + " bpm\n";
        sensor += "Nồng độ Oxy (SpO2): " + String(sensorData.spo2) + "%\n";
        sensor += "Tình trạng: " + String(sensorData.hr > 60 && sensorData.hr < 100 ? "Bình thường ✓" : "Cần kiểm tra ⚠");
        bot.sendMessage(chat, sensor);
      } else {
        bot.sendMessage(chat, "⚠ Hiện chưa có dữ liệu từ cảm biến");
      }
    }

    else if (text == "/logs") {
      bot.sendMessage(chat, "📋 Vui lòng kiểm tra bảng điều khiển trên Web để xem nhật ký chi tiết");
    }
  }
}

void sendAll(String msg) {
  if (!sysStatus.wifiConnected) return;

  for (int i = 0; i < recipientCount; i++) {
    if (recipients[i].active && recipients[i].chatID != 0) {
      bot.sendMessage(String(recipients[i].chatID), msg);
      delay(100);
    }
  }
}

// ============ UTILITY FUNCTIONS ============
void beep(int ms) {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(ms);
  digitalWrite(BUZZER_PIN, LOW);
}

String getTimestamp() {
  if (!ntp.isTimeSet()) {
    return "N/A";
  }

  time_t t = ntp.getEpochTime();
  struct tm* ti = localtime(&t);

  char buf[20];
  sprintf(buf, "%04d-%02d-%02d %02d:%02d:%02d",
          ti->tm_year + 1900,
          ti->tm_mon + 1,
          ti->tm_mday,
          ti->tm_hour,
          ti->tm_min,
          ti->tm_sec);

  return String(buf);
}

time_t parseTime(String hm) {
  if (hm.length() < 5) return 0;

  String ts = getTimestamp();
  if (ts == "N/A") return 0;

  int y = ts.substring(0, 4).toInt();
  int m = ts.substring(5, 7).toInt();
  int d = ts.substring(8, 10).toInt();
  int h = hm.substring(0, 2).toInt();
  int min = hm.substring(3, 5).toInt();

  struct tm t = { 0 };
  t.tm_year = y - 1900;
  t.tm_mon = m - 1;
  t.tm_mday = d;
  t.tm_hour = h;
  t.tm_min = min;
  t.tm_sec = 0;
  t.tm_isdst = -1;

  return mktime(&t);
}

String readEEPROM(int addr) {
  String result = "";
  for (int i = addr; i < addr + 60; i++) {
    char c = EEPROM.read(i);
    if (c == 0 || c == 255) break;
    result += c;
  }
  return result;
}

void writeEEPROM(int addr, String data) {
  for (int i = 0; i < 60; i++) {
    if (i < data.length()) {
      EEPROM.write(addr + i, data[i]);
    } else {
      EEPROM.write(addr + i, 0);
    }
  }
  EEPROM.commit();
}
