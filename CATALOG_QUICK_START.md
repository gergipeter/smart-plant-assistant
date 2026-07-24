# 🌿 Plant Catalog - Quick Start Guide

## 📊 What You Got

✅ **1,001 plants** with complete data  
✅ **Stock photos** for every plant  
✅ **Care instructions** (water, light, soil)  
✅ **Toxicity info** for pet safety  
✅ **Botanical facts** and origins  

---

## ⚡ 5-Minute Setup

### 1. Import the Catalog
```typescript
import { expandedSpeciesCatalog, getPlant } from "@/lib/plants";
```

### 2. Get a Single Plant
```typescript
const monstera = getPlant("monstera-deliciosa");
console.log(monstera?.name);    // "Monstera Deliciosa"
console.log(monstera?.photo);   // Unsplash image URL
console.log(monstera?.water);   // "Every 7-10 days..."
```

### 3. Filter Plants
```typescript
// Pet-safe plants
expandedSpeciesCatalog.filter(p => p.toxicity === "Pet safe");

// Healthy status
expandedSpeciesCatalog.filter(p => p.status === "healthy");

// African origin
expandedSpeciesCatalog.filter(p => p.origin.includes("Africa"));
```

### 4. Display in UI
```typescript
<img src={plant.photo} alt={plant.name} />
<h2>{plant.name}</h2>
<p>{plant.fact}</p>
<p>💧 {plant.water}</p>
<p>☀️ {plant.sunlight}</p>
<p>🪴 {plant.soil}</p>
```

---

## 🔍 Common Queries

### Find by Name
```typescript
expandedSpeciesCatalog.find(p => p.name === "Monstera Deliciosa");
```

### Search by Keyword
```typescript
expandedSpeciesCatalog.filter(p => 
  p.name.toLowerCase().includes("monstera")
);
```

### Get Pet-Safe Plants
```typescript
expandedSpeciesCatalog.filter(p => p.toxicity === "Pet safe");
```

### Find Plants by Origin
```typescript
// Brazil
expandedSpeciesCatalog.filter(p => p.origin.includes("Brazil"));

// Africa
expandedSpeciesCatalog.filter(p => p.origin.includes("Africa"));
```

### Plants Needing Water
```typescript
expandedSpeciesCatalog.filter(p => p.status === "needs-water");
```

### High Health Plants
```typescript
expandedSpeciesCatalog.filter(p => p.health > 85);
```

---

## 📱 UI Integration

### Plant Card Component
```typescript
<div className="bg-white rounded-lg shadow">
  {/* Photo */}
  <img 
    src={plant.photo} 
    alt={plant.name}
    className="w-full h-64 object-cover rounded-t-lg"
  />
  
  {/* Info */}
  <div className={`p-4 ${plant.gradient}`}>
    <h2 className={`text-lg font-bold ${plant.tone}`}>
      {plant.name}
    </h2>
    <p className="text-sm text-gray-500">{plant.scientific}</p>
    <p className="mt-3 text-sm">{plant.fact}</p>
    
    {/* Care Info */}
    <div className="mt-4 space-y-2 text-sm">
      <p>💧 {plant.water}</p>
      <p>☀️ {plant.sunlight}</p>
      <p>🪴 {plant.soil}</p>
      <p>⚠️ {plant.toxicity}</p>
    </div>
    
    {/* Status */}
    <div className="mt-4 flex items-center gap-2">
      <div className="text-sm font-medium">Health: {plant.health}%</div>
      <div className="w-24 h-2 bg-gray-200 rounded-full">
        <div 
          className="h-full bg-green-500 rounded-full" 
          style={{ width: `${plant.health}%` }}
        />
      </div>
    </div>
  </div>
</div>
```

### Plant List
```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {expandedSpeciesCatalog.map(plant => (
    <PlantCard key={plant.id} plant={plant} />
  ))}
</div>
```

### Search Component
```typescript
function PlantSearch() {
  const [query, setQuery] = useState("");
  
  const results = expandedSpeciesCatalog.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.scientific.toLowerCase().includes(query.toLowerCase())
  );
  
  return (
    <div>
      <input 
        type="text"
        placeholder="Search plants..."
        onChange={(e) => setQuery(e.target.value)}
        className="w-full px-4 py-2 border rounded-lg"
      />
      <div className="mt-4 space-y-2">
        {results.map(plant => (
          <PlantResult key={plant.id} plant={plant} />
        ))}
      </div>
    </div>
  );
}
```

---

## 🗂️ Plant Data Structure

```typescript
{
  id: string;              // "monstera-deliciosa"
  name: string;            // "Monstera Deliciosa"
  scientific: string;      // "Monstera deliciosa"
  emoji: string;           // "🍃"
  photo: string;           // "https://images.unsplash.com/..."
  gradient: string;        // "bg-[oklch(0.62_0.12_145)]"
  tone: string;            // "text-[oklch(0.4_0.09_35)]"
  status: string;          // "healthy" | "needs-water" | "needs-mist"
  health: number;          // 0-100
  origin: string;          // "Southern Mexico & Panama"
  toxicity: string;        // "Pet safe" | "Toxic to pets" | "Mildly toxic"
  water: string;           // "Every 7-10 days. Let top 2 inches dry..."
  sunlight: string;        // "Bright, indirect light..."
  soil: string;            // "Well-draining aroid mix..."
  fact: string;            // "Its iconic leaf holes..."
  lastWatered: string;     // "6 days ago"
  nextTask: string;        // "Check soil moisture"
  timeline: Array;         // Care history
}
```

---

## 🎨 Colors & Styling

### Using Gradients
```typescript
// Apply gradient background
<div className={plant.gradient}>
  {/* Content with plant.tone for text */}
  <p className={plant.tone}>Plant Name</p>
</div>
```

### Predefined Colors (oklch format)
- Green: `bg-[oklch(0.62_0.12_145)]`
- Golden: `bg-[oklch(0.78_0.13_95)]`
- Purple: `bg-[oklch(0.85_0.05_140)]`
- Warm: `bg-[oklch(0.86_0.05_45)]`
- Orange: `bg-[oklch(0.72_0.11_35)]`

---

## 📈 Performance Tips

### Create Index for Fast Lookup
```typescript
const plantMap = new Map(
  expandedSpeciesCatalog.map(p => [p.id, p])
);

// O(1) lookup instead of O(n) search
const plant = plantMap.get("monstera-deliciosa");
```

### Memoize Filtered Results
```typescript
const petSafePlants = useMemo(
  () => expandedSpeciesCatalog.filter(p => p.toxicity === "Pet safe"),
  []
);
```

### Lazy Load Images
```typescript
<img 
  src={plant.photo} 
  alt={plant.name}
  loading="lazy"
  decoding="async"
/>
```

---

## ✅ Verification

### Check Catalog Loaded
```typescript
console.log(expandedSpeciesCatalog.length); // Should be 1001
```

### Verify Plant Data
```typescript
const plant = expandedSpeciesCatalog[0];
console.assert(plant.id, "Missing ID");
console.assert(plant.photo, "Missing photo");
console.assert(plant.toxicity, "Missing toxicity");
```

### Test Filter
```typescript
const petSafe = expandedSpeciesCatalog.filter(p => 
  p.toxicity === "Pet safe"
);
console.log(`Found ${petSafe.length} pet-safe plants`);
```

---

## 🔗 Related Files

- **`PLANT_CATALOG.md`** - Complete documentation
- **`PLANT_CATALOG_INTEGRATION.md`** - Integration guide  
- **`src/lib/plants.ts`** - Main plants module
- **`src/lib/plants-catalog-1000.ts`** - Catalog data

---

## 💡 Common Tasks

### Show Random Plant
```typescript
const random = expandedSpeciesCatalog[
  Math.floor(Math.random() * expandedSpeciesCatalog.length)
];
console.log(random.name);
```

### Get Plant Statistics
```typescript
const stats = {
  total: expandedSpeciesCatalog.length,
  petSafe: expandedSpeciesCatalog.filter(p => p.toxicity === "Pet safe").length,
  toxic: expandedSpeciesCatalog.filter(p => p.toxicity === "Toxic to pets").length,
  healthy: expandedSpeciesCatalog.filter(p => p.status === "healthy").length,
};
```

### Sort by Health
```typescript
const sorted = [...expandedSpeciesCatalog].sort((a, b) => b.health - a.health);
const topPlants = sorted.slice(0, 10);
```

### Group by Origin
```typescript
const grouped = expandedSpeciesCatalog.reduce((acc, plant) => {
  if (!acc[plant.origin]) acc[plant.origin] = [];
  acc[plant.origin].push(plant);
  return acc;
}, {});
```

---

## 🚀 Ready to Go!

You have everything you need. Start using the catalog in your app:

```typescript
import { expandedSpeciesCatalog } from "@/lib/plants";

// Use in any component
export function PlantBrowser() {
  return (
    <div>
      {expandedSpeciesCatalog.map(plant => (
        <PlantCard key={plant.id} plant={plant} />
      ))}
    </div>
  );
}
```

**That's it! Enjoy your 1,001 plants! 🌿**
