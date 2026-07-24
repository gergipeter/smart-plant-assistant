# Integration Examples

Complete examples showing how to use each API in your existing app.

## 1. Add Weather to Dashboard

**File**: `src/routes/index.tsx`

Add this import at the top:
```tsx
import { WeatherCard } from "@/components/WeatherCard";
import { HardinessZoneInfo } from "@/components/HardinessZoneInfo";
```

In your Dashboard component, replace the placeholder weather section:
```tsx
// OLD:
<div className="leaf-card flex items-start gap-3 p-4 mb-7">
  <div className="h-9 w-9 shrink-0 rounded-full bg-secondary grid place-items-center">
    <CloudSun className="h-[1.125rem] w-[1.125rem] text-primary" strokeWidth={1.5} />
  </div>
  <div>
    <p className="text-sm font-medium">Humid week ahead — 78% average</p>
    <p className="text-xs text-muted-foreground mt-0.5">
      Two watering reminders delayed by 2 days.
    </p>
  </div>
</div>

// NEW:
<WeatherCard lat={40.7128} lon={-74.006} />
<HardinessZoneInfo lat={40.7128} lon={-74.006} />
```

## 2. Add AI Doctor Chat to Plant Details

**File**: `src/routes/plant.$id.tsx`

```tsx
import { AIDoctorChat } from "@/components/AIDoctorChat";
import { Sparkles } from "lucide-react";

export default function PlantDetail() {
  const [showDoctor, setShowDoctor] = useState(false);
  const plant = getPlant(plantId);

  return (
    <>
      {/* Existing plant info */}
      
      {/* Add Doctor Button */}
      <button
        onClick={() => setShowDoctor(true)}
        className="ios-tap w-full leaf-card flex items-center gap-3 p-4 mb-7 border border-primary/30"
      >
        <Sparkles className="h-5 w-5 text-primary" />
        <span>Ask AI Plant Doctor</span>
      </button>

      {/* Doctor Chat Modal */}
      {showDoctor && (
        <AIDoctorChat
          plantName={plant.name}
          onClose={() => setShowDoctor(false)}
        />
      )}
    </>
  );
}
```

## 3. Enhance Scan Flow with Image Analysis

**File**: `src/routes/scan.tsx`

```tsx
import { analyzePlantImage, type ImageAnalysisResult } from "@/lib/image-recognition.server";

async function handlePhotoCapture(imageBlob: Blob) {
  // Existing Pl@ntNet identification
  const identifyResult = await identifyPlant(formData);
  
  // NEW: Add image analysis
  const analysisFormData = new FormData();
  analysisFormData.append("image", imageBlob);
  const analysisResult = await analyzePlantImage(analysisFormData);
  
  if (analysisResult.status === "ok") {
    const analysis = analysisResult.data;
    
    // Show health assessment
    if (analysis.healthStatus !== "healthy") {
      showAlert({
        title: "Health Check",
        message: `Your plant appears ${analysis.healthStatus}. ${analysis.recommendedActions.join(". ")}`,
        type: "warning"
      });
    }
    
    // Save analysis with plant record
    savePlantAnalysis(plantId, analysis);
  }
}
```

## 4. Show Nurseries on Settings Page

**File**: `src/routes/settings.tsx`

```tsx
import { NurseriesFinder } from "@/components/NurseriesFinder";
import { MapPin } from "lucide-react";
import { useState } from "react";

export default function Settings() {
  const [showNurseries, setShowNurseries] = useState(false);
  const [location, setLocation] = useState({ lat: 40.7128, lon: -74.006 });

  return (
    <div className="space-y-6">
      {/* Other settings */}
      
      {/* Nursery Finder Section */}
      <div className="leaf-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Local Plant Shops</h3>
          </div>
          <button
            onClick={() => setShowNurseries(true)}
            className="text-sm text-primary hover:underline"
          >
            Find nurseries
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Discover local plant nurseries and suppliers near you
        </p>
      </div>

      <NurseriesFinder
        lat={location.lat}
        lon={location.lon}
        isOpen={showNurseries}
        onClose={() => setShowNurseries(false)}
      />
    </div>
  );
}
```

## 5. Smart Watering Adjustment Based on Weather

**File**: `src/lib/careSchedule.ts`

```tsx
import { getWeather } from "@/lib/weather.server";
import { Plant } from "@/lib/plants";

export async function getAdjustedWateringSchedule(
  plant: Plant,
  lat: number,
  lon: number
): Promise<string> {
  const weatherResult = await getWeather({ lat, lon });
  
  if (weatherResult.status !== "ok") {
    return plant.nextTask; // Fallback to original schedule
  }

  const weather = weatherResult.data;
  const baseInterval = plant.waterIntervalDays || 7;
  
  // Adjust based on weather
  let adjustedDays = baseInterval;
  
  // Increase watering if hot and dry
  if (weather.temp > 25 && weather.humidity < 40) {
    adjustedDays = Math.max(1, baseInterval - 2);
  }
  
  // Decrease watering if cool and humid or rainy
  if (weather.temp < 15 || weather.humidity > 70 || weather.rainfall > 0) {
    adjustedDays = Math.min(baseInterval + 3, baseInterval * 1.5);
  }
  
  const daysUntil = Math.round(adjustedDays);
  return `Water in ${daysUntil} days (weather adjusted)`;
}
```

## 6. Batch Process Plants with AI Doctor

```tsx
import { askAIDoctor } from "@/lib/ai-doctor.server";
import { getGardenPlants } from "@/lib/myGarden";

export async function diagnoseAllPlants() {
  const plants = getGardenPlants();
  
  for (const plant of plants) {
    if (plant.status === "needs-water" || plant.status === "quarantined") {
      const result = await askAIDoctor({
        plantName: plant.name,
        issue: `${plant.status} - ${plant.fact}`, // Use existing data
      });

      if (result.status === "ok") {
        saveAdvice(plant.id, result.advice);
        notifyUser({
          title: `${plant.name} needs attention`,
          body: result.advice,
          plantId: plant.id,
        });
      }
    }
  }
}
```

## 7. Morning Digest with Notifications

```tsx
import { sendNotification } from "@/lib/notifications.server";
import { getGardenPlants } from "@/lib/myGarden";
import { getWeather } from "@/lib/weather.server";

export async function sendMorningDigest(
  lat: number,
  lon: number,
  time: string = "08:00"
) {
  // Only run at specified time
  const now = new Date();
  const [hours, minutes] = time.split(":").map(Number);
  
  if (now.getHours() !== hours || now.getMinutes() !== minutes) {
    return;
  }

  const plants = getGardenPlants();
  const weather = await getWeather({ lat, lon });

  // Build digest
  const waterNeeded = plants.filter((p) => p.status === "needs-water");
  const mistNeeded = plants.filter((p) => p.status === "needs-mist");

  let body = `Good morning! `;
  
  if (weather.status === "ok") {
    const w = weather.data;
    body += `It's ${w.temp}°C and ${w.humidity}% humid. `;
  }

  if (waterNeeded.length > 0) {
    body += `${waterNeeded.length} plant(s) need water. `;
  }
  
  if (mistNeeded.length > 0) {
    body += `${mistNeeded.length} need misting.`;
  }

  await sendNotification({
    title: "Your Garden Today",
    body: body,
    type: "weather",
  });
}
```

## 8. Enriched Plant Profile

```tsx
import { enrichPlantData } from "@/lib/trefle.server";
import { Plant } from "@/lib/plants";

export async function getEnrichedPlantInfo(plant: Plant) {
  const enrichment = await enrichPlantData({
    scientificName: plant.scientific,
  });

  if (enrichment.status !== "ok") {
    return plant; // Return as-is if enrichment fails
  }

  return {
    ...plant,
    bloomTime: enrichment.data.bloomTime || plant.fact,
    careLevel: enrichment.data.careLevel,
    companion: enrichment.data.companion,
    propagationMethod: enrichment.data.propagation,
  };
}
```

## 9. Handle Auto-Location Detection

```tsx
import { getUserLocation, geocodeAddress } from "@/lib/geolocation.server";
import { useEffect, useState } from "react";

export function LocationAwareComponent() {
  const [location, setLocation] = useState(null);

  useEffect(() => {
    const detectLocation = async () => {
      // Try browser geolocation first
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLocation({
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
              source: "browser-gps",
            });
          },
          async () => {
            // Fallback to IP-based
            const result = await getUserLocation();
            if (result.status === "ok") {
              setLocation({
                ...result.data,
                source: "ip-based",
              });
            }
          }
        );
      }
    };

    detectLocation();
  }, []);

  return <div>{location?.city}</div>;
}
```

## 10. Complete Enhanced Root Route

See [src/routes/index.tsx](src/routes/index.tsx) for a working example of all these integrations together.

## Tips & Best Practices

1. **Error Handling**: Always check result.status before using data
2. **Caching**: Store API responses in localStorage to reduce calls
3. **Offline Support**: Use cached data when network is unavailable
4. **User Privacy**: Request location permission explicitly
5. **Rate Limiting**: Add delays between multiple API calls
6. **Testing**: Test each API in isolation first

## Troubleshooting

**"Cannot find module '@/lib/weather.server'"**
- Make sure you've created the files in `src/lib/`
- Check that your vite.config.ts has the correct alias

**"API key not found"**
- Ensure `.env.local` exists with your keys
- Server functions only see .env variables, not client-side

**"Weather/Doctor/etc not showing up"**
- Check browser console for errors
- Verify API key is valid in respective service dashboard
- Check network tab to see if API calls are being made

## Next Steps

1. Add API keys to `.env.local`
2. Start with one integration (Weather is simplest)
3. Test in development
4. Gradually add others
5. Deploy to production with environment variables
