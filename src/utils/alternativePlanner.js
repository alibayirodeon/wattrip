"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlternativePlanner = void 0;
var stationScorer_1 = require("./stationScorer");
var distanceCalculator_1 = require("./distanceCalculator");
const chargingStationService = require('../services/chargingStationService');
var AlternativePlanner = /** @class */ (function () {
    function AlternativePlanner() {
    }
    AlternativePlanner.generatePlans = function (route, stations, options, batteryCapacity, currentSOC) {
        var _this = this;
        var plans = [];
        // Calculate distances from route for all stations
        var distancesFromRoute = new Map();
        stations.forEach(function (station) {
            var minDistance = Math.min.apply(Math, route.map(function (point) {
                return (0, distanceCalculator_1.calculateDistance)(point.lat, point.lng, station.location.lat, station.location.lng);
            }));
            distancesFromRoute.set(station.id, minDistance);
        });
        // Rank stations
        var rankedStations = stationScorer_1.StationScorer.rankStations(stations, options, distancesFromRoute);
        // Generate plans for each strategy
        var strategies = [
            'minStops',
            'minTime',
            'balanced'
        ];
        strategies.forEach(function (strategy) {
            var plan = _this.generatePlan({
                startLocation: route[0],
                endLocation: route[route.length - 1],
                startSOC: currentSOC,
                batteryCapacity: batteryCapacity,
                maxStops: 10,
                strategy: strategy
            });
            if (plan) {
                plans.push(plan);
            }
            else {
                plans.push({
                    strategy: strategy,
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
    };
    AlternativePlanner.calculateSegmentEnergy = function(segments) {
        return segments.map(segment => {
            const distance = this.calculateDistance(
                segment.start.lat, segment.start.lng,
                segment.end.lat, segment.end.lng
            );
            // Gerçekçi enerji tüketimi: 200Wh/km
            const energy = distance * 0.2; // kWh
            return { distance, energy };
        });
    };
    // Yardımcı fonksiyonlar
    AlternativePlanner.toRad = function (degrees) {
        return degrees * (Math.PI / 180);
    };
    AlternativePlanner.calculateDistance = function (lat1, lon1, lat2, lon2) {
        var R = 6371; // Dünya'nın yarıçapı (km)
        var dLat = this.toRad(lat2 - lat1);
        var dLon = this.toRad(lon2 - lon1);
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };
    AlternativePlanner.calculateRemainingRange = function (currentSOC, batteryCapacity, consumptionPerKm // 17.8 kWh/100km
    ) {
        if (consumptionPerKm === void 0) { consumptionPerKm = 0.178; }
        var remainingEnergy = (batteryCapacity * currentSOC) / 100; // kWh
        return remainingEnergy / consumptionPerKm; // km
    };
    AlternativePlanner.calculateChargingTime = function (energyNeeded, stationPower, currentSOC, maxSOC) {
        // Şarj süresi = Enerji / Güç
        var chargingTime = energyNeeded / stationPower;
        // SOC'ye göre şarj hızı düzeltmesi
        var socFactor = 1 + (currentSOC / 100); // SOC arttıkça şarj hızı azalır
        return chargingTime * socFactor;
    };
    AlternativePlanner.generatePlan = async function(scenario) {
        const { startLocation, endLocation, startSOC, batteryCapacity, maxStops, strategy } = scenario;
        const segments = this.createRouteSegments(startLocation, endLocation);
        const stations = await this.findChargingStations(segments);
        const plan = {
            success: true,
            strategy: strategy,
            segments: segments,
            stations: [],
            startSOC: startSOC,
            finalSOC: startSOC,
            totalEnergy: 0,
            totalCost: 0,
            totalChargeTime: 0,
            totalDriveTime: 0,
            warnings: [],
            stops: []
        };
        let currentSOC = startSOC;
        let currentLocation = startLocation;
        let currentTime = 8 * 60; // 08:00, dakika cinsinden
        let lastStation = null;
        const consumptionPerKm = 0.178; // kWh/km
        const chargeEfficiency = 0.92;
        const minSOC = 20; // %20 altına düşme
        const arrivalTargetSOC = 50; // Varışta %50 SOC bırak
        const safetySOC = 10; // Her segmentte +%10 güvenlik payı
        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const distance = seg.distance;
            const energyNeeded = distance * consumptionPerKm;
            plan.totalEnergy += energyNeeded;
            // Sürüş süresi (ortalama 80km/h)
            const driveTime = distance / 80 * 60; // dakika
            plan.totalDriveTime += driveTime;
            currentTime += driveTime;
            // SOC güncelle
            const socDrop = (energyNeeded / batteryCapacity) * 100;
            currentSOC -= socDrop;
            // Bir sonraki istasyona veya varışa güvenli ulaşmak için gereken SOC'yi hesapla
            let nextTargetSOC = minSOC;
            let nextSegment = segments[i + 1];
            let nextDistance = 0;
            if (nextSegment) {
                nextDistance = nextSegment.distance;
            } else {
                // Son segmentten sonra varışa kalan mesafe yok, varış SOC'si hedeflenir
                nextTargetSOC = arrivalTargetSOC;
            }
            let needCharge = false;
            // Bir sonraki segmente ve güvenlik payına göre şarj kararı
            if (currentSOC < minSOC) needCharge = true;
            if (nextSegment) {
                const nextEnergy = nextDistance * consumptionPerKm;
                const nextSOCDrop = (nextEnergy / batteryCapacity) * 100;
                if (currentSOC - nextSOCDrop < minSOC + safetySOC) needCharge = true;
            } else {
                // Son segment, varış SOC'si kontrolü
                if (currentSOC < arrivalTargetSOC) needCharge = true;
            }
            if (needCharge) {
                // En yakın uygun istasyonu bul
                const availableStations = stations.filter(s => s !== lastStation);
                if (availableStations.length === 0) {
                    plan.success = false;
                    plan.warnings.push('Uygun şarj istasyonu bulunamadı');
                    break;
                }
                // En yakın istasyonu seç
                const station = availableStations.reduce((best, s) => {
                    const bestDist = this.calculateDistance(currentLocation.lat, currentLocation.lng, best.location.lat, best.location.lng);
                    const sDist = this.calculateDistance(currentLocation.lat, currentLocation.lng, s.location.lat, s.location.lng);
                    return sDist < bestDist ? s : best;
                });
                // Bir sonraki istasyona (veya varışa) güvenli ulaşmak için gereken SOC'yi hesapla
                let nextSOCNeed = minSOC;
                if (nextSegment) {
                    const nextEnergy = nextDistance * consumptionPerKm;
                    const nextSOCDrop = (nextEnergy / batteryCapacity) * 100;
                    nextSOCNeed = minSOC + nextSOCDrop + safetySOC;
                } else {
                    nextSOCNeed = arrivalTargetSOC;
                }
                let targetSOC = Math.max(nextSOCNeed, currentSOC);
                if (targetSOC > 80) targetSOC = 80; // Bataryayı %80'den fazla doldurma
                const socToCharge = targetSOC - currentSOC;
                const energyToCharge = (socToCharge / 100) * batteryCapacity;
                const chargeTime = energyToCharge / (station.power * chargeEfficiency) * 60; // dakika
                const chargeCost = energyToCharge * (station.price || 0);
                plan.totalChargeTime += chargeTime;
                plan.totalCost += chargeCost;
                // Log şarj durağı
                plan.stops.push({
                    station: station.name || station.AddressInfo?.Title || 'Bilinmeyen',
                    location: station.location,
                    arrivalSOC: currentSOC,
                    chargeToSOC: targetSOC,
                    energy: energyToCharge,
                    chargeTime: chargeTime,
                    cost: chargeCost,
                    arrivalTime: this.formatTime(currentTime),
                    departureTime: this.formatTime(currentTime + chargeTime)
                });
                // SOC ve zaman güncelle
                currentSOC = targetSOC;
                currentTime += chargeTime;
                lastStation = station;
                plan.stations.push(station);
            }
            currentLocation = seg.end;
        }
        plan.finalSOC = currentSOC;
        plan.totalTime = plan.totalDriveTime + plan.totalChargeTime;
        plan.arrivalTime = this.formatTime(currentTime);
        plan.departureTime = '08:00';
        return plan;
    };
    AlternativePlanner.formatTime = function(minutes) {
        const h = Math.floor(minutes / 60);
        const m = Math.round(minutes % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };
    AlternativePlanner.createRouteSegments = function(start, end) {
        // Haversine ile toplam mesafe
        const totalDistance = this.calculateDistance(start.lat, start.lng, end.lat, end.lng);
        const segmentLength = 50; // km
        const numSegments = Math.ceil(totalDistance / segmentLength);
        const segments = [];
        for (let i = 0; i < numSegments; i++) {
            const ratio1 = i / numSegments;
            const ratio2 = (i + 1) / numSegments;
            const segStart = {
                lat: start.lat + (end.lat - start.lat) * ratio1,
                lng: start.lng + (end.lng - start.lng) * ratio1
            };
            const segEnd = {
                lat: start.lat + (end.lat - start.lat) * ratio2,
                lng: start.lng + (end.lng - start.lng) * ratio2
            };
            segments.push({ start: segStart, end: segEnd, distance: this.calculateDistance(segStart.lat, segStart.lng, segEnd.lat, segEnd.lng), elevation: 0 });
        }
        return segments;
    };
    AlternativePlanner.findChargingStations = async function(segments) {
        // Segmentlerin ortasındaki noktaları al
        const searchPoints = segments.map(seg => ({
            latitude: (seg.start.lat + seg.end.lat) / 2,
            longitude: (seg.start.lng + seg.end.lng) / 2
        }));
        // OpenChargeMap servisinden istasyonları çek
        const service = chargingStationService.chargingStationService;
        let allStations = [];
        for (const point of searchPoints) {
            const stations = await service.searchChargingStations({
                latitude: point.latitude,
                longitude: point.longitude,
                distance: 100, // 100 km yarıçap
                maxResults: 20
            });
            // OpenChargeMap istasyonlarını normalize et
            const normalized = stations.map(s => {
                let lat = s.AddressInfo && typeof s.AddressInfo.Latitude === 'number' ? s.AddressInfo.Latitude : undefined;
                let lng = s.AddressInfo && typeof s.AddressInfo.Longitude === 'number' ? s.AddressInfo.Longitude : undefined;
                return {
                    ...s,
                    location: lat !== undefined && lng !== undefined ? { lat, lng } : undefined,
                    power: (s.Connections && s.Connections[0] && s.Connections[0].PowerKW) || 0,
                    available: true // Gerçek zamanlı müsaitlik yoksa true kabul et
                };
            }).filter(s => s.location);
            allStations = allStations.concat(normalized);
        }
        // ID'ye göre benzersizleştir
        const uniqueStations = [];
        const seen = new Set();
        for (const s of allStations) {
            if (!seen.has(s.ID)) {
                uniqueStations.push(s);
                seen.add(s.ID);
            }
        }
        return uniqueStations;
    };
    AlternativePlanner.findBestStation = function(stations, location, currentSOC, strategy) {
        if (!stations || stations.length === 0) return null;
        // Sadece location bilgisi tam olan istasyonları dahil et
        const validStations = stations.filter(s => s.location && typeof s.location.lat === 'number' && typeof s.location.lng === 'number');
        if (validStations.length === 0) return null;
        // Stratejiye göre sırala
        switch (strategy) {
            case 'minStops':
                // En yüksek güçlü istasyonu seç
                return validStations.reduce((best, current) => (current.power > best.power) ? current : best);
            case 'minTime':
                // En yakın istasyonu seç
                return validStations.reduce((best, current) => {
                    const bestDist = this.calculateDistance(location.lat, location.lng, best.location.lat, best.location.lng);
                    const currentDist = this.calculateDistance(location.lat, location.lng, current.location.lat, current.location.lng);
                    return (currentDist < bestDist) ? current : best;
                });
            case 'balanced':
            default:
                // Güç ve mesafeyi dengele
                return validStations.reduce((best, current) => {
                    const bestDist = this.calculateDistance(location.lat, location.lng, best.location.lat, best.location.lng);
                    const currentDist = this.calculateDistance(location.lat, location.lng, current.location.lat, current.location.lng);
                    const bestScore = (best.power || 1) / (bestDist || 1);
                    const currentScore = (current.power || 1) / (currentDist || 1);
                    return (currentScore > bestScore) ? current : best;
                });
        }
    };
    return AlternativePlanner;
}());
exports.AlternativePlanner = AlternativePlanner;
