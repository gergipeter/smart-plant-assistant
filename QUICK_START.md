# Quick Start Guide - API Integrations

Get all 7 APIs working in 10 minutes.

## 1. Copy Environment Template (1 min)

```bash
cp .env.example .env.local
```

## 2. Get Free API Keys (5 min)

### OpenWeatherMap (Weather)
1. Go to https://openweathermap.org/api
2. Sign up → Click "API keys" in nav
3. Copy your **API Key** (top of page)
4. Add to `.env.local`:
   ```
   OPENWEATHER_API_KEY=paste_here
   ```

### Anthropic Claude (AI Doctor)
1. Go to https://console.anthropic.com
2. Sign up with email
3. Click "API keys" in sidebar
4. Create new key (Claude 3.5 Sonnet)
5. Add to `.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-paste_here
   ```

### Trefle (Plant Database)
1. Go to https://trefle.io/api
2. Sign up (free plan: 500 calls/day)
3. Go to https://trefle.io/api/auth/token
4. Copy your **API Token**
5. Add to `.env.local`:
   ```
   TREFLE_API_KEY=paste_here
   ```

### Google Cloud (Vision + Places)
1. Go to https://console.cloud.google.com
2. Create new project
3. Enable APIs:
   - Cloud Vision API
   - Places API
4. Go to Credentials → Create API Key
5. Add to `.env.local`:
   ```
   GOOGLE_VISION_API_KEY=paste_here
   GOOGLE_PLACES_API_KEY=paste_here
   ```

### Hardiness Zone & Geolocation
✅ No API key needed! (Built-in data + IP-based geolocation)

## 3. Your `.env.local` Should Look Like:

```env
PLANTNET_API_KEY=xxxxx          # From Pl@ntNet dashboard
OPENWEATHER_API_KEY=xxxxx       # From OpenWeatherMap
ANTHROPIC_API_KEY=sk-ant-xxxxx  # From Anthropic Console
TREFLE_API_KEY=xxxxx            # From Trefle
GOOGLE_VISION_API_KEY=xxxxx     # From Google Cloud
GOOGLE_PLACES_API_KEY=xxxxx     # From Google Cloud
```

## 4. Restart Dev Server (1 min)

```bash
# Stop current server (Ctrl+C)
# Start fresh
npm run dev
# or
yarn dev
```

## 5. Use in Your Code (3 min)

### Option A: Use Pre-Built Components (Easiest)

```tsx
import { WeatherCard } from "@/components/WeatherCard";
import { AIDoctorChat } from "@/components/AIDoctorChat";
import { HardinessZoneInfo } from "@/components/HardinessZoneInfo";
import { NurseriesFinder } from "@/components/NurseriesFinder";

export default function MyRoute() {
  return (
    <div>
      <WeatherCard lat={40.7128} lon={-74.006} />
      <HardinessZoneInfo lat={40.7128} lon={-74.006} />
      
      <AIDoctorChat
        plantName="Monstera"
        onClose={() => {}}
      />
      
      <NurseriesFinder
        lat={40.7128}
        lon={-74.006}
        isOpen={true}
        onClose={() => {}}
      />
    </div>
  );
}
```

### Option B: Use Raw Server Functions

```tsx
import { getWeather } from "@/lib/weather.server";
import { askAIDoctor } from "@/lib/ai-doctor.server";

// In a component or server action
const weather = await getWeather({ lat: 40.7128, lon: -74.006 });
if (weather.status === "ok") {
  console.log(`Temp: ${weather.data.temp}°C`);
}

const advice = await askAIDoctor({
  plantName: "Monstera",
  issue: "Yellow leaves"
});
if (advice.status === "ok") {
  console.log(advice.advice);
}
```

## 6. Test Each API

### Test Weather
```tsx
const result = await getWeather({ lat: 40.7128, lon: -74.006 });
console.log(result); // Should show weather data
```

### Test AI Doctor
```tsx
const result = await askAIDoctor({
  plantName: "Monstera",
  issue: "Leaves drooping"
});
console.log(result); // Should show advice
```

### Test Hardiness Zone
```tsx
const result = await getHardinessZone({ lat: 40.7128, lon: -74.006 });
console.log(result); // Should show zone 6-8
```

### Test Image Analysis
```tsx
const formData = new FormData();
formData.append("image", imageBlob);
const result = await analyzePlantImage(formData);
console.log(result); // Should show health status
```

### Test Nursery Finder
```tsx
const result = await findNearbyNurseries({
  lat: 40.7128,
  lon: -74.006
});
console.log(result); // Should show nearby shops
```

## 7. Deploy to Production

### On Vercel:
1. Settings → Environment Variables
2. Add all 6 keys from `.env.local`
3. Redeploy

### On Netlify:
1. Site settings → Build & deploy → Environment
2. Add all 6 keys
3. Redeploy

### On Other Platforms:
Set environment variables in your platform's dashboard.

## Troubleshooting

### "API key not found" error?
- Check `.env.local` exists
- Verify key is copied exactly
- Restart dev server
- Check no extra spaces

### "Cannot find module" error?
- Files created? Check:
  - `src/lib/weather.server.ts`
  - `src/components/WeatherCard.tsx`
- Restart dev server
- Check for typos in import

### API returns error status?
- Check key is valid (test in service dashboard)
- Check rate limits (free tier limits)
- Check internet connection
- Network tab shows 401/403? Invalid key

### Feature not showing?
- Check component is imported
- Check props (lat/lon) are passed
- Check browser console for errors
- Try simple test first

## Feature Checklist

- [ ] Weather loads
- [ ] AI Doctor responds
- [ ] Hardiness zone shows
- [ ] Image analysis works
- [ ] Nurseries found
- [ ] Location auto-detected
- [ ] All 7 APIs working!

## What Each API Gives You

| API | Shows | Requires |
|-----|-------|----------|
| Weather | Temp, humidity, wind, rain | OPENWEATHER_API_KEY |
| AI Doctor | Plant care advice | ANTHROPIC_API_KEY |
| Hardiness | Growing zone, tips | None |
| Image Analysis | Plant health status | GOOGLE_VISION_API_KEY |
| Nurseries | Local plant shops | GOOGLE_PLACES_API_KEY |
| Trefle | Plant details | TREFLE_API_KEY |
| Geolocation | User location | None |

## Next Steps

1. ✅ Done: APIs are working
2. **Integrate into your routes** → See [INTEGRATION_EXAMPLES.md](INTEGRATION_EXAMPLES.md)
3. **Customize components** → Edit `src/components/*.tsx`
4. **Add more features** → See [API_INTEGRATIONS.md](API_INTEGRATIONS.md)

## Common Customizations

### Change Default Location
```tsx
// Default: New York
const LAT = 40.7128;
const LON = -74.006;

// Change to your city
const LAT = 51.5074; // London
const LON = -0.1278;
```

### Update Refresh Interval
```tsx
// In WeatherCard.tsx
useEffect(() => {
  loadWeather();
  // Refresh every 30 minutes
  const interval = setInterval(loadWeather, 30 * 60 * 1000);
  return () => clearInterval(interval);
}, []);
```

### Hide Optional Features
```tsx
// Don't show weather if key not set
{process.env.OPENWEATHER_API_KEY && <WeatherCard />}
```

## Need Help?

1. Check [INTEGRATION_CHECKLIST.md](INTEGRATION_CHECKLIST.md)
2. See [INTEGRATION_EXAMPLES.md](INTEGRATION_EXAMPLES.md)
3. Read [API_INTEGRATIONS.md](API_INTEGRATIONS.md)
4. Check service documentation (links in guide)

## You're All Set! 🎉

Your plant assistant now has:
- ✅ Real-time weather
- ✅ AI diagnosis
- ✅ Zone recommendations
- ✅ Plant database
- ✅ Image analysis
- ✅ Local resources
- ✅ Auto-location detection

Happy planting! 🌱
