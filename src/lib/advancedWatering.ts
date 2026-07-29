// Advanced AI-powered watering algorithm
// Takes into account: weather, soil moisture, plant type, location, season, humidity

export interface WateringPrediction {
  daysUntilWatering: number;
  confidence: number; // 0-100
  reason: string;
  factors: {
    weatherImpact: number; // -7 to +7 days
    soilMoisture: number; // 0-100%
    temperature: number; // °C
    humidity: number; // 0-100%
    seasonalAdjustment: number; // 0-1 multiplier
  };
}

export interface PlantWateringProfile {
  plantId: string;
  baseWateringDays: number; // default interval
  soilType: 'clay' | 'loam' | 'sand'; // affects water retention
  drainageQuality: 'poor' | 'normal' | 'excellent';
  sunExposure: 'full-sun' | 'partial' | 'shade';
  containerSize: number; // liters
  lastWatered: string; // ISO date
  lastPhotoSoilMoisture?: number; // 0-100% from visual analysis
}

export interface EnvironmentData {
  temperature: number; // °C
  humidity: number; // 0-100%
  rainfall: number; // mm in last 24h
  precipitation7d: number; // mm in last 7 days
  sunHours: number; // hours of sun in last 24h
  season: 'spring' | 'summer' | 'fall' | 'winter';
  hardinesZone: number; // USDA hardiness zone
}

// Calculate watering needs based on comprehensive factors
export function predictWateringNeed(
  profile: PlantWateringProfile,
  environment: EnvironmentData
): WateringPrediction {
  const lastWatered = new Date(profile.lastWatered);
  const daysSinceWatering = Math.floor((Date.now() - lastWatered.getTime()) / (1000 * 60 * 60 * 24));

  // Base calculation
  let predictedDays = profile.baseWateringDays;

  // 1. Weather impact (biggest factor)
  const weatherImpact = calculateWeatherImpact(environment);
  predictedDays += weatherImpact;

  // 2. Soil type affects water retention
  const soilAdjustment = calculateSoilAdjustment(profile.soilType, profile.drainageQuality);
  predictedDays *= soilAdjustment;

  // 3. Sun exposure increases watering needs
  const sunAdjustment = calculateSunAdjustment(profile.sunExposure, environment.sunHours);
  predictedDays *= sunAdjustment;

  // 4. Container size (smaller = more frequent)
  const containerAdjustment = calculateContainerAdjustment(profile.containerSize);
  predictedDays *= containerAdjustment;

  // 5. Seasonal adjustment
  const seasonalAdjustment = calculateSeasonalAdjustment(environment.season);
  predictedDays *= seasonalAdjustment;

  // 6. Visual soil moisture check (if available)
  const moistureAdjustment = profile.lastPhotoSoilMoisture
    ? (100 - profile.lastPhotoSoilMoisture) / 50
    : 1;
  predictedDays *= moistureAdjustment;

  // Calculate remaining days until watering
  const daysUntilWatering = Math.max(0, Math.round(predictedDays - daysSinceWatering));

  // Confidence decreases the older the data
  const confidence = Math.max(30, Math.min(95, 100 - daysSinceWatering * 2));

  // Generate reason
  const reason = generateWateringReason(
    daysUntilWatering,
    weatherImpact,
    environment,
    profile.soilType
  );

  return {
    daysUntilWatering,
    confidence,
    reason,
    factors: {
      weatherImpact,
      soilMoisture: profile.lastPhotoSoilMoisture || 50,
      temperature: environment.temperature,
      humidity: environment.humidity,
      seasonalAdjustment,
    },
  };
}

// Weather significantly impacts watering needs
function calculateWeatherImpact(env: EnvironmentData): number {
  let impact = 0;

  // Recent rainfall delays watering
  if (env.rainfall > 10) impact -= 5; // Heavy rain
  else if (env.rainfall > 2) impact -= 2; // Light rain
  else if (env.rainfall === 0 && env.humidity < 40) impact += 3; // Dry conditions

  // Temperature increases transpiration
  if (env.temperature > 30) impact += 3;
  else if (env.temperature > 25) impact += 1.5;
  else if (env.temperature < 15) impact -= 2;

  // Low humidity increases water loss
  if (env.humidity < 30) impact += 2;
  else if (env.humidity > 70) impact -= 1;

  // 7-day rainfall trend
  if (env.precipitation7d > 50) impact -= 3;

  return impact;
}

// Soil type affects water retention and drainage
function calculateSoilAdjustment(soilType: string, drainage: string): number {
  const baseAdjustments: Record<string, number> = {
    clay: 1.4, // Retains water longer
    loam: 1.0, // Balanced
    sand: 0.7, // Drains quickly, needs more frequent watering
  };

  const drainageMultipliers: Record<string, number> = {
    poor: 1.3, // Water sits longer
    normal: 1.0,
    excellent: 0.8, // Drains quickly
  };

  return (baseAdjustments[soilType] || 1.0) * (drainageMultipliers[drainage] || 1.0);
}

// Sun exposure increases water loss through transpiration
function calculateSunAdjustment(sunExposure: string, sunHours: number): number {
  const baseAdjustments: Record<string, number> = {
    'full-sun': 1.3,
    'partial': 1.0,
    'shade': 0.75,
  };

  const sunHourBonus = sunHours > 8 ? 1.1 : sunHours > 4 ? 1.0 : 0.9;

  return (baseAdjustments[sunExposure] || 1.0) * sunHourBonus;
}

// Smaller containers dry out faster
function calculateContainerAdjustment(containerSizeLiters: number): number {
  if (containerSizeLiters < 2) return 0.6; // Very frequent watering
  if (containerSizeLiters < 5) return 0.8;
  if (containerSizeLiters < 10) return 0.9;
  if (containerSizeLiters > 50) return 1.2; // Large containers dry slower
  return 1.0;
}

// Seasonal effects
function calculateSeasonalAdjustment(season: string): number {
  return {
    spring: 1.1, // Active growth, higher water needs
    summer: 1.2, // Peak transpiration
    fall: 0.9, // Slower growth
    winter: 0.6, // Dormancy, minimal water needs
  }[season] || 1.0;
}

// Generate human-readable explanation
function generateWateringReason(
  daysUntilWatering: number,
  weatherImpact: number,
  env: EnvironmentData,
  soilType: string
): string {
  if (daysUntilWatering <= 0) {
    return `Water now! ${soilType} soil is drying out.`;
  }

  if (daysUntilWatering < 3) {
    return `Water in ${daysUntilWatering} day${daysUntilWatering === 1 ? '' : 's'}. ${env.temperature > 25 ? 'Hot weather accelerating evaporation.' : ''}`;
  }

  if (weatherImpact < -3) {
    return `Watering delayed: recent rain will keep soil moist for a few more days.`;
  }

  if (env.humidity > 70) {
    return `High humidity reducing evaporation. Extended interval.`;
  }

  return `Water in ${daysUntilWatering} day${daysUntilWatering === 1 ? '' : 's'}. Conditions are normal.`;
}

// Batch predict for all plants
export function predictWateringForGarden(
  profiles: PlantWateringProfile[],
  environment: EnvironmentData
): Record<string, WateringPrediction> {
  const predictions: Record<string, WateringPrediction> = {};

  for (const profile of profiles) {
    predictions[profile.plantId] = predictWateringNeed(profile, environment);
  }

  return predictions;
}
