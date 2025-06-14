"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StationScorer = void 0;
var StationScorer = /** @class */ (function () {
    function StationScorer() {
    }
    StationScorer.scoreStation = function (station, options, distanceFromRoute) {
        var _a;
        var reasons = [];
        var score = 0;
        // Power score (0-1)
        var powerScore = Math.min(station.power / 150, 1); // 150kW as max
        score += powerScore * this.WEIGHTS.power;
        reasons.push("Power: ".concat(station.power, "kW (").concat(Math.round(powerScore * 100), "%)"));
        // Price score (0-1, lower is better)
        var priceScore = options.maxPrice ?
            Math.max(0, 1 - (station.price / options.maxPrice)) : 1;
        score += priceScore * this.WEIGHTS.price;
        reasons.push("Price: ".concat(station.price, "TL/kWh (").concat(Math.round(priceScore * 100), "%)"));
        // Rating score (0-1)
        var ratingScore = station.rating / 5;
        score += ratingScore * this.WEIGHTS.rating;
        reasons.push("Rating: ".concat(station.rating, "/5 (").concat(Math.round(ratingScore * 100), "%)"));
        // Amenities score (0-1)
        var amenitiesScore = options.requiredAmenities ?
            options.requiredAmenities.filter(function (a) { return station.amenities.includes(a); }).length /
                options.requiredAmenities.length : 1;
        score += amenitiesScore * this.WEIGHTS.amenities;
        reasons.push("Amenities: ".concat(Math.round(amenitiesScore * 100), "% match"));
        // Availability score (0-1)
        var availabilityScore = station.available ? 1 : 0;
        score += availabilityScore * this.WEIGHTS.availability;
        reasons.push("Available: ".concat(availabilityScore * 100, "%"));
        // Type score (0-1)
        var typeScore = ((_a = options.preferredStationTypes) === null || _a === void 0 ? void 0 : _a.includes(station.type)) ? 1 : 0.5;
        score += typeScore * this.WEIGHTS.type;
        reasons.push("Type: ".concat(station.type, " (").concat(Math.round(typeScore * 100), "%)"));
        // Distance penalty (0-1)
        var distancePenalty = Math.max(0, 1 - (distanceFromRoute / 5000)); // 5km max
        score *= distancePenalty;
        reasons.push("Distance: ".concat(Math.round(distanceFromRoute), "m (").concat(Math.round(distancePenalty * 100), "%)"));
        return {
            station: station,
            score: score,
            reasons: reasons
        };
    };
    StationScorer.rankStations = function (stations, options, distancesFromRoute) {
        var _this = this;
        return stations
            .map(function (station) { return _this.scoreStation(station, options, distancesFromRoute.get(station.id) || Infinity); })
            .sort(function (a, b) { return b.score - a.score; });
    };
    StationScorer.WEIGHTS = {
        power: 0.3,
        price: 0.2,
        rating: 0.15,
        amenities: 0.15,
        availability: 0.1,
        type: 0.1
    };
    return StationScorer;
}());
exports.StationScorer = StationScorer;
