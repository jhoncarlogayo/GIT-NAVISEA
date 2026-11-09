#define TINY_GSM_MODEM_SIM7600
#include <TinyGsmClient.h>
#include <Firebase_ESP_Client.h>
#include <TinyGPS++.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// --- PINS ---
#define RXD2       16
#define TXD2       17
#define BUZZER     18
#define MODEM_RX   26 
#define MODEM_TX   27
#define MODEM_PWRKEY 4  // Nakakonekta sa P/R (PowerKey) ng A7670C

// --- APN ---
#define APN       "http.globe.com.ph"
#define GPRS_USER ""
#define GPRS_PASS ""
#define GSM_PIN   ""

// --- FIREBASE ---
#define DATABASE_URL    "https://navisea-fe61d-default-rtdb.asia-southeast1.firebasedatabase.app"
#define DATABASE_SECRET "TeuDafUSzhrNWznBHvXBirjFRW68VbfYdM0kbkYf"
#define VESSEL_KEY      "/vessels/-Oqe0ugjZrI5ltIJxTQj"
#define ZONES_KEY       "/restricted_zones"

// --- SMS ---
#define SMS_RECIPIENT "+639949159196"

// --- OBJECTS ---
TinyGPSPlus    gps;
HardwareSerial neogps(2);
HardwareSerial modemSerial(1);
TinyGsm        modem(modemSerial);
TinyGsmClient  gsmClient(modem);
FirebaseData   fbdo;
FirebaseAuth   auth;
FirebaseConfig config;

bool networkStatus = false;
void networkConnectionCB() {
  networkStatus = modem.isGprsConnected();
  if (!networkStatus) networkStatus = modem.gprsConnect(APN, GPRS_USER, GPRS_PASS);
}
void networkStatusCB() { networkStatus = modem.isGprsConnected(); fbdo.setNetworkStatus(networkStatus); }

// --- ZONES ---
struct Zone { float lat, lng, radius; bool active; char name[64]; };
#define MAX_ZONES 10
Zone zones[MAX_ZONES];
int  zoneCount = 0;

// --- GPS SMOOTHING ---
float smoothLat = 0, smoothLng = 0;
const float SMOOTH = 0.2;

// --- STATE ---
float  currentLat = 0, currentLng = 0, currentSpeed = 0;
int    currentHeading = 0;
String vesselName  = "Unknown Vessel";
bool   zonesLoaded = false;

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

// --- DECLARATIONS ---
float getDistance(float, float, float, float);
void  loadZonesFromFirebase();
void  loadVesselName();
bool  initCellular();

// ─────────────────────────────────────────────────────────────────────────
bool initCellular() {
  Serial.println("[MODEM] Turning on A7670C via PWRKEY...");
  
  // I-pulse ang P/R pin para mag-on ang modem
  pinMode(MODEM_PWRKEY, OUTPUT);
  digitalWrite(MODEM_PWRKEY, HIGH);
  delay(1000);
  digitalWrite(MODEM_PWRKEY, LOW);  // Send LOW pulse (Ground) sa P/R
  delay(1500);                      // Maghintay ng 1.5 segundo
  digitalWrite(MODEM_PWRKEY, HIGH); // Ibalik sa HIGH
  
  delay(3000); // Maghintay mag-stabilize ang modem

  Serial.println("[MODEM] Initializing A7670C...");
  modemSerial.begin(115200, SERIAL_8N1, MODEM_RX, MODEM_TX);
  delay(3000);

  if (!modem.init()) {
    Serial.println("[MODEM] Init failed!");
    return false;
  }

  modem.setNetworkMode(38); // LTE only
  modem.waitResponse(10000L);

  Serial.println("[MODEM] Waiting for network...");
  if (!modem.waitForNetwork(60000L)) {
    Serial.println("[MODEM] Network registration failed!");
    return false;
  }

  Serial.print("[MODEM] Connecting GPRS: "); Serial.println(APN);
  if (!modem.gprsConnect(APN, GPRS_USER, GPRS_PASS)) {
    Serial.println("[MODEM] GPRS failed!");
    return false;
  }
  Serial.println("[MODEM] Globe 4G Connected!");

  // Set system time manually before Firebase init (legacy token needs valid time)
  struct timeval tv = { (time_t)1704067200, 0 }; // Jan 1 2024 00:00:00 UTC
  settimeofday(&tv, nullptr);
  Serial.println("[MODEM] Time set OK.");

  return true;
}

// ─────────────────────────────────────────────────────────────────────────
void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
  Serial.begin(115200);
  neogps.begin(9600, SERIAL_8N1, RXD2, TXD2);

  pinMode(BUZZER,     OUTPUT); digitalWrite(BUZZER,     LOW);

  if (!initCellular()) {
    Serial.println("Modem failed. Halting.");
    while (true) delay(1000);
  }

  config.database_url               = DATABASE_URL;
  config.signer.tokens.legacy_token = DATABASE_SECRET;
  config.token_status_callback      = tokenStatusCallback;
  Firebase.setSystemTime(1704067200);

  Firebase.reconnectNetwork(true);
  fbdo.setBSSLBufferSize(4096, 1024);
  fbdo.setGenericClient(&gsmClient, networkConnectionCB, networkStatusCB);
  Firebase.setDoubleDigits(5);
  Firebase.begin(&config, &auth);
  fbdo.setResponseSize(4096);
  fbdo.setNetworkStatus(true);

  Serial.println("Waiting for Firebase.ready()...");
  unsigned long fbStart = millis();
  while (!Firebase.ready() && millis() - fbStart < 60000) {
    Serial.printf(". [%lus] token=%d\n", (millis() - fbStart) / 1000, (int)Firebase.authTokenInfo().status);
    delay(1000);
  }

  if (Firebase.ready()) {
    Serial.println("Firebase ready!");
    loadVesselName();
    loadZonesFromFirebase();
    zonesLoaded = true;
  } else {
    Serial.println("Firebase timeout — will retry in loop.");
  }
}

// ─────────────────────────────────────────────────────────────────────────
void loop() {
  // 1. READ GPS
  while (neogps.available() > 0) {
    if (gps.encode(neogps.read()) && gps.location.isValid()) {
      float rawLat = gps.location.lat();
      float rawLng = gps.location.lng();
      float hdop   = gps.hdop.isValid()       ? gps.hdop.hdop()            : 99.0;
      int  sats   = gps.satellites.isValid() ? (int)gps.satellites.value() : 0;

      if (hdop < 3.0 && sats >= 4) {
        if (smoothLat == 0 && smoothLng == 0) {
          smoothLat = rawLat; smoothLng = rawLng;
        } else {
          smoothLat += SMOOTH * (rawLat - smoothLat);
          smoothLng += SMOOTH * (rawLng - smoothLng);
        }
        currentLat     = smoothLat;
        currentLng     = smoothLng;
        currentSpeed   = gps.speed.knots();
        currentHeading = (int)gps.course.deg();
        Serial.printf("GPS OK: %.6f, %.6f | HDOP:%.1f Sats:%d\n", currentLat, currentLng, hdop, sats);
      } else {
        Serial.printf("GPS weak: HDOP=%.1f Sats=%d — skipped\n", hdop, sats);
      }
    }
  }

  // 2. Wait for GPS fix
  if (currentLat == 0.0 && currentLng == 0.0) {
    digitalWrite(BUZZER, LOW);
    Serial.println("Waiting for GPS fix...");
    delay(1000);
    return;
  }

  // 3. Firebase not ready yet
  if (!Firebase.ready()) {
    Serial.println("Firebase not ready...");
    delay(1000);
    return;
  }

  // 4. Load zones once
  if (!zonesLoaded) {
    loadVesselName();
    loadZonesFromFirebase();
    zonesLoaded = true;
  }

  unsigned long now = millis();

  // 5. Reload zones every 30s
  if (now - lastZoneSync > zoneSyncInterval) {
    lastZoneSync = now;
    loadZonesFromFirebase();
  }

  // 6. Reload vessel name every 10s
  if (now - lastNameSync > nameSyncInterval) {
    lastNameSync = now;
    loadVesselName();
  }

  // 7. Zone check
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
      String smsMsg = "NAVISEA ALERT!\nVessel: " + vesselName +
                      "\nBREACH: Entered \"" + violatedZone + "\"" +
                      "\nCoords: " + String(currentLat, 5) + ", " + String(currentLng, 5) +
                      "\nSpeed: " + String(currentSpeed, 1) + " kn";
      modem.sendSMS(SMS_RECIPIENT, smsMsg);

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
    lastInsideZone = true;
    lastNearZone   = false;

  // ── WARNING ──
  } else if (nearAny) {
    vesselStatus = "active";
    digitalWrite(BUZZER, (millis() % 500 < 250) ? HIGH : LOW);
    if (!lastNearZone) {
      String smsMsg = "NAVISEA WARNING!\nVessel: " + vesselName +
                      "\nApproaching: \"" + violatedZone + "\"" +
                      "\nDistance: " + String(closestDist, 1) + "m away" +
                      "\nCoords: " + String(currentLat, 5) + ", " + String(currentLng, 5);
      modem.sendSMS(SMS_RECIPIENT, smsMsg);
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

  // 8. Web buzzer command
  if (now - lastBuzzerCheck > buzzerInterval) {
    lastBuzzerCheck = now;
    if (Firebase.RTDB.getBool(&fbdo, String(VESSEL_KEY) + "/buzzer")) {
      bool webBuzzer = fbdo.boolData();
      digitalWrite(BUZZER, (webBuzzer && (insideAny || nearAny)) ? HIGH : LOW);
      Serial.println(webBuzzer ? "BUZZER: ON (web)" : "BUZZER: OFF");
    }
  }

  Serial.printf("GPS: %.6f, %.6f | %.1fkn | %s | Vessel: %s | 4G:%s\n",
    currentLat, currentLng, currentSpeed,
    vesselStatus.c_str(), vesselName.c_str(),
    modem.isGprsConnected() ? "CONNECTED" : "DISCONNECTED");

  // 9. Firebase sync
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
    else
      Serial.println("Sync error: " + fbdo.errorReason());
  }
}

// ─────────────────────────────────────────────────────────────────────────
void loadVesselName() {
  if (!Firebase.ready()) return;
  if (Firebase.RTDB.getString(&fbdo, String(VESSEL_KEY) + "/name")) {
    String fetched = fbdo.stringData();
    if (fetched.length() > 0 && fetched != vesselName) {
      vesselName = fetched;
      Serial.println("Vessel name updated: " + vesselName);
    }
  } else {
    Serial.println("Vessel name error: " + fbdo.errorReason());
  }
}

// ─────────────────────────────────────────────────────────────────────────
void loadZonesFromFirebase() {
  if (!Firebase.ready()) { Serial.println("Zone skip: Firebase not ready"); return; }
  Serial.println("Loading zones...");
  if (!Firebase.RTDB.getJSON(&fbdo, ZONES_KEY)) {
    Serial.println("Zone error: " + fbdo.errorReason());
    return;
  }
  FirebaseJson &json = fbdo.jsonObject();
  zoneCount = 0;
  size_t count = json.iteratorBegin();
  for (size_t i = 0; i < count && zoneCount < MAX_ZONES; i++) {
    String key, value; int type;
    json.iteratorGet(i, type, key, value);
    if (type == FirebaseJson::JSON_OBJECT) {
      FirebaseJson zoneJson; zoneJson.setJsonData(value);
      FirebaseJsonData d;
      float lat = 0, lng = 0, radius = 0; bool active = true; String nameStr = "";
      if (zoneJson.get(d, "lat"))    lat     = d.floatValue;
      if (zoneJson.get(d, "lng"))    lng     = d.floatValue;
      if (zoneJson.get(d, "radius")) radius  = d.floatValue;
      if (zoneJson.get(d, "active")) active  = d.boolValue;
      if (zoneJson.get(d, "name"))   nameStr = d.stringValue;
      if (lat != 0 && lng != 0 && radius > 0) {
        zones[zoneCount].lat    = lat;
        zones[zoneCount].lng    = lng;
        zones[zoneCount].radius = radius;
        zones[zoneCount].active = active;
        nameStr.toCharArray(zones[zoneCount].name, 64);
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