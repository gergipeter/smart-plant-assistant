# API Integration Review — Verdant

## Summary
The app has **9 server-side API integrations**, but several have **critical issues** with error handling, unused endpoints, and inconsistent patterns. Here's what I found and recommendations for fixes.

---

## 🔴 Critical Issues

### 1. **Unused/Incomplete API Integrations**

#### `ai-doctor.server.ts` — NOT CONNECTED
- ✗ **Status**: Defined but **not used anywhere in the app**
- **Why**: The Doctor chat (route `/doctor`) builds responses locally using plant timelines and doesn't call `askAIDoctor`
- **Issue**: The Anthropic API integration exists but is dead code
- **Fix**: Either remove it OR update `/doctor` to use it for certain question types

#### `trefle.server.ts` — NOT CONNECTED
- ✗ **Status**: Defined but **not used anywhere in the app**
- **Why**: The app doesn't enhance plant data with Trefle details
- **Issue**: Complete dead code; API key is configured but never called
- **Fix**: Remove or implement plant enrichment in the plant detail view

#### `image-recognition.server.ts` — PARTIALLY USED
- ✗ **Status**: Defined but **never called** (returns mock data as fallback)
- **Why**: The plant scanner and doctor use Pl@ntNet and MobileNet instead
- **Issue**: Google Vision API key exists but has no callers
- **Fix**: Remove or consolidate with existing analysis

#### `notifications.server.ts`
- ✗ **Status**: Defined but **not imported anywhere**
- **Why**: No push notification UI or implementation exists
- **Issue**: Dead code; Firebase/OneSignal keys configured but unused
- **Fix**: Remove the file entirely

---

### 2. **Poor Error Handling Patterns**

#### `nurseries.server.ts` — Returns Mock Data on Any Error
```ts
// Lines 52-64: Always succeeds even on API failure
if (!response.ok) {
  return {
    status: "ok",  // ← Should be error!
    data: [/* fallback nurseries */],
  };
}
```
**Problem**: Mask failures from the UI — the user thinks results are real when they're stale fallbacks.
**Fix**:
```ts
if (!response.ok) {
  return { status: "error", message: "Could not reach Google Places API." };
}
```

#### `weather.server.ts` — Returns Default Coords on Geolocation Failure
```ts
// Lines 24-25: Always uses NYC defaults
const lat = data.lat ?? 40.7128;
const lon = data.lon ?? -74.006;
```
**Problem**: If location is unknown, silently returns NYC weather without asking the user.
**Fix**: Return an error if coords aren't provided, forcing the UI to request geolocation first.

#### `hardiness-zone.server.ts` — Same Geolocation Issue
```ts
// Line 74-75: Always defaults to NYC
const lat = data.lat ?? 40.7128;
const lon = data.lon ?? -74.006;
```
**Fix**: Require coordinates or error.

#### `trefle.server.ts` — Returns Filler Data Instead of Error
```ts
// Lines 62-72: API fails, but returns "ok" with placeholder text
if (!detailResponse.ok) {
  return {
    status: "ok",
    data: {
      bloomTime: "Varies",
      waterNeeds: "Moderate",
      careLevel: "Varies",
      /* ... more filler ... */
    },
  };
}
```
**Problem**: User sees fake enrichment data thinking it's real.
**Fix**: Return error status.

#### `image-recognition.server.ts` — Always Returns Mock Data
```ts
// Line 26-37: Even when key is missing, returns success with dummy data
if (!apiKey) {
  return {
    status: "ok",
    data: {
      plantConfidence: 0.7,
      healthStatus: "unknown",
      // ← These are lies
    },
  };
}
```
**Problem**: API is never called; always returns fake results.
**Fix**: Either remove this endpoint or actually integrate Google Vision.

---

### 3. **Unused Parameters**

#### `geolocation.server.ts` — `geocodeAddress` is Dead Code
- ✗ **Not called anywhere** in the app
- Nominatim API integration exists but has no callers
- **Fix**: Remove the function or add address search to settings

---

### 4. **Inconsistent Response Patterns**

#### `identifyPlant` Returns Different Shape
```ts
// plantnet.server.ts (lines 24-27)
export type PlantNetResponse =
  | { status: "ok"; results: PlantNetResult[] }
  | { status: "quota-exceeded" }
  | { status: "error"; message: string };

// vs. other endpoints use:
export type ApiResult<T> =
  | { status: "ok"; data: T }
  | { status: "quota-exceeded" }
  | { status: "error"; message: string };
```
**Problem**: `identifyPlant` returns `{ results }` but others return `{ data }`.
**Impact**: Components must handle different shapes; risk of bugs.
**Fix**: Standardize all responses to use `{ data }` shape.

---

## 🟡 Moderate Issues

### 5. **Missing Implementation Details**

#### Pl@ntNet Plant Identification (`plantnet.server.ts`)
- ✓ **Well implemented** — proper error handling, quota detection, response parsing
- **But**: `getLanguages()`, `getProjects()`, `getQuotaHistory()`, `getSubscription()` are never used
- **Fix**: Remove unused getters or document them for future use

#### Weather API (`weather.server.ts`)
- ✓ **Connected** and used in `WeatherCard`
- **But**: No caching — every component mount refetches weather
- **Fix**: Add response caching (10-15 min) to reduce API calls

#### Hardiness Zone (`hardiness-zone.server.ts`)
- ✓ **Connected** and used
- **But**: Pure latitude-based approximation; doesn't use real USDA zones
- **Consider**: Could enhance with an actual USDA zone API or keep local approximation for now (it's working)

#### Nurseries (`nurseries.server.ts`)
- ✓ **Connected** and used
- **But**: Returns mock data on any error
- **And**: Only requests basic place type; could filter by "nursery" more precisely

---

### 6. **Missing Validation**

#### FormData Validation Errors Aren't Caught
```ts
// plantnet.server.ts (line 235)
.validator((data: unknown) => {
  if (!(data instanceof FormData)) throw new Error("Expected FormData");
  return data;
})
```
**Problem**: If this throws, TanStack Start serializes the error but UI doesn't handle it gracefully.
**Fix**: Return `ApiResult` with error status instead of throwing.

---

## 🟢 What's Working Well

1. **Pl@ntNet Integration** (`plantnet.server.ts`)
   - Robust error handling (quota detection, auth failures, parse errors)
   - Good type safety with `PlantNetResult` and `PlantNetResponse`
   - Smart response envelope pattern
   - Proper API key validation

2. **Component Usage Pattern**
   - `WeatherCard`, `NurseriesFinder`, `HardinessZoneInfo` all correctly call server fns
   - Proper loading/error states in UI
   - Dependency arrays correct

3. **MobileNet + Pl@ntNet Fallback**
   - Smart dual-layer identification (cloud + offline)
   - Good user experience

---

## Recommendations by Priority

### **P0 — Fix Before Shipping**

1. **Remove Dead Code**
   - Delete `ai-doctor.server.ts` (never used)
   - Delete `trefle.server.ts` (never used)
   - Delete `image-recognition.server.ts` (never used)
   - Delete `notifications.server.ts` (never used)
   - Remove `geocodeAddress` from `geolocation.server.ts`

2. **Fix Error Handling**
   - `nurseries.server.ts`: Return error on API failure, not mock data
   - `weather.server.ts`: Return error if no coords provided (don't default to NYC)
   - `hardiness-zone.server.ts`: Same — return error if no coords
   - `trefle.server.ts`: (If keeping) return error instead of filler data

3. **Standardize Response Shape**
   - Change `PlantNetResponse` to use `{ data: PlantNetResult[] }` instead of `{ results }`
   - Update all callers (`scan.tsx`, `doctor.tsx`) to expect `result.data.results` → `result.data`

### **P1 — Improve Soon**

4. **Add Response Caching**
   - Weather API: Cache for 10-15 min
   - Hardiness zone: Cache for session
   - Nurseries: Cache for 30 min

5. **Better Validation**
   - Catch FormData validation errors and return `ApiResult` instead of throwing
   - Validate coordinate ranges in weather/geolocation/hardiness-zone

6. **Remove Unused Pl@ntNet Endpoints**
   - `getLanguages()`, `getProjects()`, `getQuotaHistory()`, `getSubscription()` are never called
   - Delete or document as "reserved for future use"

### **P2 — Nice to Have**

7. **Add API Health Checks**
   - Periodic background health check for Pl@ntNet quota
   - Display quota indicator in scan UI

8. **Logging & Monitoring**
   - Log API failures server-side (which endpoints fail most)
   - Track quota depletion patterns

---

## File Changes Needed

### Files to Delete
- `src/lib/ai-doctor.server.ts`
- `src/lib/trefle.server.ts`
- `src/lib/image-recognition.server.ts`
- `src/lib/notifications.server.ts`

### Files to Fix
- `src/lib/nurseries.server.ts` — Fix error handling
- `src/lib/weather.server.ts` — Fix default behavior
- `src/lib/hardiness-zone.server.ts` — Fix default behavior
- `src/lib/plantnet.server.ts` — Standardize response shape, remove unused endpoints
- `src/lib/geolocation.server.ts` — Remove `geocodeAddress`

### Files to Update (Callers)
- `src/routes/scan.tsx` — Update for standardized response shape
- `src/routes/doctor.tsx` — Update for standardized response shape

---

## Would I Do Anything Different?

**Yes, significantly:**

1. **Start Minimal** — Only integrate APIs you'll actively use. This codebase has ~40% dead code.

2. **Fail Fast** — Never mask API errors with mock data. Return errors so the UI can handle them gracefully.

3. **Require Inputs** — Don't silently default to NYC coordinates. Return an error if required data is missing.

4. **Standardize Early** — Pick one response shape (`{ status, data, message }`) and use it everywhere.

5. **Type Everything** — Use branded types or enums for response shapes so TypeScript catches mismatches.

6. **Cache Strategically** — Weather/location don't change often; cache for 10-30 min to reduce API calls and quota usage.

7. **Mock at the Boundary** — For testing, mock the server fn, not the endpoint. That's why TanStack Start gives you server fns.

---

## Summary Table

| API | Status | Used? | Issues | Priority |
|-----|--------|-------|--------|----------|
| Pl@ntNet | ✓ Working | Yes | None (well done) | — |
| Weather | ✓ Working | Yes | No geolocation check, no cache | P1 |
| Geolocation | ⚠️ Partial | No | `geocodeAddress` unused | P1 |
| Hardiness Zone | ✓ Working | Yes | No geolocation check, needs cache | P1 |
| Nurseries | ⚠️ Partial | Yes | Returns mock on error | P0 |
| AI Doctor | ✗ Dead | No | Unused | P0 |
| Trefle | ✗ Dead | No | Unused | P0 |
| Image Recognition | ✗ Dead | No | Unused | P0 |
| Notifications | ✗ Dead | No | Unused | P0 |
| MobileNet | ✓ Working | Yes | None | — |

---

**Bottom line**: Remove ~40% of the code (dead APIs), fix error handling in 3 endpoints, and standardize response shapes. Otherwise, it's solid.
