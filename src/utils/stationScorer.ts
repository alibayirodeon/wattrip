import { ChargingStation, ChargingStationScore, ChargingPlanOptions } from '../types/chargingStation';

export class StationScorer {
  private static readonly WEIGHTS = {
    power: 0.3,
    price: 0.2,
    rating: 0.15,
    amenities: 0.15,
    availability: 0.1,
    type: 0.1
  };

  static scoreStation(
    station: ChargingStation,
    options: ChargingPlanOptions,
    distanceFromRoute: number
  ): ChargingStationScore {
    const reasons: string[] = [];
    let score = 0;

    // Power score (0-1)
    const powerScore = Math.min(station.power / 150, 1); // 150kW as max
    score += powerScore * this.WEIGHTS.power;
    reasons.push(`Power: ${station.power}kW (${Math.round(powerScore * 100)}%)`);

    // Price score (0-1, lower is better)
    const priceScore = options.maxPrice ? 
      Math.max(0, 1 - (station.price / options.maxPrice)) : 1;
    score += priceScore * this.WEIGHTS.price;
    reasons.push(`Price: ${station.price}TL/kWh (${Math.round(priceScore * 100)}%)`);

    // Rating score (0-1)
    const ratingScore = station.rating / 5;
    score += ratingScore * this.WEIGHTS.rating;
    reasons.push(`Rating: ${station.rating}/5 (${Math.round(ratingScore * 100)}%)`);

    // Amenities score (0-1)
    const amenitiesScore = options.requiredAmenities ? 
      options.requiredAmenities.filter(a => station.amenities.includes(a)).length / 
      options.requiredAmenities.length : 1;
    score += amenitiesScore * this.WEIGHTS.amenities;
    reasons.push(`Amenities: ${Math.round(amenitiesScore * 100)}% match`);

    // Availability score (0-1)
    const availabilityScore = station.available ? 1 : 0;
    score += availabilityScore * this.WEIGHTS.availability;
    reasons.push(`Available: ${availabilityScore * 100}%`);

    // Type score (0-1)
    const typeScore = options.preferredStationTypes?.includes(station.type) ? 1 : 0.5;
    score += typeScore * this.WEIGHTS.type;
    reasons.push(`Type: ${station.type} (${Math.round(typeScore * 100)}%)`);

    // Distance penalty (0-1)
    const distancePenalty = Math.max(0, 1 - (distanceFromRoute / 5000)); // 5km max
    score *= distancePenalty;
    reasons.push(`Distance: ${Math.round(distanceFromRoute)}m (${Math.round(distancePenalty * 100)}%)`);

    return {
      station,
      score,
      reasons
    };
  }

  static rankStations(
    stations: ChargingStation[],
    options: ChargingPlanOptions,
    distancesFromRoute: Map<string, number>
  ): ChargingStationScore[] {
    return stations
      .map(station => this.scoreStation(
        station,
        options,
        distancesFromRoute.get(station.id) || Infinity
      ))
      .sort((a, b) => b.score - a.score);
  }
} 