#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <TinyGPS++.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// --- PINS ---
#define RXD2   26
#define TXD2   27
#define BUZZER 25

// --- A7670C SMS MODULE PINS ---
#define MODEM_RX 16
#define MODEM_TX 17

// --- CREDENTIALS ---
#define WIFI_SSID       "GFiber_2.4_Coverage_727B4"
#define WIFI_PASSWORD   "PkSEfF84"
#define DATABASE_URL    "https://navisea-fe61d-default-rtdb.asia-southeast1.firebasedatabase.app"
#define DATABASE_SECRET "TeuDafUSzhrNWznBHvXBirjFRW68VbfYdM0kbkYf"
#define VESSEL_KEY      "/vessels/-Oqe0ugjZrI5ltIJxTQj"
#define ZONES_KEY       "/restricted_zones"

// --- SMS RECIPIENT ---
#define SMS_RECIPIENT "+639949159196"

// --- OBJECTS ---
TinyGPSPlus    gps;
HardwareSerial neogps(2);
HardwareSerial modemSerial(1);
FirebaseData   fbdo;
FirebaseData   fbZone;
FirebaseAuth   auth;
FirebaseConfig config;

// --- ZONE STRUCT ---
struct Zone { float lat, lng, radius; bool active; char name[64]; };
#define MAX_ZONES 10
Zone zones[MAX_ZONES];
int  zoneCount = 0;

// --- GPS SMOOTHING ---
float smoothLat = 0, smoothLng = 0;
const float SMOOTH = 0.2;

// --- VARIABLES ---
float  currentLat     = 0, currentLng = 0;
float  currentSpeed   = 0;
int    currentHeading = 0;
String vesselName     = "Unknown Vessel";
bool   modemReady     = false;  // tracks if SMS module is OK

unsigned long lastSync        = 0;
unsigned long lastZoneSync    = 0;
unsigned long lastNameSync    = 0;
unsigned long lastBuzzerCheck = 0;
const long syncInterval       = 2000;
const long zoneSyncInterval   = 30000;
const long nameSyncInterval   = 10000;
const long buzzerInterval     = 10000;

bool lastInsideZone = false;
bool lastNearZone   = false;

// --- FUNCTION DECLARATIONS ---
float  getDistance(float lat1, float lon1, float lat2, float lon2);
void   loadZonesFromFirebase();
void   loadVesselName();
void   reconnectWiFi();
String sendATCommand(String cmd, int timeout = 3000);
bool   sendSMS(String phone, String msg);
bool   initModem();

// ─────────────────────────────────────────────────────────────────────────
// SMS HELPERS
// ─────────────────────────────────────────────────────────────────────────

// Returns the full response string from the modem
String sendATCommand(String cmd, int timeout) {
  while (modemSerial.available()) modemSerial.read();

  modemSerial.print(cmd + "\r\n");

  String response = "";
  long t = millis();
  long lastChar = millis();
  while (millis() - t < timeout) {
    while (modemSerial.available()) {
      char c = modemSerial.read();
      response += c;
      lastChar = millis();
    }
    // If we got something and 200ms passed with no new chars, consider done
    if (response.length() > 0 && millis() - lastChar > 200) break;
    if (response.indexOf("OK") != -1 || response.indexOf("ERROR") != -1 ||
        response.indexOf("+CME ERROR") != -1 || response.indexOf(">") != -1)
      break;
    delay(10);
  }
  response.trim();
  Serial.println("[MODEM] " + cmd + " => " + response);
  return response;
}

// Returns true if SMS was sent successfully
bool sendSMS(String phone, String msg) {
  if (!modemReady) {
    Serial.println("[SMS] Modem not ready — skipping SMS");
    return false;
  }

  Serial.println("[SMS] Sending to " + phone + "...");

  String r = sendATCommand("AT+CMGF=1", 2000);
  if (r.indexOf("OK") == -1) {
    Serial.println("[SMS] CMGF failed: " + r);
    return false;
  }

  // Send CMGS command and wait for '>' prompt
  while (modemSerial.available()) modemSerial.read(); // flush
  modemSerial.print("AT+CMGS=\"");
  modemSerial.print(phone);
  modemSerial.println("\"");

  String prompt = "";
  long t = millis();
  while (millis() - t < 5000) {
    while (modemSerial.available()) prompt += (char)modemSerial.read();
    if (prompt.indexOf(">") != -1) break;
  }
  Serial.println("[MODEM] prompt => " + prompt);

  if (prompt.indexOf(">") == -1) {
    Serial.println("[SMS] No '>' prompt received — aborting");
    modemSerial.write(27); // ESC to cancel
    return false;
  }

  // Send message body + CTRL+Z
  modemSerial.print(msg);
  delay(300);
  modemSerial.write(26); // CTRL+Z

  // Wait for +CMGS or ERROR response
  String result = "";
  t = millis();
  while (millis() - t < 10000) {
    while (modemSerial.available()) result += (char)modemSerial.read();
    if (result.indexOf("+CMGS:") != -1 || result.indexOf("ERROR") != -1) break;
  }
  result.trim();
  Serial.println("[MODEM] send result => " + result);

  if (result.indexOf("+CMGS:") != -1) {
    Serial.println("[SMS] SENT OK");
    return true;
  } else {
    Serial.println("[SMS] SEND FAILED: " + result);
    return false;
  }
}

// Returns true if modem is ready
bool initModem() {
  Serial.println("[MODEM] Initializing A7670C...");

  // Wait longer — WiFi+Firebase init above takes time, modem may need to settle
  Serial.println("[MODEM] Waiting for modem to settle...");
  delay(8000);

  // Flush any boot messages
  while (modemSerial.available()) modemSerial.read();

  // Autobaud lock: send AT\r rapidly to help A7670C lock baud rate
  String r = "";
  bool commOK = false;

  // Phase 1: rapid AT\r bursts (no delay) to lock autobaud
  for (int i = 0; i < 10; i++) {
    modemSerial.print("AT\r");
    delay(200);
  }
  while (modemSerial.available()) modemSerial.read(); // discard all
  delay(500);

  // Phase 2: normal AT tries waiting for OK
  for (int i = 0; i < 30; i++) {
    while (modemSerial.available()) modemSerial.read();
    modemSerial.print("AT\r\n");
    delay(1000);
    r = "";
    while (modemSerial.available()) r += (char)modemSerial.read();
    r.trim();
    Serial.printf("[MODEM] AT try %d => '%s'\n", i + 1, r.c_str());
    if (r.indexOf("OK") != -1) { commOK = true; break; }
  }
  if (!commOK) {
    Serial.println("[MODEM] ERROR: No response from A7670C after 30 tries.");
    return false;
  }
  Serial.println("[MODEM] Communication OK");

  // Disable echo — send twice to ensure it takes
  sendATCommand("ATE0", 1000);
  sendATCommand("ATE0", 1000);

  // Lock baud rate to 115200 permanently in NVRAM so autobaud is no longer needed
  sendATCommand("AT+IPR=115200", 2000);
  sendATCommand("AT&W", 2000);

  // Check SIM — retry up to 5x
  bool simOK = false;
  for (int i = 0; i < 5; i++) {
    delay(2000);
    r = sendATCommand("AT+CPIN?", 5000);
    if (r.indexOf("READY") != -1) { simOK = true; break; }
    Serial.printf("[MODEM] SIM not ready yet (%d/5): %s\n", i + 1, r.c_str());
  }
  if (!simOK) {
    Serial.println("[MODEM] ERROR: SIM not ready — " + r);
    return false;
  }
  Serial.println("[MODEM] SIM OK");

  // Check signal
  r = sendATCommand("AT+CSQ", 3000);
  if (r.indexOf(",") != -1) {
    int csq = r.substring(r.indexOf(":") + 2, r.indexOf(",")).toInt();
    if (csq == 0 || csq == 99)
      Serial.println("[MODEM] WARNING: Weak/no signal (CSQ=" + String(csq) + ") — SMS may fail");
    else
      Serial.println("[MODEM] Signal CSQ=" + String(csq) + " OK");
  }

  // Check network registration
  r = sendATCommand("AT+CREG?", 3000);
  if (r.indexOf(",1") == -1 && r.indexOf(",5") == -1)
    Serial.println("[MODEM] WARNING: Not registered on network — " + r);
  else
    Serial.println("[MODEM] Network registered OK");

  // Set text mode
  r = sendATCommand("AT+CMGF=1", 2000);
  if (r.indexOf("OK") == -1) {
    Serial.println("[MODEM] ERROR: Could not set text mode — " + r);
    return false;
  }

  Serial.println("[MODEM] A7670C SMS Module READY");
  return true;
}

// ─────────────────────────────────────────────────────────────────────────
void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);

  // Init modem serial FIRST before anything else
  modemSerial.begin(115200, SERIAL_8N1, MODEM_RX, MODEM_TX);
  delay(500);

  neogps.begin(9600, SERIAL_8N1, RXD2, TXD2);
  pinMode(BUZZER, OUTPUT);
  digitalWrite(BUZZER, LOW);

  // WiFi
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 40) {
    delay(500); Serial.print("."); retry++;
  }
  if (WiFi.status() == WL_CONNECTED)
    Serial.println("\nWiFi Connected: " + WiFi.localIP().toString());
  else
    Serial.println("\nWiFi failed — will retry in loop");

  // Firebase
  config.database_url               = DATABASE_URL;
  config.signer.tokens.legacy_token = DATABASE_SECRET;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  Serial.println("Firebase OK");

  // SMS Modem — store result in modemReady
  modemReady = initModem();
  if (!modemReady)
    Serial.println("[MODEM] SMS notifications DISABLED — fix modem then restart");

  delay(2000);
  loadVesselName();
  loadZonesFromFirebase();
}

// ─────────────────────────────────────────────────────────────────────────
void loop() {
  // 1. READ GPS
  while (neogps.available() > 0) {
    if (gps.encode(neogps.read()) && gps.location.isValid()) {
      float rawLat = gps.location.lat();
      float rawLng = gps.location.lng();
      float hdop   = gps.hdop.isValid()       ? gps.hdop.hdop()             : 99.0;
      int   sats   = gps.satellites.isValid() ? (int)gps.satellites.value() : 0;

      if (hdop < 3.0 && sats >= 4) {
        if (smoothLat == 0 && smoothLng == 0) {
          smoothLat = rawLat; smoothLng = rawLng;
        } else {
          smoothLat = smoothLat + SMOOTH * (rawLat - smoothLat);
          smoothLng = smoothLng + SMOOTH * (rawLng - smoothLng);
        }
        currentLat     = smoothLat;
        currentLng     = smoothLng;
        currentSpeed   = gps.speed.knots();
        currentHeading = (int)gps.course.deg();
        Serial.printf("GPS OK: %.6f, %.6f | HDOP:%.1f Sats:%d\n",
          currentLat, currentLng, hdop, sats);
      } else {
        Serial.printf("GPS weak: HDOP=%.1f Sats=%d — skipped\n", hdop, sats);
      }
    }
  }

  // 2. SKIP if no GPS fix

  bool hasGPSFix = (currentLat != 0.0 && currentLng != 0.0);
  if (!hasGPSFix) {
    digitalWrite(BUZZER, LOW);
    Serial.println("Waiting for GPS fix...");
    delay(1000);
    return;
  }

  unsigned long now = millis();

  // 3. RE-LOAD ZONES every 30s
  if (now - lastZoneSync > zoneSyncInterval) {
    lastZoneSync = now;
    loadZonesFromFirebase();
  }

  // 4. RE-LOAD VESSEL NAME every 10s
  if (now - lastNameSync > nameSyncInterval) {
    lastNameSync = now;
    loadVesselName();
  }

  // 5. CHECK ALL ZONES
  String vesselStatus = "active";
  bool   insideAny    = false;
  bool   nearAny      = false;
  float  closestDist  = 9999;
  String violatedZone = "";

  for (int i = 0; i < zoneCount; i++) {
    if (!zones[i].active) continue;
    float dist       = getDistance(currentLat, currentLng, zones[i].lat, zones[i].lng);
    float distToEdge = max(0.0f, dist - zones[i].radius);
    if (distToEdge < closestDist) {
      closestDist  = distToEdge;
      violatedZone = String(zones[i].name);
    }
    if (distToEdge < 3.0)        insideAny = true;
    else if (distToEdge <= 20.0) nearAny   = true;
  }

  // ── BREACH ──
  if (insideAny) {
    vesselStatus = "alert";
    digitalWrite(BUZZER, HIGH);

    if (!lastInsideZone) {
      String smsMsg = "NAVISEA ALERT!\n"
                      "Vessel: " + vesselName + "\n"
                      "BREACH: Entered restricted zone \"" + violatedZone + "\"\n"
                      "Coords: " + String(currentLat, 5) + ", " + String(currentLng, 5) + "\n"
                      "Speed: " + String(currentSpeed, 1) + " kn";
      sendSMS(SMS_RECIPIENT, smsMsg);

      if (WiFi.status() == WL_CONNECTED) {
        FirebaseJson alert;
        alert.set("vesselName",    vesselName);
        alert.set("alertType",     "zone_violation");
        alert.set("severity",      "critical");
        alert.set("zoneName",      violatedZone);
        alert.set("latitude",      String(currentLat, 6));
        alert.set("longitude",     String(currentLng, 6));
        alert.set("distanceM",     0);
        alert.set("status",        "BREACH");
        alert.set("message",       vesselName + " has entered restricted zone \"" + violatedZone + "\"!");
        alert.set("acknowledged",  false);
        alert.set("createdAt/.sv", "timestamp");
        Firebase.RTDB.pushJSON(&fbdo, "/alerts", &alert);
        Serial.println("ALERT PUSHED: " + vesselName + " breached " + violatedZone);
      }
    }
    lastInsideZone = true;
    lastNearZone   = false;

  // ── WARNING (approaching) ──
  } else if (nearAny) {
    vesselStatus = "active";
    digitalWrite(BUZZER, (millis() % 500 < 250) ? HIGH : LOW);

    if (!lastNearZone) {
      String smsMsg = "NAVISEA WARNING!\n"
                      "Vessel: " + vesselName + "\n"
                      "Approaching restricted zone: \"" + violatedZone + "\"\n"
                      "Distance: " + String(closestDist, 1) + "m away\n"
                      "Coords: " + String(currentLat, 5) + ", " + String(currentLng, 5);
      sendSMS(SMS_RECIPIENT, smsMsg);
      Serial.printf("WARNING SMS SENT: %.1fm from zone\n", closestDist);
    }
    lastNearZone   = true;
    lastInsideZone = false;

  // ── CLEAR ──
  } else {
    vesselStatus   = "active";
    digitalWrite(BUZZER, LOW);
    lastInsideZone = false;
    lastNearZone   = false;
  }

  // 6. CHECK WEB BUZZER COMMAND
  if (WiFi.status() == WL_CONNECTED && now - lastBuzzerCheck > buzzerInterval) {
    lastBuzzerCheck = now;
    if (Firebase.RTDB.getBool(&fbdo, String(VESSEL_KEY) + "/buzzer")) {
      bool webBuzzer = fbdo.boolData();
      if (webBuzzer && (insideAny || nearAny)) {
        digitalWrite(BUZZER, HIGH);
        Serial.println("BUZZER: ON (web)");
      } else {
        digitalWrite(BUZZER, LOW);
        Serial.println("BUZZER: OFF");
      }
    }
  }

  Serial.printf("GPS: %.6f, %.6f | %.1fkn | %s | Vessel: %s | SMS:%s | Buzzer:%s\n",
    currentLat, currentLng, currentSpeed,
    vesselStatus.c_str(), vesselName.c_str(),
    modemReady ? "OK" : "FAIL",
    (insideAny || nearAny) ? "ON" : "OFF");

  // 7. FIREBASE SYNC
  if (WiFi.status() != WL_CONNECTED) {
    reconnectWiFi();
    return;
  }

  if (now - lastSync > syncInterval) {
    lastSync = now;
    FirebaseJson json;
    json.set("latitude",       String(currentLat, 6));
    json.set("longitude",      String(currentLng, 6));
    json.set("speed",          currentSpeed);
    json.set("heading",        currentHeading);
    json.set("status",         vesselStatus);
    json.set("lastSeenAt/.sv", "timestamp");
    json.set("updatedAt/.sv",  "timestamp");

    if (Firebase.RTDB.updateNode(&fbdo, VESSEL_KEY, &json))
      Serial.println("Sync OK -> " + vesselStatus);
    else {
      Serial.println("Sync error: " + fbdo.errorReason());
      Firebase.begin(&config, &auth);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
void loadVesselName() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (Firebase.RTDB.getString(&fbdo, String(VESSEL_KEY) + "/name")) {
    String fetched = fbdo.stringData();
    if (fetched.length() > 0 && fetched != vesselName) {
      vesselName = fetched;
      Serial.println("Vessel name updated: " + vesselName);
    }
  } else {
    Serial.println("Name fetch failed — keeping: " + vesselName);
  }
}

// ─────────────────────────────────────────────────────────────────────────
void reconnectWiFi() {
  Serial.println("WiFi lost — reconnecting...");
  WiFi.disconnect();
  delay(500);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(500); Serial.print("."); retry++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi reconnected: " + WiFi.localIP().toString());
    Firebase.begin(&config, &auth);
  } else {
    Serial.println("\nReconnect failed — will retry next loop");
  }
}

// ─────────────────────────────────────────────────────────────────────────
void loadZonesFromFirebase() {
  if (WiFi.status() != WL_CONNECTED) return;
  Serial.println("Loading zones...");
  if (!Firebase.RTDB.getJSON(&fbZone, ZONES_KEY)) {
    Serial.println("Zone error: " + fbZone.errorReason());
    return;
  }
  FirebaseJson &json = fbZone.jsonObject();
  zoneCount = 0;
  size_t count = json.iteratorBegin();
  for (size_t i = 0; i < count && zoneCount < MAX_ZONES; i++) {
    String key, value; int type;
    json.iteratorGet(i, type, key, value);
    if (type == FirebaseJson::JSON_OBJECT) {
      FirebaseJson zoneJson; zoneJson.setJsonData(value);
      FirebaseJsonData d;
      float lat = 0, lng = 0, radius = 0; bool active = true; String name = "";
      if (zoneJson.get(d, "lat"))    lat    = d.floatValue;
      if (zoneJson.get(d, "lng"))    lng    = d.floatValue;
      if (zoneJson.get(d, "radius")) radius = d.floatValue;
      if (zoneJson.get(d, "active")) active = d.boolValue;
      if (zoneJson.get(d, "name"))   name   = d.stringValue;
      if (lat != 0 && lng != 0 && radius > 0) {
        zones[zoneCount] = { lat, lng, radius, active };
        name.toCharArray(zones[zoneCount].name, 64);
        zoneCount++;
        Serial.printf("Zone %d: %s %.6f,%.6f r=%.1fm active=%d\n",
          zoneCount, zones[zoneCount-1].name, lat, lng, radius, active);
      }
    }
  }
  json.iteratorEnd();
  Serial.printf("Loaded %d zones.\n", zoneCount);
}

// ─────────────────────────────────────────────────────────────────────────
float getDistance(float lat1, float lon1, float lat2, float lon2) {
  double dLat = (lat2 - lat1) * M_PI / 180.0;
  double dLon = (lon2 - lon1) * M_PI / 180.0;
  double a    = pow(sin(dLat / 2), 2)
              + pow(sin(dLon / 2), 2)
              * cos(lat1 * M_PI / 180.0)
              * cos(lat2 * M_PI / 180.0);
  return 6371000 * 2 * atan2(sqrt(a), sqrt(1 - a));
}
