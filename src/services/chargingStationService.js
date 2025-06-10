"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chargingStationService = void 0;
exports.getChargingSearchPoints = getChargingSearchPoints;
var axios_1 = require("axios");
var p_queue_1 = require("p-queue");
var events_1 = require("events");
var OPEN_CHARGE_MAP_API_KEY = '3b138d13-f1f2-4784-a3d8-1cce443eb600';
var BASE_URL = 'https://api.openchargemap.io/v3';
var ChargingStationService = /** @class */ (function () {
    function ChargingStationService() {
        this.cache = new Map();
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 dakika cache
        this.queue = new p_queue_1.default({ interval: 2000, intervalCap: 1 }); // 1 req/2sec - Çok daha güvenli
        this.apiKey = OPEN_CHARGE_MAP_API_KEY;
        this.baseUrl = BASE_URL;
        this.cacheManager = new CacheManager();
        this.eventEmitter = new events_1.EventEmitter();
    }
    ChargingStationService.getInstance = function () {
        if (!ChargingStationService.instance) {
            ChargingStationService.instance = new ChargingStationService();
        }
        return ChargingStationService.instance;
    };
    ChargingStationService.prototype.onCacheHit = function (callback) {
        this.eventEmitter.on('cacheHit', callback);
    };
    ChargingStationService.prototype.onCacheMiss = function (callback) {
        this.eventEmitter.on('cacheMiss', callback);
    };
    ChargingStationService.prototype.removeAllListeners = function () {
        this.eventEmitter.removeAllListeners();
    };
    /**
     * Cache key oluştur - ChatGPT önerisi ile optimize edildi
     */
    ChargingStationService.prototype.getCacheKey = function (lat, lng, radius) {
        // toFixed(3) ile daha iyi cache hit oranı (≈111m tolerans)
        var roundedLat = lat.toFixed(3);
        var roundedLng = lng.toFixed(3);
        return "".concat(roundedLat, ",").concat(roundedLng, "_r").concat(radius);
    };
    /**
     * 📍 GeoHash tabanlı kümeleme - ChatGPT önerisi
     */
    ChargingStationService.prototype.simpleGeoHash = function (lat, lng, precision) {
        if (precision === void 0) { precision = 5; }
        // Basit GeoHash implementasyonu
        var latBase = Math.floor(lat * Math.pow(10, precision));
        var lngBase = Math.floor(lng * Math.pow(10, precision));
        return "".concat(latBase, "_").concat(lngBase);
    };
    /**
     * 🎯 Rota noktalarını GeoHash kümelerine ayır
     */
    ChargingStationService.prototype.clusterPointsByGeoHash = function (points, precision) {
        var _this = this;
        if (precision === void 0) { precision = 5; }
        var clusters = new Map();
        // Noktaları GeoHash kümelerine ayır
        points.forEach(function (point) {
            var geoHash = _this.simpleGeoHash(point.latitude, point.longitude, precision);
            if (!clusters.has(geoHash)) {
                clusters.set(geoHash, []);
            }
            clusters.get(geoHash).push(point);
        });
        // Her küme için temsili nokta seç (merkez nokta)
        var representatives = [];
        clusters.forEach(function (clusterPoints, geoHash) {
            var avgLat = clusterPoints.reduce(function (sum, p) { return sum + p.latitude; }, 0) / clusterPoints.length;
            var avgLng = clusterPoints.reduce(function (sum, p) { return sum + p.longitude; }, 0) / clusterPoints.length;
            representatives.push({
                representative: { latitude: avgLat, longitude: avgLng },
                cluster: geoHash,
                count: clusterPoints.length
            });
        });
        return representatives;
    };
    /**
     * Cache'den veri al
     */
    ChargingStationService.prototype.getCachedStations = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var cached;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.cacheManager.get(key)];
                    case 1:
                        cached = _a.sent();
                        if (cached) {
                            this.eventEmitter.emit('cacheHit');
                            return [2 /*return*/, cached];
                        }
                        this.eventEmitter.emit('cacheMiss');
                        return [2 /*return*/, null];
                }
            });
        });
    };
    /**
     * Cache'e veri kaydet
     */
    ChargingStationService.prototype.saveToCache = function (key, data) {
        this.cache.set(key, { data: data, timestamp: Date.now() });
        // Cache size kontrolü (max 100 entry)
        if (this.cache.size > 100) {
            var firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }
    };
    /**
     * 🔄 Rate limiting ve retry logic ile API çağrısı
     */
    ChargingStationService.prototype.makeAPICallWithRetry = function (url_1) {
        return __awaiter(this, arguments, void 0, function (url, maxRetries) {
            var _loop_1, attempt, state_1;
            var _a;
            if (maxRetries === void 0) { maxRetries = 3; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _loop_1 = function (attempt) {
                            var response, error_1, delayMs_1;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        _c.trys.push([0, 2, , 6]);
                                        return [4 /*yield*/, axios_1.default.get(url, {
                                                timeout: 15000, // 15 saniye timeout
                                            })];
                                    case 1:
                                        response = _c.sent();
                                        return [2 /*return*/, { value: response }];
                                    case 2:
                                        error_1 = _c.sent();
                                        if (!(((_a = error_1.response) === null || _a === void 0 ? void 0 : _a.status) === 429)) return [3 /*break*/, 4];
                                        delayMs_1 = Math.min(5000 * Math.pow(2, attempt), 30000);
                                        console.warn("\u23F3 Rate limited, waiting ".concat(delayMs_1, "ms before retry ").concat(attempt, "/").concat(maxRetries));
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, delayMs_1); })];
                                    case 3:
                                        _c.sent();
                                        if (attempt === maxRetries) {
                                            console.error('❌ Max retries reached for rate limiting');
                                            throw error_1;
                                        }
                                        return [3 /*break*/, 5];
                                    case 4: 
                                    // Diğer error'lar için hemen throw et
                                    throw error_1;
                                    case 5: return [3 /*break*/, 6];
                                    case 6: return [2 /*return*/];
                                }
                            });
                        };
                        attempt = 1;
                        _b.label = 1;
                    case 1:
                        if (!(attempt <= maxRetries)) return [3 /*break*/, 4];
                        return [5 /*yield**/, _loop_1(attempt)];
                    case 2:
                        state_1 = _b.sent();
                        if (typeof state_1 === "object")
                            return [2 /*return*/, state_1.value];
                        _b.label = 3;
                    case 3:
                        attempt++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Belirli koordinatlarda şarj istasyonlarını arar
     */
    ChargingStationService.prototype.searchChargingStations = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var searchParams, response, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        searchParams = new URLSearchParams({
                            output: 'json',
                            key: this.apiKey,
                            latitude: params.latitude.toString(),
                            longitude: params.longitude.toString(),
                            distance: (params.distance || 25).toString(),
                            maxresults: (params.maxResults || 20).toString(),
                            compact: (params.compact !== false).toString(),
                            includecomments: (params.includeComments || false).toString(),
                        });
                        // Optional parameters
                        if (params.operatorId) {
                            searchParams.append('operatorid', params.operatorId.toString());
                        }
                        if (params.connectionTypeId) {
                            searchParams.append('connectiontypeid', params.connectionTypeId.toString());
                        }
                        if (params.levelId) {
                            searchParams.append('levelid', params.levelId.toString());
                        }
                        if (params.usageTypeId) {
                            searchParams.append('usagetypeid', params.usageTypeId.toString());
                        }
                        if (params.statusTypeId) {
                            searchParams.append('statustypeid', params.statusTypeId.toString());
                        }
                        console.log('🔌 Searching charging stations with params:', searchParams.toString());
                        // Rate limiting için delay ekle (paralel çağrılarda azalt)
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 200); })];
                    case 1:
                        // Rate limiting için delay ekle (paralel çağrılarda azalt)
                        _a.sent(); // 200ms delay
                        return [4 /*yield*/, this.makeAPICallWithRetry("".concat(this.baseUrl, "/poi/?").concat(searchParams.toString()))];
                    case 2:
                        response = _a.sent();
                        console.log("\uD83D\uDD0C Found ".concat(response.data.length, " charging stations"));
                        return [2 /*return*/, response.data];
                    case 3:
                        error_2 = _a.sent();
                        console.error('❌ Error fetching charging stations:', error_2);
                        throw error_2;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 🎯 Adaptif yarıçap ile şarj istasyonu arama
     */
    ChargingStationService.prototype.searchWithAdaptiveRadius = function (latitude_1, longitude_1) {
        return __awaiter(this, arguments, void 0, function (latitude, longitude, radius) {
            var cacheKey, cachedStations, params, response, stations, error_3;
            if (radius === void 0) { radius = 15; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = "".concat(latitude.toFixed(3), ",").concat(longitude.toFixed(3), "_r").concat(radius);
                        return [4 /*yield*/, this.cacheManager.get(cacheKey)];
                    case 1:
                        cachedStations = _a.sent();
                        if (cachedStations) {
                            console.log("\uD83C\uDFAF Cache hit: ".concat(cacheKey));
                            return [2 /*return*/, cachedStations];
                        }
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 6, , 7]);
                        console.log("\uD83D\uDD0D Trying radius ".concat(radius, "km for point (").concat(latitude, ", ").concat(longitude, ")"));
                        params = {
                            output: 'json',
                            key: process.env.OPEN_CHARGE_MAP_API_KEY,
                            latitude: latitude.toString(),
                            longitude: longitude.toString(),
                            distance: radius.toString(),
                            maxresults: '10',
                            compact: 'true',
                            includecomments: 'false',
                            statustypeid: '50'
                        };
                        console.log('🔌 Searching charging stations with params:', params);
                        return [4 /*yield*/, fetch("https://api.openchargemap.io/v3/poi?".concat(new URLSearchParams(params)))];
                    case 3:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("API error: ".concat(response.status));
                        }
                        return [4 /*yield*/, response.json()];
                    case 4:
                        stations = _a.sent();
                        console.log("\uD83D\uDD0C Found ".concat(stations.length, " charging stations"));
                        // Sonuçları önbelleğe al (1 saat)
                        return [4 /*yield*/, this.cacheManager.set(cacheKey, stations, 3600)];
                    case 5:
                        // Sonuçları önbelleğe al (1 saat)
                        _a.sent();
                        return [2 /*return*/, stations];
                    case 6:
                        error_3 = _a.sent();
                        console.error('❌ Error searching stations:', error_3);
                        return [2 /*return*/, []];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 🎯 Polyline'a en yakın istasyonları filtreler
     */
    ChargingStationService.prototype.filterNearestToRoute = function (stations, routePoints, maxDistanceKm) {
        var _this = this;
        if (maxDistanceKm === void 0) { maxDistanceKm = 10; }
        return stations.filter(function (station) {
            var _a, _b;
            if (!((_a = station.AddressInfo) === null || _a === void 0 ? void 0 : _a.Latitude) || !((_b = station.AddressInfo) === null || _b === void 0 ? void 0 : _b.Longitude))
                return false;
            // En yakın polyline noktasına olan mesafeyi bul
            var minDistance = Infinity;
            for (var _i = 0, routePoints_1 = routePoints; _i < routePoints_1.length; _i++) {
                var point = routePoints_1[_i];
                var distance = _this.calculateDistance(station.AddressInfo.Latitude, station.AddressInfo.Longitude, point.latitude, point.longitude);
                minDistance = Math.min(minDistance, distance);
            }
            return minDistance <= maxDistanceKm;
        });
    };
    /**
     * 📏 İki koordinat arası mesafe hesaplama (Haversine)
     */
    ChargingStationService.prototype.calculateDistance = function (lat1, lon1, lat2, lon2) {
        var R = 6371; // Dünya yarıçapı (km)
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };
    /**
     * 🔋 Güç seviyesine göre kategorileme
     */
    ChargingStationService.prototype.categorizeByPower = function (stations) {
        var fast = [];
        var medium = [];
        var slow = [];
        stations.forEach(function (station) {
            var _a, _b;
            var powerKW = ((_b = (_a = station.Connections) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.PowerKW) || 0;
            if (powerKW >= 50) {
                fast.push(station);
            }
            else if (powerKW >= 22) {
                medium.push(station);
            }
            else {
                slow.push(station);
            }
        });
        return { fast: fast, medium: medium, slow: slow };
    };
    /**
     * 🚗 Batarya kapasitesine göre akıllı durak seçimi
     */
    ChargingStationService.prototype.selectOptimalStops = function (stations, routePoints, batteryRangeKm) {
        var _this = this;
        var _a, _b, _c;
        if (batteryRangeKm === void 0) { batteryRangeKm = 200; }
        if (stations.length === 0)
            return [];
        // Güç seviyesine göre kategorile
        var _d = this.categorizeByPower(stations), fast = _d.fast, medium = _d.medium, slow = _d.slow;
        console.log("\uD83D\uDD0B Power categories: Fast(".concat(fast.length, "), Medium(").concat(medium.length, "), Slow(").concat(slow.length, ")"));
        // Öncelik sırası: Hızlı -> Orta -> Yavaş
        var prioritizedStations = __spreadArray(__spreadArray(__spreadArray([], fast, true), medium, true), slow, true);
        // Rota boyunca her 150km'de bir durak seç (güvenlik marjı)
        var stopIntervalKm = batteryRangeKm * 0.75; // %75 güvenlik marjı
        var totalRouteKm = this.estimateRouteDistance(routePoints);
        var numberOfStops = Math.ceil(totalRouteKm / stopIntervalKm);
        console.log("\uD83D\uDEE3\uFE0F Route distance: ".concat(totalRouteKm.toFixed(1), "km, Need ").concat(numberOfStops, " stops every ").concat(stopIntervalKm, "km"));
        var selectedStops = [];
        var routeSegmentSize = routePoints.length / numberOfStops;
        var _loop_2 = function (i) {
            var segmentStart = Math.floor(i * routeSegmentSize);
            var segmentEnd = Math.floor((i + 1) * routeSegmentSize);
            var segmentPoints = routePoints.slice(segmentStart, segmentEnd);
            if (segmentPoints.length === 0)
                return "continue";
            // Bu segment için en uygun istasyonu bul
            var nearbyStations = prioritizedStations.filter(function (station) {
                var _a, _b;
                if (!((_a = station.AddressInfo) === null || _a === void 0 ? void 0 : _a.Latitude) || !((_b = station.AddressInfo) === null || _b === void 0 ? void 0 : _b.Longitude))
                    return false;
                var minDistance = Infinity;
                for (var _i = 0, segmentPoints_1 = segmentPoints; _i < segmentPoints_1.length; _i++) {
                    var point = segmentPoints_1[_i];
                    var distance = _this.calculateDistance(station.AddressInfo.Latitude, station.AddressInfo.Longitude, point.latitude, point.longitude);
                    minDistance = Math.min(minDistance, distance);
                }
                return minDistance <= 15; // 15km içinde
            });
            if (nearbyStations.length > 0) {
                // En yüksek güce sahip olanı seç
                var bestStation = nearbyStations.reduce(function (best, current) {
                    var _a, _b, _c, _d;
                    var bestPower = ((_b = (_a = best.Connections) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.PowerKW) || 0;
                    var currentPower = ((_d = (_c = current.Connections) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.PowerKW) || 0;
                    return currentPower > bestPower ? current : best;
                });
                selectedStops.push(bestStation);
                console.log("\u26A1 Selected stop ".concat(i + 1, ": ").concat((_a = bestStation.AddressInfo) === null || _a === void 0 ? void 0 : _a.Title, " (").concat(((_c = (_b = bestStation.Connections) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.PowerKW) || 0, "kW)"));
            }
        };
        for (var i = 0; i < numberOfStops; i++) {
            _loop_2(i);
        }
        return selectedStops;
    };
    /**
     * 📐 Rota uzunluğunu tahmin et
     */
    ChargingStationService.prototype.estimateRouteDistance = function (routePoints) {
        var totalDistance = 0;
        for (var i = 1; i < routePoints.length; i++) {
            totalDistance += this.calculateDistance(routePoints[i - 1].latitude, routePoints[i - 1].longitude, routePoints[i].latitude, routePoints[i].longitude);
        }
        return totalDistance;
    };
    /**
     * 🧹 Gelişmiş duplicate filtreleme
     */
    ChargingStationService.prototype.removeDuplicatesAdvanced = function (stations) {
        var _a, _b, _c, _d;
        var uniqueStations = [];
        var seenIds = new Set();
        var seenCoordinates = new Set();
        var seenNames = new Set();
        for (var _i = 0, stations_1 = stations; _i < stations_1.length; _i++) {
            var station = stations_1[_i];
            // 1. ID bazlı kontrol
            if (seenIds.has(station.ID))
                continue;
            // 2. Koordinat bazlı kontrol (100m yarıçap)
            if (((_a = station.AddressInfo) === null || _a === void 0 ? void 0 : _a.Latitude) && ((_b = station.AddressInfo) === null || _b === void 0 ? void 0 : _b.Longitude)) {
                var coordKey = "".concat(station.AddressInfo.Latitude.toFixed(3), ",").concat(station.AddressInfo.Longitude.toFixed(3));
                if (seenCoordinates.has(coordKey))
                    continue;
                seenCoordinates.add(coordKey);
            }
            // 3. İsim benzerliği kontrolü
            var normalizedName = ((_d = (_c = station.AddressInfo) === null || _c === void 0 ? void 0 : _c.Title) === null || _d === void 0 ? void 0 : _d.toLowerCase().replace(/[^a-z0-9]/g, '')) || '';
            if (normalizedName && seenNames.has(normalizedName))
                continue;
            if (normalizedName)
                seenNames.add(normalizedName);
            seenIds.add(station.ID);
            uniqueStations.push(station);
        }
        console.log("\uD83E\uDDF9 Removed ".concat(stations.length - uniqueStations.length, " duplicates (").concat(stations.length, " \u2192 ").concat(uniqueStations.length, ")"));
        return uniqueStations;
    };
    /**
     * Rota üzerindeki şarj istasyonlarını bulur
     */
    ChargingStationService.prototype.findChargingStationsAlongRoute = function (routePoints_2) {
        return __awaiter(this, arguments, void 0, function (routePoints, searchRadius, batteryRangeKm) {
            var clusteredPoints, searchPoints, routeLength, optimalClusterCount, limitedSearchPoints_1, routeLength_1, allStations, cacheKey, cachedStations, searchPromises, results, stationSet, _i, results_1, result, _a, _b, station, nearbyStations, error_4;
            var _this = this;
            if (searchRadius === void 0) { searchRadius = 15; }
            if (batteryRangeKm === void 0) { batteryRangeKm = 200; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 4, , 5]);
                        console.log('🔌 Finding charging stations along route with advanced optimization...');
                        clusteredPoints = this.clusterPointsByGeoHash(routePoints, 3);
                        searchPoints = clusteredPoints.map(function (cluster) { return cluster.representative; });
                        routeLength = routePoints.length;
                        optimalClusterCount = Math.min(Math.max(3, Math.ceil(routeLength / 100)), // Her 100 nokta için 1 küme
                        5 // Maksimum 5 küme
                        );
                        limitedSearchPoints_1 = searchPoints.slice(0, optimalClusterCount);
                        // 🚨 Emergency fallback: Eğer çok fazla küme varsa akıllı 3 nokta sistemine geç
                        if (limitedSearchPoints_1.length > 3) {
                            console.log('⚠️ Too many clusters, using smart 3-point search');
                            routeLength_1 = routePoints.length;
                            limitedSearchPoints_1 = [
                                routePoints[0], // Başlangıç
                                routePoints[Math.floor(routeLength_1 * 0.4)], // %40 noktası
                                routePoints[routeLength_1 - 1] // Bitiş
                            ];
                        }
                        console.log("\uD83E\uDDE0 GeoHash clustering: ".concat(routePoints.length, " points \u2192 ").concat(clusteredPoints.length, " clusters"));
                        clusteredPoints.forEach(function (cluster, i) {
                            console.log("\uD83D\uDCCD Cluster ".concat(i + 1, ": ").concat(cluster.count, " points \u2192 (").concat(cluster.representative.latitude.toFixed(4), ", ").concat(cluster.representative.longitude.toFixed(4), ")"));
                        });
                        console.log("\uD83C\uDFAF Searching at ".concat(limitedSearchPoints_1.length, " clustered points along route (limited for safety)"));
                        allStations = [];
                        cacheKey = "route_".concat(routePoints[0].latitude, "_").concat(routePoints[0].longitude, "_").concat(routePoints[routePoints.length - 1].latitude, "_").concat(routePoints[routePoints.length - 1].longitude);
                        return [4 /*yield*/, this.cacheManager.get(cacheKey)];
                    case 1:
                        cachedStations = _c.sent();
                        if (cachedStations) {
                            console.log('🎯 Cache hit for route');
                            return [2 /*return*/, cachedStations];
                        }
                        // 🚀 Rate-limit-aware Queue ile paralel API çağrıları
                        console.log("\u26A1 Making ".concat(limitedSearchPoints_1.length, " queue-managed API calls..."));
                        searchPromises = limitedSearchPoints_1.map(function (point, i) {
                            return _this.queue.add(function () { return __awaiter(_this, void 0, void 0, function () {
                                var dynamicRadius, stationsAtPoint, error_5;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            console.log("\uD83D\uDD0D Search point ".concat(i + 1, "/").concat(limitedSearchPoints_1.length, ": (").concat(point.latitude.toFixed(5), ", ").concat(point.longitude.toFixed(5), ")"));
                                            _a.label = 1;
                                        case 1:
                                            _a.trys.push([1, 3, , 4]);
                                            dynamicRadius = Math.min(Math.max(searchRadius, batteryRangeKm / 10), // Minimum searchRadius, maksimum batarya menzilinin 1/10'u
                                            30 // Maksimum 30km
                                            );
                                            return [4 /*yield*/, this.searchWithAdaptiveRadius(point.latitude, point.longitude, dynamicRadius)];
                                        case 2:
                                            stationsAtPoint = _a.sent();
                                            console.log("\u2705 Point ".concat(i + 1, " completed: ").concat(stationsAtPoint.length, " stations found"));
                                            return [2 /*return*/, { point: point, stations: stationsAtPoint, index: i }];
                                        case 3:
                                            error_5 = _a.sent();
                                            console.warn("\u26A0\uFE0F Error searching at point ".concat(i + 1, ":"), error_5);
                                            return [2 /*return*/, { point: point, stations: [], index: i }];
                                        case 4: return [2 /*return*/];
                                    }
                                });
                            }); });
                        });
                        return [4 /*yield*/, Promise.all(searchPromises)];
                    case 2:
                        results = _c.sent();
                        stationSet = new Set();
                        for (_i = 0, results_1 = results; _i < results_1.length; _i++) {
                            result = results_1[_i];
                            if (result && result.stations.length > 0) {
                                for (_a = 0, _b = result.stations; _a < _b.length; _a++) {
                                    station = _b[_a];
                                    if (!stationSet.has(station.ID)) {
                                        stationSet.add(station.ID);
                                        allStations.push(station);
                                    }
                                }
                                console.log("\u2795 Added stations from point ".concat(result.index + 1, " (").concat(allStations.length, " total)"));
                            }
                        }
                        console.log("\uD83D\uDCCA Raw stations found: ".concat(allStations.length));
                        nearbyStations = this.filterNearestToRoute(allStations, routePoints, 10);
                        console.log("\uD83D\uDCCD Stations within 10km of route: ".concat(nearbyStations.length));
                        // Sonuçları önbelleğe al (1 saat)
                        return [4 /*yield*/, this.cacheManager.set(cacheKey, nearbyStations, 3600)];
                    case 3:
                        // Sonuçları önbelleğe al (1 saat)
                        _c.sent();
                        return [2 /*return*/, nearbyStations];
                    case 4:
                        error_4 = _c.sent();
                        console.error('❌ Error finding charging stations:', error_4);
                        throw error_4;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Şarj istasyonunun maksimum güç değerini döndürür
     */
    ChargingStationService.prototype.getMaxPowerKW = function (station) {
        if (!station.Connections || station.Connections.length === 0) {
            return 0;
        }
        return Math.max.apply(Math, station.Connections.map(function (conn) { return conn.PowerKW || 0; }));
    };
    /**
     * Rota üzerinde arama noktalarını seçer
     */
    ChargingStationService.prototype.selectSearchPointsAlongRoute = function (routePoints, numberOfPoints) {
        if (routePoints.length <= numberOfPoints) {
            return routePoints;
        }
        var selectedPoints = [];
        var step = Math.floor(routePoints.length / numberOfPoints);
        for (var i = 0; i < numberOfPoints; i++) {
            var index = i * step;
            if (index < routePoints.length) {
                selectedPoints.push(routePoints[index]);
            }
        }
        // Son noktayı ekle
        if (selectedPoints[selectedPoints.length - 1] !== routePoints[routePoints.length - 1]) {
            selectedPoints[selectedPoints.length - 1] = routePoints[routePoints.length - 1];
        }
        return selectedPoints;
    };
    /**
     * Şarj istasyonu tiplerini getirir
     */
    ChargingStationService.prototype.getConnectionTypes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, axios_1.default.get("".concat(this.baseUrl, "/connectiontypes/?output=json"))];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                    case 2:
                        error_6 = _a.sent();
                        console.error('❌ Error fetching connection types:', error_6);
                        throw error_6;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Operatörleri getirir
     */
    ChargingStationService.prototype.getOperators = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, axios_1.default.get("".concat(this.baseUrl, "/operators/?output=json"))];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                    case 2:
                        error_7 = _a.sent();
                        console.error('❌ Error fetching operators:', error_7);
                        throw error_7;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Mock şarj istasyonları (test için)
     */
    ChargingStationService.prototype.getMockChargingStations = function (latitude, longitude) {
        return [
            {
                ID: 1001,
                UUID: 'mock-uuid-1',
                DataProvider: { ID: 1, Title: 'Mock Provider' },
                OperatorInfo: {
                    ID: 1,
                    Title: 'CV Charging',
                    WebsiteURL: 'https://cv-charging.com',
                    ContactEmail: 'info@cv-charging.com'
                },
                UsageType: {
                    ID: 1,
                    Title: 'Public',
                    IsPayAtLocation: true,
                    IsMembershipRequired: false,
                    IsAccessKeyRequired: false
                },
                StatusType: {
                    ID: 50,
                    Title: 'Operational',
                    IsOperational: true
                },
                AddressInfo: {
                    ID: 1,
                    Title: 'Antalya Mall Şarj İstasyonu',
                    AddressLine1: 'Antalya Mall AVM',
                    Town: 'Antalya',
                    Country: { ID: 1, ISOCode: 'TR', Title: 'Turkey' },
                    Latitude: latitude + 0.01,
                    Longitude: longitude + 0.01,
                    AccessComments: '7/24 açık'
                },
                Connections: [
                    {
                        ID: 1,
                        ConnectionTypeID: 25,
                        ConnectionType: {
                            ID: 25,
                            Title: 'Type 2 (Socket Only)',
                            FormalName: 'IEC 62196-2 Type 2',
                            IsDiscontinued: false,
                            IsObsolete: false
                        },
                        PowerKW: 22,
                        Voltage: 400,
                        Amps: 32,
                        CurrentTypeID: 20,
                        CurrentType: { ID: 20, Title: 'AC (Three-Phase)' },
                        Quantity: 2
                    }
                ],
                NumberOfPoints: 2,
                GeneralComments: 'Hızlı şarj istasyonu',
                DateCreated: '2024-01-15T10:00:00Z',
                SubmissionStatus: { ID: 200, Title: 'Published', IsLive: true },
                IsRecentlyVerified: true,
                Distance: 1.5
            },
            {
                ID: 1002,
                UUID: 'mock-uuid-2',
                DataProvider: { ID: 1, Title: 'Mock Provider' },
                OperatorInfo: {
                    ID: 2,
                    Title: 'EŞARJ',
                    WebsiteURL: 'https://esarj.com.tr'
                },
                UsageType: {
                    ID: 4,
                    Title: 'Public - Membership Required',
                    IsPayAtLocation: false,
                    IsMembershipRequired: true,
                    IsAccessKeyRequired: true
                },
                StatusType: {
                    ID: 50,
                    Title: 'Operational',
                    IsOperational: true
                },
                AddressInfo: {
                    ID: 2,
                    Title: 'Migros Şarj Noktası',
                    AddressLine1: 'Migros Market',
                    Town: 'Antalya',
                    Country: { ID: 1, ISOCode: 'TR', Title: 'Turkey' },
                    Latitude: latitude - 0.015,
                    Longitude: longitude - 0.02,
                    AccessComments: 'Market saatleri içinde'
                },
                Connections: [
                    {
                        ID: 2,
                        ConnectionTypeID: 32,
                        ConnectionType: {
                            ID: 32,
                            Title: 'CCS (Type 2)',
                            FormalName: 'Combined Charging System',
                            IsDiscontinued: false,
                            IsObsolete: false
                        },
                        PowerKW: 50,
                        Voltage: 400,
                        CurrentTypeID: 30,
                        CurrentType: { ID: 30, Title: 'DC' },
                        Quantity: 1
                    }
                ],
                NumberOfPoints: 1,
                GeneralComments: 'DC Hızlı şarj',
                DateCreated: '2024-02-10T15:30:00Z',
                SubmissionStatus: { ID: 200, Title: 'Published', IsLive: true },
                IsRecentlyVerified: true,
                Distance: 2.8
            }
        ];
    };
    return ChargingStationService;
}());
// Cache Manager sınıfı
var CacheManager = /** @class */ (function () {
    function CacheManager() {
        this.cache = new Map();
    }
    CacheManager.prototype.get = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var item;
            return __generator(this, function (_a) {
                item = this.cache.get(key);
                if (!item)
                    return [2 /*return*/, null];
                if (Date.now() > item.expiry) {
                    this.cache.delete(key);
                    return [2 /*return*/, null];
                }
                return [2 /*return*/, item.data];
            });
        });
    };
    CacheManager.prototype.set = function (key, data, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.cache.set(key, {
                    data: data,
                    expiry: Date.now() + (ttlSeconds * 1000)
                });
                return [2 /*return*/];
            });
        });
    };
    return CacheManager;
}());
/**
 * 🧭 Rota boyunca eşit aralıklarla şarj istasyonu arama noktaları oluşturur
 *
 * @param polylinePoints - Google Directions API'den gelen rota noktaları
 * @param desiredCount - Kaç farklı arama noktası kullanılacak (örneğin 20)
 * @returns Eşit aralıklarla seçilmiş arama noktalarının array'i
 *
 * @example
 * ```ts
 * const searchPoints = getChargingSearchPoints(polylinePoints, 20);
 * console.log(`${searchPoints.length} arama noktası oluşturuldu`);
 * ```
 */
function getChargingSearchPoints(polylinePoints, desiredCount) {
    console.log("\uD83E\uDDED Creating ".concat(desiredCount, " search points from ").concat(polylinePoints.length, " route points"));
    // Edge cases
    if (polylinePoints.length === 0) {
        console.warn('⚠️ No polyline points provided');
        return [];
    }
    if (desiredCount <= 0) {
        console.warn('⚠️ Desired count must be positive');
        return [];
    }
    if (desiredCount >= polylinePoints.length) {
        console.log('ℹ️ Desired count >= polyline length, returning all points');
        return polylinePoints;
    }
    var searchPoints = [];
    var step = polylinePoints.length / desiredCount;
    for (var i = 0; i < desiredCount; i++) {
        var index = Math.floor(i * step);
        var point = polylinePoints[index];
        searchPoints.push(point);
        console.log("\uD83D\uDCCD Search point ".concat(i + 1, ": lat=").concat(point.latitude.toFixed(5), ", lng=").concat(point.longitude.toFixed(5), " (index: ").concat(index, ")"));
    }
    console.log("\u2705 Created ".concat(searchPoints.length, " evenly distributed search points"));
    return searchPoints;
}
exports.chargingStationService = ChargingStationService.getInstance();
exports.default = exports.chargingStationService;
