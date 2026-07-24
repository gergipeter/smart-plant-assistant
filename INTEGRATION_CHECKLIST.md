# API Integration Checklist

## Setup Steps

### 1. ✅ Core APIs Implemented
- [x] Weather API (OpenWeatherMap)
- [x] AI Plant Doctor (Anthropic Claude)
- [x] Hardiness Zone (USDA)
- [x] Plant Database (Trefle)
- [x] Image Recognition (Google Vision)
- [x] Location Services (Geolocation)
- [x] Nursery Finder (Google Places)

### 2. Environment Variables
```bash
# Copy template
cp .env.example .env.local

# Add your keys to .env.local
OPENWEATHER_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
TREFLE_API_KEY=xxx
GOOGLE_VISION_API_KEY=xxx
GOOGLE_PLACES_API_KEY=xxx
```

### 3. Component Integration
- [x] WeatherCard component
- [x] AIDoctorChat component
- [x] HardinessZoneInfo component
- [x] NurseriesFinder component
- [x] EnhancedDashboard wrapper

### 4. Server Functions
- [x] `getWeather()` - Fetch weather data
- [x] `askAIDoctor()` - Get AI plant advice
- [x] `getHardinessZone()` - Get USDA zone info
- [x] `enrichPlantData()` - Get plant details from Trefle
- [x] `analyzePlantImage()` - Analyze plant photos
- [x] `getUserLocation()` - Auto-detect location
- [x] `geocodeAddress()` - Convert address to coordinates
- [x] `findNearbyNurseries()` - Find local plant shops
- [x] `sendNotification()` - Send push notifications

## Quick Start

### 1. Get API Keys
Each API has a free tier:

**OpenWeatherMap** (5-min forecast)
- Go to https://openweathermap.org/api
- Free: 1,000 calls/day

**Anthropic Claude** (AI Plant Doctor)
- Go to https://console.anthropic.com
- Free: $5 credit for new accounts

**Trefle** (Plant Database)
- Go to https://trefle.io
- Free: 500 calls/day

**Google Cloud** (Vision, Places)
- Go to https://console.cloud.google.com
- Free: 1,000 requests/month for Vision, $7 per 1K for Places

### 2. Add Keys to .env.local
```env
OPENWEATHER_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
TREFLE_API_KEY=your_token
GOOGLE_VISION_API_KEY=your_key
GOOGLE_PLACES_API_KEY=your_key
```

### 3. Import in Your Routes
```tsx
import { WeatherCard } from "@/components/WeatherCard";
import { AIDoctorChat } from "@/components/AIDoctorChat";
import { HardinessZoneInfo } from "@/components/HardinessZoneInfo";
import { NurseriesFinder } from "@/components/NurseriesFinder";
import { EnhancedDashboard } from "@/components/EnhancedDashboard";

export default function MyRoute() {
  return <EnhancedDashboard />;
}
```

### 4. Per-Component Usage

**Weather Card**
```tsx
<WeatherCard lat={40.7128} lon={-74.006} />
```

**AI Doctor Chat**
```tsx
const [showDoctor, setShowDoctor] = useState(false);
{showDoctor && (
  <AIDoctorChat
    plantName="Monstera"
    onClose={() => setShowDoctor(false)}
  />
)}
```

**Hardiness Zone**
```tsx
<HardinessZoneInfo lat={40.7128} lon={-74.006} />
```

**Nursery Finder**
```tsx
const [showNurseries, setShowNurseries] = useState(false);
<NurseriesFinder
  lat={40.7128}
  lon={-74.006}
  isOpen={showNurseries}
  onClose={() => setShowNurseries(false)}
/>
```

## Features by Component

### WeatherCard
- Current temperature
- Weather condition with icon
- Humidity percentage
- Wind speed
- Rainfall amount (if applicable)
- Auto-updates plant watering schedule

### AIDoctorChat
- Describe plant issues in natural language
- Get AI-powered diagnosis and advice
- Follow-up questions supported
- Confidence rating on advice

### HardinessZoneInfo
- USDA hardiness zone for location
- Min/max winter temperatures
- Regional climate classification
- Seasonal planting tips

### NurseriesFinder
- List nearby plant nurseries
- Distance and ratings
- Contact information
- Specialty plants offered
- Website links

### EnhancedDashboard
- Auto-detects user location
- Integrates all features above
- Shows active feature status
- Falls back gracefully if APIs unavailable

## Error Handling

All components handle errors gracefully:
- Missing API keys: Show error message, skip feature
- Network failures: Use cached data or defaults
- Invalid locations: Use fallback coordinates

Example:
```tsx
const result = await getWeather({ lat, lon });
if (result.status === "error") {
  // result.message contains user-friendly error
  // Component doesn't crash
}
```

## Testing Without API Keys

All APIs have fallback data for development:
```tsx
// Without OPENWEATHER_API_KEY, weather card shows default data
const weather = await getWeather({ lat: 40.7128, lon: -74.006 });
// Always returns: { status: "ok", data: {...defaultWeather} }
```

## Deployment Notes

### Environment Variables
- Set API keys in your deployment platform:
  - Vercel: Settings → Environment Variables
  - Netlify: Site settings → Build & deploy → Environment
  - Docker: Use `.env` file or secrets
  - Heroku: Config Vars

### Rate Limiting
- Implement caching for frequently called APIs
- Consider using service workers for offline support
- Monitor API usage in respective dashboards

### Security
- Never commit `.env.local` to git
- Keep API keys secret (they're valuable!)
- Rotate keys periodically
- Use API key restrictions where available

## Monitoring

Monitor these in your API dashboards:
1. **OpenWeatherMap**: API calls (Free: 1,000/day limit)
2. **Anthropic**: Token usage (~$0.003 per message)
3. **Trefle**: API calls (Free: 500/day limit)
4. **Google Cloud**: API usage and billing

## Future Enhancements

- [ ] Firebase Cloud Messaging for notifications
- [ ] OneSignal integration for email/SMS
- [ ] Advanced weather forecasting
- [ ] ML-based pest/disease prediction
- [ ] Plant community recommendations
- [ ] Historical weather data for trends
- [ ] Batch operations optimization
- [ ] Offline support with sync

## Support & Troubleshooting

**Weather not loading?**
- Check OPENWEATHER_API_KEY is set
- Verify latitude/longitude are valid
- Check API rate limits on OpenWeatherMap dashboard

**AI Doctor not responding?**
- Check ANTHROPIC_API_KEY is set
- Ensure your account has credits
- Check Anthropic API status

**Nurseries not found?**
- Check GOOGLE_PLACES_API_KEY is set
- Verify location coordinates
- Check if nurseries exist in your area

**Image analysis failing?**
- Check GOOGLE_VISION_API_KEY is set
- Ensure image is valid (JPG/PNG)
- Check file size isn't too large

For detailed API docs, see [API_INTEGRATIONS.md](./API_INTEGRATIONS.md)
