# Soil moisture sensor (ESP8266)

Real hardware that reports live soil moisture into your Verdant garden.
Feeds `advancedWatering.ts`'s watering prediction directly (Plus/Pro tier)
and shows a live reading on the plant's Care → Water tab.

## Parts (~$8–13 total)

- Wemos D1 Mini (ESP8266), ~$3–5
- Capacitive soil moisture sensor v1.2 — **not** the cheap resistive kind,
  those corrode within weeks of contact with wet soil, ~$1–3
- Micro USB cable + any 5V USB power source, or a battery pack if you want
  it wireless (deep sleep makes a battery last weeks-months)
- A jumper wire (D0 to RST) — required for deep sleep to work

## Wiring

```
Sensor VCC  -> D1 Mini 3V3
Sensor GND  -> D1 Mini G
Sensor AOUT -> D1 Mini A0
D1 Mini D0  -> D1 Mini RST   (jumper wire, enables wake-from-deep-sleep)
```

## Setup

1. **Register the device in the app first** — sign in, go to Settings →
   Sensors (requires the Pro tier), pick the plant this sensor is attached
   to, name it, and hit "Generate device token." Copy the token shown —
   it's only displayed once.

2. **Arduino IDE**:
   - File → Preferences → "Additional Boards Manager URLs", add:
     `http://arduino.esp8266.com/stable/package_esp8266com_index.json`
   - Tools → Board → Boards Manager → install "esp8266"
   - Tools → Board → select "LOLIN(WEMOS) D1 R2 & mini"

3. Open `sensor-firmware.ino` and fill in the 4 constants at the top:
   `WIFI_SSID`, `WIFI_PASSWORD`, `API_HOST` (your deployed app's domain, no
   `https://`), and `DEVICE_TOKEN` (from step 1).

4. **Calibrate** `DRY_RAW`/`WET_RAW`: upload once, open the Serial Monitor
   (115200 baud), read the raw ADC value with the probe in open air (dry)
   and then in a glass of water (wet), and set those two constants
   accordingly. Every probe is slightly different — skipping this step just
   means the moisture % is inconsistently scaled, not wrong in direction.

5. Push the probe into the soil (up to the marked line, not past the
   circuit board), power the board, and upload the final sketch.

## What happens after that

Every 30 minutes (`SLEEP_INTERVAL_US`), the board wakes, reads the sensor,
posts one reading to `/api/sensor-ingest`, and deep-sleeps again. No app
code needs to change to add more devices — repeat step 1 per plant.

## Troubleshooting

- **Nothing shows up in the app**: open Serial Monitor while it runs —
  the sketch logs the HTTP status code and response body from every POST.
  A `401` means the token doesn't match what's in Settings → Sensors
  (re-copy it, tokens are case-sensitive hex).
- **Board never wakes up after the first reading**: the D0–RST jumper is
  either missing or the connection is loose — this wire is what lets the
  chip reset itself out of deep sleep.
- **Moisture % seems inverted or pinned at 0/100**: re-run the calibration
  step; a very dry or very wet probe reading outside the DRY_RAW/WET_RAW
  range clamps to 0 or 100, which is fine, but if it's always at one
  extreme, the two constants are probably backwards for your probe.
