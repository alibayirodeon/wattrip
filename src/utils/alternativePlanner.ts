import { ChargingStation, ChargingPlanOptions } from '../types/chargingStation';
import { StationScorer } from './stationScorer';
import { calculateDistance } from './distanceCalculator';

export interface AlternativePlan {
  strategy: 'minStops' | 'minTime' | 'balanced';
  stations: ChargingStation[];
  totalTime: number;
  totalStops: number;
  totalCost: number;
  socProfile: Array<{ distance: number; soc: number }>;
  chargingStops: Array<{
    station?: ChargingStation;
    distance?: number;
    energyCharged?: number;
    chargingTime?: number;
    socBefore?: number;
    socAfter?: number;
    reason?: string;
    canReach?: boolean;
    segmentIndex?: number;
    socAtFailure?: number;
    location?: { lat: number; lng: number };
  }>;
  success: boolean;
  failureReason?: string;
  failureLocation?: { lat: number; lng: number };
  finalSOC?: number;
  totalDistanceTravelled?: number;
}

export class AlternativePlanner {
  static generatePlans(
    route: Array<{ lat: number; lng: number }>,
    stations: ChargingStation[],
    options: ChargingPlanOptions,
    batteryCapacity: number,
    currentSOC: number
  ): AlternativePlan[] {
    const plans: AlternativePlan[] = [];

    // Calculate distances from route for all stations
    const distancesFromRoute = new Map<string, number>();
    stations.forEach(station => {
      const minDistance = Math.min(
        ...route.map(point => 
          calculateDistance(
            point.lat,
            point.lng,
            station.location.lat,
            station.location.lng
          )
        )
      );
      distancesFromRoute.set(station.id, minDistance);
    });

    // Rank stations
    const rankedStations = StationScorer.rankStations(
      stations,
      options,
      distancesFromRoute
    );

    // Generate plans for each strategy
    const strategies: Array<'minStops' | 'minTime' | 'balanced'> = [
      'minStops',
      'minTime',
      'balanced'
    ];

    strategies.forEach(strategy => {
      const plan = this.generatePlan(
        route,
        rankedStations.map(s => s.station),
        { ...options, strategy },
        batteryCapacity,
        currentSOC
      );
      if (plan) {
        plans.push(plan);
      } else {
        plans.push({
          strategy,
          stations: [],
          totalTime: 0,
          totalStops: 0,
          totalCost: 0,
          socProfile: [],
          chargingStops: [],
          success: false,
          failureReason: 'unknown',
          finalSOC: currentSOC,
          totalDistanceTravelled: 0
        });
      }
    });

    return plans;
  }

  private static calculateSegmentEnergy(route: Array<{ lat: number; lng: number }>) {
    return route.map((point, i) => {
      if (i === 0) return { distance: 0, energy: 0 };
      const prevPoint = route[i - 1];
      const distance = calculateDistance(
        prevPoint.lat,
        prevPoint.lng,
        point.lat,
        point.lng
      );
      // Realistic energy consumption: 200Wh/km at 100km/h
      const energy = distance * 0.2; // kWh
      return { distance, energy };
    });
  }

  // Yardımcı fonksiyonlar
  private static toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Dünya'nın yarıçapı (km)
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  public static calculateRemainingRange(
    currentSOC: number,
    batteryCapacity: number,
    consumptionPerKm: number = 0.178 // 17.8 kWh/100km
  ): number {
    const remainingEnergy = (batteryCapacity * currentSOC) / 100; // kWh
    return remainingEnergy / consumptionPerKm; // km
  }

  private static calculateChargingTime(
    energyNeeded: number,
    stationPower: number,
    currentSOC: number,
    maxSOC: number
  ): number {
    // Şarj süresi = Enerji / Güç
    const chargingTime = energyNeeded / stationPower;
    
    // SOC'ye göre şarj hızı düzeltmesi
    const socFactor = 1 + (currentSOC / 100); // SOC arttıkça şarj hızı azalır
    
    return chargingTime * socFactor;
  }

  private static generatePlan(
    route: Array<{ lat: number; lng: number }>,
    stations: ChargingStation[],
    options: ChargingPlanOptions,
    batteryCapacity: number,
    currentSOC: number
  ): AlternativePlan | null {
    let currentBattery = currentSOC;
    const selectedStations: ChargingStation[] = [];
    const socProfile: Array<{ distance: number; soc: number }> = [];
    const chargingStops: Array<{
      station?: ChargingStation;
      distance?: number;
      energyCharged?: number;
      chargingTime?: number;
      socBefore?: number;
      socAfter?: number;
      reason?: string;
      canReach?: boolean;
      segmentIndex?: number;
      socAtFailure?: number;
      location?: { lat: number; lng: number };
    }> = [];
    let totalDistance = 0;
    let totalTime = 0; // hours
    let totalCost = 0;
    let lastStationId: string | null = null;
    let lastChargedAt: { lat: number; lng: number } | null = null;
    const averageSpeed = 80; // km/h
    const MIN_DISTANCE_BETWEEN_CHARGES = 50; // km
    const MAX_STATION_SEARCH_RADIUS = 100; // km

    // Calculate energy consumption for each segment
    const segmentEnergy = this.calculateSegmentEnergy(route);

    for (let i = 0; i < segmentEnergy.length; i++) {
      const { distance, energy } = segmentEnergy[i];
      totalDistance += distance;

      // Segment travel time (hours)
      const segmentTime = distance / averageSpeed;
      totalTime += segmentTime;
      
      // Update battery level (kWh to percentage)
      const energyPercentage = (energy / batteryCapacity) * 100;
      currentBattery = Math.max(0, currentBattery - energyPercentage);
      socProfile.push({ distance: totalDistance, soc: currentBattery });

      // Check if we need to charge
      if (currentBattery < options.minSOC) {
        // Check if we've traveled enough distance since last charge
        const distanceSinceLastCharge = lastChargedAt ? 
          calculateDistance(
            lastChargedAt.lat,
            lastChargedAt.lng,
            route[i].lat,
            route[i].lng
          ) : Infinity;

        if (distanceSinceLastCharge >= MIN_DISTANCE_BETWEEN_CHARGES) {
          console.log('🔁 Yeni şarj ihtiyacı tespit edildi!');
          
          // Find best station based on strategy, excluding last station
          const station = this.findBestStation(
            stations.filter(s => s.id !== lastStationId),
            route[i],
            options,
            currentBattery,
            batteryCapacity,
            MAX_STATION_SEARCH_RADIUS
          );

          if (!station) {
            console.log('❌ Uyarı: Bu segmentte ulaşılabilir istasyon yok.');
            chargingStops.push({
              reason: 'noStationsInRange',
              canReach: false,
              segmentIndex: i + 1,
              socAtFailure: currentBattery,
              location: route[i]
            });
            return {
              strategy: options.strategy,
              stations: selectedStations,
              totalTime,
              totalStops: selectedStations.length,
              totalCost,
              socProfile,
              chargingStops,
              success: false,
              failureReason: 'noStationsInRange',
              failureLocation: route[i],
              finalSOC: currentBattery,
              totalDistanceTravelled: totalDistance
            };
          }

          // Calculate charging time and cost
          const energyNeeded = (options.maxSOC - currentBattery) * batteryCapacity / 100;
          const chargingTime = energyNeeded / (station.power * 0.92); // hours
          const chargingCost = energyNeeded * station.price;

          // Log charging details
          console.log(`🚏 Seçilen istasyon: ${station.name} (${distanceSinceLastCharge.toFixed(1)}km)`);
          console.log(`⚡ Şarj edilen enerji: ${energyNeeded.toFixed(1)}kWh`);
          console.log(`📈 SOC: %${options.maxSOC}`);

          // Add charging stop
          chargingStops.push({
            station,
            distance: distanceSinceLastCharge,
            energyCharged: energyNeeded,
            chargingTime,
            socBefore: currentBattery,
            socAfter: options.maxSOC
          });

          selectedStations.push(station);
          totalTime += chargingTime;
          totalCost += chargingCost;
          currentBattery = options.maxSOC;
          lastStationId = station.id;
          lastChargedAt = route[i];
        }
      }

      // Eğer enerji tamamen bittiyse, planı sonlandır
      if (currentBattery <= 0) {
        console.log('❌ Uyarı: Batarya tamamen tükendi, rota tamamlanamıyor.');
        chargingStops.push({
          reason: 'batteryDepleted',
          canReach: false,
          segmentIndex: i + 1,
          socAtFailure: currentBattery,
          location: route[i]
        });
        return {
          strategy: options.strategy,
          stations: selectedStations,
          totalTime,
          totalStops: selectedStations.length,
          totalCost,
          socProfile,
          chargingStops,
          success: false,
          failureReason: 'batteryDepleted',
          failureLocation: route[i],
          finalSOC: currentBattery,
          totalDistanceTravelled: totalDistance
        };
      }
    }

    return {
      strategy: options.strategy,
      stations: selectedStations,
      totalTime,
      totalStops: selectedStations.length,
      totalCost,
      socProfile,
      chargingStops,
      success: true,
      finalSOC: currentBattery,
      totalDistanceTravelled: totalDistance
    };
  }

  private static findBestStation(
    stations: ChargingStation[],
    currentLocation: { lat: number; lng: number },
    options: ChargingPlanOptions,
    currentBattery: number,
    batteryCapacity: number,
    maxSearchRadius: number = 100 // km
  ): ChargingStation | null {
    // Önce menzil içindeki istasyonları filtrele
    const stationsInRange = stations.filter(s => {
      const distance = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        s.location.lat,
        s.location.lng
      );
      return distance <= maxSearchRadius;
    });

    // Eğer menzil içinde istasyon yoksa, null dön
    if (!stationsInRange || stationsInRange.length === 0) {
      return null;
    }

    // Müsait istasyonları filtrele
    let filteredStations = stationsInRange.filter(s => s.available);

    // Eğer müsait istasyon yoksa, null dön
    if (!filteredStations || filteredStations.length === 0) {
      return null;
    }

    // Stratejiye göre istasyonları sırala
    switch (options.strategy) {
      case 'minStops':
        // Prefer stations with higher power
        filteredStations.sort((a, b) => b.power - a.power);
        break;
      case 'minTime':
        // Prefer stations with better amenities and rating
        filteredStations.sort((a, b) => 
          (b.rating + b.amenities.length) - (a.rating + a.amenities.length)
        );
        break;
      case 'balanced':
        // Use the scoring system
        filteredStations = StationScorer.rankStations(
          filteredStations,
          options,
          new Map(filteredStations.map(s => [
            s.id,
            calculateDistance(
              currentLocation.lat,
              currentLocation.lng,
              s.location.lat,
              s.location.lng
            )
          ]))
        ).map(s => s.station);
        break;
    }

    // En iyi istasyonu döndür
    return filteredStations[0] || null;
  }
} 