# Quick Integration Guide

Copy-paste snippets to add these features to your routes/components.

---

## 1. Add AI Doctor to Plant Detail

In `src/routes/plant.$id.tsx`, add doctor button:

```tsx
// Import at top
import { MessageCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";

// In the component, add button:
<Link
  to="/doctor"
  search={{ ask: `Why is my ${plant.name} looking sick?`, focus: plant.id }}
  className="ios-tap h-12 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"
>
  <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
  Ask the Doctor
</Link>
```

---

## 2. Show Plant Enrichment on Detail Page

In `src/routes/plant.$id.tsx`, add after care info section:

```tsx
// Import at top
import { PlantEnrichment } from "@/components/PlantEnrichment";

// In render:
<section className="mb-8">
  <h2 className="text-lg font-display mb-3">Botanical Profile</h2>
  <PlantEnrichment plant={plant} />
</section>
```

---

## 3. Show Photo Health Check After Upload

In `src/routes/plant.$id.tsx`, in the photo upload section:

```tsx
// Import at top
import { ImageHealthAnalysis } from "@/components/PlantEnrichment";

// After upload handler, before state update:
const [lastUploadedPhoto, setLastUploadedPhoto] = useState<Blob | null>(null);

// Later in render, after photos section:
{lastUploadedPhoto && (
  <section className="mb-8">
    <h2 className="text-lg font-display mb-3">Health Check</h2>
    <ImageHealthAnalysis photo={lastUploadedPhoto} />
  </section>
)}
```

---

## 4. Add Notification Settings to Settings Page

In `src/routes/settings.tsx`, add new section:

```tsx
// Import at top
import { 
  getNotificationPreferences,
  updateNotificationPreferences 
} from "@/lib/notifications.server";
import { Bell, Clock } from "lucide-react";

// In component:
const [notifPrefs, setNotifPrefs] = useState(() => 
  getNotificationPreferences()
);

const handleToggleWateringReminders = async () => {
  const updated = await updateNotificationPreferences({
    wateringReminders: !notifPrefs.wateringReminders,
  });
  if (updated.status === "ok") {
    setNotifPrefs(updated.data);
  }
};

// In render:
<section className="mb-8">
  <div className="flex items-center gap-2 mb-4">
    <Bell className="h-5 w-5 text-primary" />
    <h2 className="text-lg font-display">Notifications</h2>
  </div>
  
  <label className="flex items-center gap-3 mb-3">
    <input
      type="checkbox"
      checked={notifPrefs.wateringReminders}
      onChange={handleToggleWateringReminders}
      className="w-4 h-4"
    />
    <span className="text-sm">Watering Reminders</span>
  </label>

  <label className="flex items-center gap-3 mb-3">
    <input
      type="checkbox"
      checked={notifPrefs.diseaseAlerts}
      onChange={() => updateNotificationPreferences({
        diseaseAlerts: !notifPrefs.diseaseAlerts,
      })}
      className="w-4 h-4"
    />
    <span className="text-sm">Disease Alerts</span>
  </label>

  {notifPrefs.enableEmailDigest && (
    <div className="flex items-center gap-2 mt-3">
      <Clock className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">
        Daily digest at {notifPrefs.dailyDigestTime}
      </span>
    </div>
  )}
</section>
```

---

## 5. Add "Doctor" Suggestion Pills to Home

In `src/routes/index.tsx`, add after tasks section:

```tsx
// After existing content:
<section className="mb-8">
  <h2 className="text-lg font-display mb-3">Need Help?</h2>
  <Link
    to="/doctor"
    className="ios-tap w-full leaf-card flex items-center justify-between p-4 text-left"
  >
    <div>
      <p className="font-medium text-sm">Ask the Plant Doctor</p>
      <p className="text-xs text-muted-foreground mt-1">
        Get expert advice about your plants
      </p>
    </div>
    <Stethoscope className="h-5 w-5 text-primary shrink-0" strokeWidth={1.75} />
  </Link>
</section>
```

---

## 6. Add "Upcoming Care" Widget to Home

In `src/routes/index.tsx`, add to dashboard:

```tsx
// Import at top
import { getUpcomingReminders } from "@/lib/notifications.server";
import { AlertCircle } from "lucide-react";

// In component:
const [upcomingReminders, setUpcomingReminders] = useState<WateringReminder[]>([]);

useEffect(() => {
  getUpcomingReminders().then(res => {
    if (res.status === "ok") {
      setUpcomingReminders(res.data);
    }
  });
}, []);

// In render:
{upcomingReminders.length > 0 && (
  <section className="mb-7">
    <h2 className="text-lg font-display mb-3 flex items-center gap-2">
      <AlertCircle className="h-5 w-5 text-primary" strokeWidth={1.75} />
      Care Due Soon
    </h2>
    <div className="ios-group">
      {upcomingReminders.map((reminder) => (
        <Link
          key={reminder.plantId}
          to="/plant/$id"
          params={{ id: reminder.plantId }}
          className="ios-tap block px-4 py-3 text-left"
        >
          <p className="text-sm font-medium">{reminder.plantName}</p>
          <p className="text-xs text-muted-foreground">
            Water in {reminder.daysUntilWatering} day{reminder.daysUntilWatering !== 1 ? "s" : ""}
          </p>
        </Link>
      ))}
    </div>
  </section>
)}
```

---

## 7. AI Doctor Already Auto-Detects Issues

The doctor chat now automatically triggers AI responses for issue questions.

**No code needed** — just open `/doctor`, select a plant, and ask:
- "My monstera has yellow leaves"
- "Why is my plant wilting?"
- "How do I get rid of spider mites?"

AI Doctor will auto-detect and provide structured advice.

---

## Environment Variables

Ensure `.env` has these keys (already configured):

```
ANTHROPIC_API_KEY=sk-ant-api03-...
TREFLE_API_KEY=usr-...
GOOGLE_VISION_API_KEY=AIzaSy...
OPENWEATHER_API_KEY=...
GOOGLE_PLACES_API_KEY=...
```

---

## Common Patterns

### Handle API Result
```tsx
const result = await someApi({ /* args */ });

if (result.status === "ok") {
  setData(result.data);
} else if (result.status === "quota-exceeded") {
  showError("Daily quota reached");
} else {
  showError(result.message);
}
```

### Show Loading State
```tsx
const [loading, setLoading] = useState(false);

useEffect(() => {
  setLoading(true);
  fetchData().finally(() => setLoading(false));
}, []);

return loading ? <Skeleton /> : <Data />;
```

### Type-Safe Calls
```tsx
import type { AIDoctorAdvice } from "@/lib/ai-doctor.server";

const result = await getAIDoctorAdvice({ ... });
if (result.status === "ok") {
  const advice: AIDoctorAdvice = result.data; // Type-safe!
}
```

---

## Testing

### Test AI Doctor
1. Go to `/doctor`
2. Select a plant from the top pill selector
3. Type: "My plant has yellow leaves"
4. Should see structured diagnosis + treatment

### Test Enrichment
1. Go to any plant detail page
2. Should see botanical profile section
3. Shows bloom months, height, hardiness, care level

### Test Image Analysis
1. Go to `/doctor`
2. Click camera icon
3. Take/upload a plant photo
4. Should see health score + detected issues

### Test Notifications
1. Go to `/settings`
2. Toggle watering/disease reminders
3. Should persist in localStorage

---

## Troubleshooting

**AI Doctor not responding?**
- Check `ANTHROPIC_API_KEY` in `.env`
- Verify Anthropic account has API access
- Check console for error messages

**Trefle not showing?**
- Check `TREFLE_API_KEY` in `.env`
- Plant name might not be in Trefle database
- Try search with scientific name

**Image Analysis failing?**
- Check `GOOGLE_VISION_API_KEY` in `.env`
- Image must be valid format (JPG/PNG)
- Check file size (max ~4MB)

**Notifications not saving?**
- Browser localStorage might be disabled
- Check browser privacy settings
- Clear cache and retry

---

## That's it! 🎉

All 4 APIs are now functional and ready to use. Pick and choose which features to integrate based on your priorities.
