# Verdant — Features Overview

**Verdant** is an AI-powered plant care companion that helps you scan, diagnose, and nurture your plants with real-time care reminders and expert guidance.

## Core Features

### 🏠 **Dashboard**
- **My Garden**: Browse all your plants in a beautiful bento grid layout
- **Quick Actions**: Mark all plants needing water or mist with one tap
- **Watering Calendar**: Visual calendar showing upcoming watering schedules
- **Daily Tasks**: Swipeable task list to track care activities (water, mist, etc.)
- **Streak Counter**: Track your consecutive days of plant care completion
- **Weather Awareness**: Smart reminders adjust based on local weather conditions

### 📸 **Plant Scanner**
- **AI Plant Identification**: Take a photo or upload an image to instantly identify any plant
- **Dual Recognition System**:
  - Pl@ntNet API for online species identification (shows scientific names, IUCN conservation status)
  - MobileNet fallback for offline identification
- **Organ-Specific Analysis**: Choose what's in frame (leaf, flower, fruit, bark) to improve accuracy
- **Confidence Scoring**: See match confidence percentages and alternative candidates
- **High-Confidence Quick Add**: One-tap add for confident matches, bypassing confirmation steps
- **Species Enrichment**: Links to GBIF and POWO databases for detailed species information

### 🏥 **AI Plant Doctor**
- **Conversational Diagnosis**: Chat with an AI expert about any plant issue
- **Photo Analysis**: Upload photos to detect diseases and identify plant varieties
- **Timeline Analysis**: Ask about plant history—the doctor references your care logs and growth trends
- **Plant Focus**: Filter advice by selecting a specific plant from your garden
- **Smart Suggestions**: Quick-tap suggestions for common questions

### 📊 **Plant Care Details**
- **Health Meter**: Visual radial gauge showing overall plant health (0-100%)
- **Care Instructions**: 
  - Watering schedule
  - Sunlight requirements
  - Temperature range
  - Humidity needs
- **Care Timeline**: Track health changes, issues, and improvements over time
- **Photo Gallery**: Store and view photos of your plant through different stages
- **Status Indicators**: Plant status (Healthy, Needs Water, Needs Mist, Quarantined)

### 🌍 **Smart Features**
- **Hardiness Zone Detection**: Automatic location detection for climate-appropriate care tips
- **Local Nurseries Finder**: Discover nearby nurseries for supplies and replacement plants
- **Comparison Slider**: Before/after photo comparison to track plant recovery
- **Health Checks**: Automated checks based on photo analysis
- **Demo Garden**: Sample plants to explore features without your own collection

### ⚙️ **Settings & Customization**
- **Language Support**: English and Hungarian localization
- **Photo Management**: Store and manage plant photos in IndexedDB
- **Data Export**: Export care calendar data
- **Demo Mode**: Easily try the app with sample plants and reset your garden

## Technical Highlights

- **Real-time Identification**: Combines Pl@ntNet (cloud) with MobileNet (on-device) for robust identification
- **Offline Capability**: MobileNet fallback works without internet connection
- **Smart Caching**: Local storage of plants, timelines, and care schedules
- **Responsive Design**: Mobile-first interface with swipe gestures and touch-optimized controls
- **Accessibility**: ARIA labels and semantic HTML throughout
- **Performance**: Pull-to-refresh, optimized image handling, and smooth animations

## Data Stored

- Plant collection and metadata
- Care timelines and health history
- Plant photos in IndexedDB
- Chat history and doctor conversation logs
- Daily task completion streaks
- User preferences

---

**Your AI plant care companion**. Scan. Diagnose. Thrive. 🌿
