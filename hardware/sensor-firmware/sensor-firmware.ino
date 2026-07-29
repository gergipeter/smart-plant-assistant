// Verdant soil-moisture sensor firmware — ESP8266 (Wemos D1 Mini) +
// capacitive soil moisture probe.
//
// Wiring:
//   Sensor VCC -> 3V3
//   Sensor GND -> G
//   Sensor AOUT -> A0
//
// Board setup (Arduino IDE):
//   1. File > Preferences > Additional Board URLs, add:
//      http://arduino.esp8266.com/stable/package_esp8266com_index.json
//   2. Tools > Board > Boards Manager, install "esp8266"
//   3. Tools > Board, select "LOLIN(WEMOS) D1 R2 & mini"
//   4. Fill in the 4 constants below, then Upload.
//
// Behavior: wakes, connects to WiFi, reads the sensor, posts one JSON
// reading to the app's ingestion endpoint, then deep-sleeps. Deep sleep
// requires wiring D0 to RST on the D1 Mini (a jumper wire) — without that
// jumper the board won't wake up on its own after esp.deepSleep().

#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <ESP8266HTTPClient.h>

// ---- Fill these in ----
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* API_HOST = "your-app.example.com";        // no https://, no trailing slash
const char* DEVICE_TOKEN = "PASTE_TOKEN_FROM_SENSORS_PAGE";
// ------------------------

// How often to take + send a reading. Deep sleep draws far less power than
// a delay() loop, so this is safe to run on battery for weeks.
const uint64_t SLEEP_INTERVAL_US = 30ULL * 60ULL * 1000000ULL; // 30 minutes

// Capacitive probes read LOWER when wetter and HIGHER when dry — the
// opposite of what "soil moisture %" should feel like, so this inverts and
// scales the raw ADC value. Calibrate these two for your specific probe:
// dip it in water and note the reading (-> WET_RAW), let it dry in open air
// and note that reading (-> DRY_RAW).
const int DRY_RAW = 800;
const int WET_RAW = 300;

float readSoilMoisturePercent() {
  int raw = analogRead(A0); // 0-1023
  int clamped = constrain(raw, WET_RAW, DRY_RAW);
  float percent = 100.0 * (float)(DRY_RAW - clamped) / (float)(DRY_RAW - WET_RAW);
  return percent;
}

// D1 Mini has no onboard battery ADC wired by default; this is a stub for
// boards with a voltage divider on A0 shared with the sensor, or a fuel
// gauge IC. Returns -1 (omitted from the payload) until you wire one up.
float readBatteryPercent() {
  return -1;
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();
}

void sendReading(float moisture, float battery) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, skipping send.");
    return;
  }

  WiFiClientSecure client;
  client.setInsecure(); // skips cert validation — acceptable for a
                         // low-stakes personal IoT device; use client.setTrustAnchors()
                         // with a pinned cert if you want stricter validation.

  HTTPClient https;
  String url = String("https://") + API_HOST + "/api/sensor-ingest";
  if (!https.begin(client, url)) {
    Serial.println("Unable to begin HTTPS connection.");
    return;
  }

  https.addHeader("Content-Type", "application/json");
  https.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);

  String body = String("{\"soilMoisture\":") + String(moisture, 1);
  if (battery >= 0) {
    body += ",\"batteryPercent\":" + String(battery, 1);
  }
  body += "}";

  int status = https.POST(body);
  Serial.printf("POST %s -> %d\n", url.c_str(), status);
  if (status > 0) {
    Serial.println(https.getString());
  }
  https.end();
}

void setup() {
  Serial.begin(115200);
  delay(100);

  connectWiFi();

  float moisture = readSoilMoisturePercent();
  float battery = readBatteryPercent();
  Serial.printf("Soil moisture: %.1f%%\n", moisture);

  sendReading(moisture, battery);

  WiFi.disconnect(true);
  Serial.println("Going to sleep.");
  ESP.deepSleep(SLEEP_INTERVAL_US);
}

void loop() {
  // Unused — deep sleep restarts setup() on wake instead of looping.
}
