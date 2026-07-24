# API Integrations Guide

This Smart Plant Assistant now integrates with 7 powerful APIs to enhance plant care tracking and personalization.

## 1. Weather API (OpenWeatherMap)

**Purpose**: Provides real-time weather data to adjust watering schedules dynamically.

**Setup**:
1. Visit [OpenWeatherMap](https://openweathermap.org/api)
2. Sign up for a free account
3. Create an API key from your account dashboard
4. Add to `.env.local`:
   ```
   OPENWEATHER_API_KEY=your_key_here
   ```

**Features**:
- Current temperature, humidity, wind speed
- Rainfall detection for automatic watering delay
- Weather-aware care reminders

**Usage**:
```tsx
import { getWeather } from "@/lib/weather.server";

const weather = await getWeather({ lat: 40.7128, lon: -74.006 });
```

---

## 2. AI Plant Doctor (Anthropic Claude)

**Purpose**: Provides expert plant care advice using AI.

**Setup**:
1. Visit [Anthropic Console](https://console.anthropic.com)
2. Sign up or log in
3. Generate an API key
4. Add to `.env.local`:
   ```
   ANTHROPIC_API_KEY=your_key_here
   ```

**Features**:
- Diagnose plant issues from descriptions
- Personalized care recommendations
- Natural language conversation

**Usage**:
```tsx
import { askAIDoctor } from "@/lib/ai-doctor.server";

const advice = await askAIDoctor({
  plantName: "Monstera",
  issue: "Leaves turning yellow"
});
```

---

## 3. USDA Hardiness Zone Database

**Purpose**: Determines your growing zone and provides seasonal planting tips.

**Setup**:
- No API key required (uses lat/lon based lookup)
- Automatically detects from user's location

**Features**:
- Zone-specific care recommendations
- Seasonal planting guides
- Cold hardiness information

**Usage**:
```tsx
import { getHardinessZone } from "@/lib/hardiness-zone.server";

const zone = await getHardinessZone({ lat: 40.7128, lon: -74.006 });
// Returns: { zone: "6-8", region: "Temperate", seasonalTips: "..." }
```

---

## 4. Trefle Plant Database

**Purpose**: Enriches plant data with detailed botanical information.

**Setup**:
1. Visit [Trefle.io](https://trefle.io)
2. Sign up for a free account
3. Copy your API token
4. Add to `.env.local`:
   ```
   TREFLE_API_KEY=your_token_here
   ```

**Features**:
- Bloom times and seasons
- Water and care requirements
- Toxicity information
- Companion planting suggestions

**Usage**:
```tsx
import { enrichPlantData } from "@/lib/trefle.server";

const data = await enrichPlantData({
  scientificName: "Monstera deliciosa"
});
```

---

## 5. Google Vision API (Image Recognition)

**Purpose**: Analyzes plant photos for health status and pest detection.

**Setup**:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable Vision API
4. Create service account credentials
5. Add to `.env.local`:
   ```
   GOOGLE_VISION_API_KEY=your_key_here
   ```

**Features**:
- Leaf condition analysis
- Color and texture assessment
- Pest detection recommendations
- Complements Pl@ntNet identification

**Usage**:
```tsx
import { analyzePlantImage } from "@/lib/image-recognition.server";

const formData = new FormData();
formData.append("image", imageBlob);
const analysis = await analyzePlantImage(formData);
```

---

## 6. Google Places API (Nursery Finder)

**Purpose**: Locates nearby plant nurseries and suppliers.

**Setup**:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable Places API
4. Create API key credentials
5. Add to `.env.local`:
   ```
   GOOGLE_PLACES_API_KEY=your_key_here
   ```

**Features**:
- Find nearby plant nurseries
- Distance and ratings
- Contact information
- Specialty plants

**Usage**:
```tsx
import { findNearbyNurseries } from "@/lib/nurseries.server";

const nurseries = await findNearbyNurseries({
  lat: 40.7128,
  lon: -74.006,
  radius: 5000
});
```

---

## 7. Geolocation API

**Purpose**: Auto-detects user location for weather and hardiness zone.

**Setup**:
- No API key required
- Uses IP-based geolocation (fallback)
- Browser geolocation API (with permission)

**Features**:
- Auto-detect city and coordinates
- Reverse geocoding (address to coordinates)
- Timezone detection

**Usage**:
```tsx
import { getUserLocation, geocodeAddress } from "@/lib/geolocation.server";

const location = await getUserLocation();
const coords = await geocodeAddress({ address: "New York, NY" });
```

---

## Bonus: Push Notifications

**Purpose**: Send reminders for watering, disease alerts, and weather updates.

**Setup** (Optional):
- Firebase Cloud Messaging (recommended)
- OneSignal (simpler alternative)

**Features**:
- Daily digest emails
- Watering reminders
- Disease alerts
- Weather warnings

```tsx
import { sendNotification } from "@/lib/notifications.server";

await sendNotification({
  title: "Time to water!",
  body: "Your Monstera needs water today",
  plantId: "monstera",
  type: "watering"
});
```

---

## Environment Setup

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your API keys:
   ```
   PLANTNET_API_KEY=sk_...
   OPENWEATHER_API_KEY=abc123...
   ANTHROPIC_API_KEY=sk-ant-...
   # etc.
   ```

3. Never commit `.env.local` to version control

---

## Cost Estimates (Monthly)

| Service | Free Tier | Paid Tier |
|---------|-----------|-----------|
| OpenWeatherMap | 1,000 calls/day | $200-500 |
| Anthropic Claude | $5 credit | Pay as you go (~$0.003/msg) |
| Trefle | 500 calls/day | €9.99/month |
| Google Vision | 1,000 units/month free | $1.50 per 1K units after |
| Google Places | $7 per 1,000 calls | Usage-based |
| Geolocation | Free (IP-based) | — |

---

## Error Handling

All API integrations include graceful fallbacks:
- Missing API keys return helpful error messages
- Network failures return mock data for demos
- Failed requests don't crash the app

Example:
```tsx
const result = await getWeather({ lat, lon });
if (result.status === "error") {
  console.error(result.message);
  // Use default weather data or hide component
}
```

---

## Best Practices

1. **Rate Limiting**: Cache API responses when possible
2. **Error Messages**: Show user-friendly messages, not raw errors
3. **Permissions**: Ask for location permission before geolocation
4. **Testing**: Use mock data for development (APIs disabled by default)
5. **Security**: Never expose API keys in client-side code

---

## Support

For issues with specific APIs, visit:
- [OpenWeatherMap Support](https://openweathermap.org/find/error)
- [Anthropic Docs](https://docs.anthropic.com)
- [Trefle Docs](https://trefle.io/api)
- [Google Cloud Docs](https://cloud.google.com/docs)
