import axios from 'axios';

const OPEN_CHARGE_MAP_API_KEY = '3b138d13-f1f2-4784-a3d8-1cce443eb600';
const BASE_URL = 'https://api.openchargemap.io/v3';

export interface ChargingStation {
  ID: number;
  UUID: string;
  DataProvider: {
    ID: number;
    Title: string;
  };
  OperatorInfo?: {
    ID: number;
    Title: string;
    WebsiteURL?: string;
    ContactEmail?: string;
  } | null;
  UsageType: {
    ID: number;
    Title: string;
    IsPayAtLocation: boolean;
    IsMembershipRequired: boolean;
    IsAccessKeyRequired: boolean;
  };
  StatusType: {
    ID: number;
    Title: string;
    IsOperational: boolean;
  };
  AddressInfo?: {
    ID: number;
    Title: string;
    AddressLine1?: string;
    AddressLine2?: string;
    Town?: string;
    StateOrProvince?: string;
    Postcode?: string;
    Country: {
      ID: number;
      ISOCode: string;
      Title: string;
    };
    Latitude: number;
    Longitude: number;
    ContactTelephone1?: string;
    ContactTelephone2?: string;
    ContactEmail?: string;
    AccessComments?: string;
    RelatedURL?: string;
  } | null;
  Connections?: Array<{
    ID: number;
    ConnectionTypeID: number;
    ConnectionType?: {
      ID: number;
      Title: string;
      FormalName?: string;
      IsDiscontinued: boolean;
      IsObsolete: boolean;
    } | null;
    Reference?: string;
    StatusTypeID?: number;
    StatusType?: {
      ID: number;
      Title: string;
      IsOperational: boolean;
    };
    LevelID?: number;
    Level?: {
      ID: number;
      Title: string;
      Comments?: string;
    };
    Amps?: number;
    Voltage?: number;
    PowerKW?: number;
    CurrentTypeID?: number;
    CurrentType?: {
      ID: number;
      Title: string;
      Description?: string;
    };
    Quantity?: number;
    Comments?: string;
  }> | null;
  NumberOfPoints?: number;
  GeneralComments?: string;
  DatePlanned?: string;
  DateLastConfirmed?: string;
  DateLastStatusUpdate?: string;
  DateCreated: string;
  SubmissionStatus: {
    ID: number;
    Title: string;
    IsLive: boolean;
  };
  UserComments?: string;
  PercentageSimilarity?: number;
  MediaItems?: Array<any>;
  IsRecentlyVerified: boolean;
  DateLastVerified?: string;
  DistanceUnit?: number;
  Distance?: number;
}

export interface ChargingStationSearchParams {
  latitude: number;
  longitude: number;
  distance?: number; // km
  maxResults?: number;
  operatorId?: number;
  connectionTypeId?: number;
  levelId?: number;
  usageTypeId?: number;
  statusTypeId?: number;
  includeComments?: boolean;
  compact?: boolean;
}

class ChargingStationService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = OPEN_CHARGE_MAP_API_KEY;
    this.baseUrl = BASE_URL;
  }

  /**
   * 🔄 Rate limiting ve retry logic ile API çağrısı
   */
  private async makeAPICallWithRetry(url: string, maxRetries: number = 3): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get(url, {
          timeout: 15000, // 15 saniye timeout
        });
        return response;
      } catch (error: any) {
        if (error.response?.status === 429) {
          // Rate limiting error - exponential backoff
          const delayMs = Math.min(1000 * Math.pow(2, attempt), 8000); // Max 8 saniye
          console.warn(`⏳ Rate limited, waiting ${delayMs}ms before retry ${attempt}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          
          if (attempt === maxRetries) {
            console.error('❌ Max retries reached for rate limiting');
            throw error;
          }
        } else {
          // Diğer error'lar için hemen throw et
          throw error;
        }
      }
    }
  }

  /**
   * Belirli koordinatlarda şarj istasyonlarını arar
   */
  async searchChargingStations(params: ChargingStationSearchParams): Promise<ChargingStation[]> {
    try {
      const searchParams = new URLSearchParams({
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

      // Rate limiting için delay ekle
      await new Promise(resolve => setTimeout(resolve, 800)); // 800ms delay
      
      // Retry logic ile API çağrısı
      const response = await this.makeAPICallWithRetry(`${this.baseUrl}/poi/?${searchParams.toString()}`);
      
      console.log(`🔌 Found ${response.data.length} charging stations`);
      
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching charging stations:', error);
      throw error;
    }
  }

  /**
   * 🧠 Adaptif yarıçapla şarj istasyonu arama (15km → 25km → 35km)
   */
  private async searchWithAdaptiveRadius(
    latitude: number, 
    longitude: number
  ): Promise<ChargingStation[]> {
    const radiusList = [15, 25, 35]; // km
    
    for (const radius of radiusList) {
      try {
        console.log(`🔍 Trying radius ${radius}km for point (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`);
        const stations = await this.searchChargingStations({
          latitude: latitude,
          longitude: longitude,
          distance: radius,
          maxResults: 10,
          statusTypeId: 50, // Operational only
          compact: true
        });
        
        if (stations.length > 0) {
          console.log(`✅ Found ${stations.length} stations at ${radius}km radius`);
          return stations;
        }
        
        console.log(`❌ No stations found at ${radius}km radius`);
      } catch (error) {
        console.warn(`🔌 Error at ${radius}km radius:`, error);
      }
    }
    
    console.log(`🚫 No stations found at any radius for point (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`);
    return [];
  }

  /**
   * 🎯 Polyline'a en yakın istasyonları filtreler
   */
  private filterNearestToRoute(
    stations: ChargingStation[],
    routePoints: Array<{ latitude: number; longitude: number }>,
    maxDistanceKm: number = 10
  ): ChargingStation[] {
    return stations.filter(station => {
      if (!station.AddressInfo?.Latitude || !station.AddressInfo?.Longitude) return false;
      
      // En yakın polyline noktasına olan mesafeyi bul
      let minDistance = Infinity;
      for (const point of routePoints) {
        const distance = this.calculateDistance(
          station.AddressInfo.Latitude,
          station.AddressInfo.Longitude,
          point.latitude,
          point.longitude
        );
        minDistance = Math.min(minDistance, distance);
      }
      
      return minDistance <= maxDistanceKm;
    });
  }

  /**
   * 📏 İki koordinat arası mesafe hesaplama (Haversine)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Dünya yarıçapı (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * 🔋 Güç seviyesine göre kategorileme
   */
  private categorizeByPower(stations: ChargingStation[]): {
    fast: ChargingStation[];     // 50kW+
    medium: ChargingStation[];   // 22-49kW
    slow: ChargingStation[];     // <22kW
  } {
    const fast: ChargingStation[] = [];
    const medium: ChargingStation[] = [];
    const slow: ChargingStation[] = [];

    stations.forEach(station => {
      const powerKW = station.Connections?.[0]?.PowerKW || 0;
      if (powerKW >= 50) {
        fast.push(station);
      } else if (powerKW >= 22) {
        medium.push(station);
      } else {
        slow.push(station);
      }
    });

    return { fast, medium, slow };
  }

  /**
   * 🚗 Batarya kapasitesine göre akıllı durak seçimi
   */
  private selectOptimalStops(
    stations: ChargingStation[],
    routePoints: Array<{ latitude: number; longitude: number }>,
    batteryRangeKm: number = 200
  ): ChargingStation[] {
    if (stations.length === 0) return [];

    // Güç seviyesine göre kategorile
    const { fast, medium, slow } = this.categorizeByPower(stations);
    
    console.log(`🔋 Power categories: Fast(${fast.length}), Medium(${medium.length}), Slow(${slow.length})`);

    // Öncelik sırası: Hızlı -> Orta -> Yavaş
    const prioritizedStations = [...fast, ...medium, ...slow];
    
    // Rota boyunca her 150km'de bir durak seç (güvenlik marjı)
    const stopIntervalKm = batteryRangeKm * 0.75; // %75 güvenlik marjı
    const totalRouteKm = this.estimateRouteDistance(routePoints);
    const numberOfStops = Math.ceil(totalRouteKm / stopIntervalKm);
    
    console.log(`🛣️ Route distance: ${totalRouteKm.toFixed(1)}km, Need ${numberOfStops} stops every ${stopIntervalKm}km`);

    const selectedStops: ChargingStation[] = [];
    const routeSegmentSize = routePoints.length / numberOfStops;

    for (let i = 0; i < numberOfStops; i++) {
      const segmentStart = Math.floor(i * routeSegmentSize);
      const segmentEnd = Math.floor((i + 1) * routeSegmentSize);
      const segmentPoints = routePoints.slice(segmentStart, segmentEnd);

      if (segmentPoints.length === 0) continue;

      // Bu segment için en uygun istasyonu bul
      const nearbyStations = prioritizedStations.filter(station => {
        if (!station.AddressInfo?.Latitude || !station.AddressInfo?.Longitude) return false;
        
        let minDistance = Infinity;
        for (const point of segmentPoints) {
          const distance = this.calculateDistance(
            station.AddressInfo.Latitude,
            station.AddressInfo.Longitude,
            point.latitude,
            point.longitude
          );
          minDistance = Math.min(minDistance, distance);
        }
        return minDistance <= 15; // 15km içinde
      });

      if (nearbyStations.length > 0) {
        // En yüksek güce sahip olanı seç
        const bestStation = nearbyStations.reduce((best, current) => {
          const bestPower = best.Connections?.[0]?.PowerKW || 0;
          const currentPower = current.Connections?.[0]?.PowerKW || 0;
          return currentPower > bestPower ? current : best;
        });
        
        selectedStops.push(bestStation);
        console.log(`⚡ Selected stop ${i + 1}: ${bestStation.AddressInfo?.Title} (${bestStation.Connections?.[0]?.PowerKW || 0}kW)`);
      }
    }

    return selectedStops;
  }

  /**
   * 📐 Rota uzunluğunu tahmin et
   */
  private estimateRouteDistance(routePoints: Array<{ latitude: number; longitude: number }>): number {
    let totalDistance = 0;
    for (let i = 1; i < routePoints.length; i++) {
      totalDistance += this.calculateDistance(
        routePoints[i-1].latitude,
        routePoints[i-1].longitude,
        routePoints[i].latitude,
        routePoints[i].longitude
      );
    }
    return totalDistance;
  }

  /**
   * 🧹 Gelişmiş duplicate filtreleme
   */
  private removeDuplicatesAdvanced(stations: ChargingStation[]): ChargingStation[] {
    const uniqueStations: ChargingStation[] = [];
    const seenIds = new Set<number>();
    const seenCoordinates = new Set<string>();
    const seenNames = new Set<string>();

    for (const station of stations) {
      // 1. ID bazlı kontrol
      if (seenIds.has(station.ID)) continue;
      
      // 2. Koordinat bazlı kontrol (100m yarıçap)
      if (station.AddressInfo?.Latitude && station.AddressInfo?.Longitude) {
        const coordKey = `${station.AddressInfo.Latitude.toFixed(3)},${station.AddressInfo.Longitude.toFixed(3)}`;
        if (seenCoordinates.has(coordKey)) continue;
        seenCoordinates.add(coordKey);
      }

      // 3. İsim benzerliği kontrolü
      const normalizedName = station.AddressInfo?.Title?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
      if (normalizedName && seenNames.has(normalizedName)) continue;
      if (normalizedName) seenNames.add(normalizedName);

      seenIds.add(station.ID);
      uniqueStations.push(station);
    }

    console.log(`🧹 Removed ${stations.length - uniqueStations.length} duplicates (${stations.length} → ${uniqueStations.length})`);
    return uniqueStations;
  }

  /**
   * Rota üzerindeki şarj istasyonlarını bulur - Tam Optimizasyonlu Algoritma
   */
  async findChargingStationsAlongRoute(
    routePoints: Array<{ latitude: number; longitude: number }>,
    searchRadius: number = 15,
    batteryRangeKm: number = 200,
    preferredConnectorType?: string
  ): Promise<ChargingStation[]> {
    try {
      console.log('🔌 Finding charging stations along route with advanced optimization...');
      
      // 🆕 20 arama noktası kullan
      const searchPoints = getChargingSearchPoints(routePoints, 12); // Performance için optimize edildi
      
      const allStations: ChargingStation[] = [];
      const stationIds = new Set<number>();

      console.log(`🎯 Searching at ${searchPoints.length} points along route`);

      // 1. Ham verileri topla
      for (let i = 0; i < searchPoints.length; i++) {
        const point = searchPoints[i];
        // Performance: Sadece her 3. arama noktasını logla
        if (i % 3 === 0) {
          console.log(`🔍 Search point ${i + 1}/${searchPoints.length}: (${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)})`);
        }
        
        try {
          const stations = await this.searchWithAdaptiveRadius(point.latitude, point.longitude);
          
          if (stations.length > 0) {
            for (const station of stations) {
              if (!stationIds.has(station.ID)) {
                stationIds.add(station.ID);
                allStations.push(station);
              }
            }
            // Performance: Sadece önemli durumlarda logla
            if (stations.length > 0 && i % 3 === 0) {
              console.log(`➕ Added ${stations.length} new stations from point ${i + 1} (${allStations.length} total)`);
            }
          }
        } catch (error) {
          console.warn(`🔌 Failed to fetch stations for point ${i + 1}:`, error);
        }
      }

      console.log(`📊 Raw stations found: ${allStations.length}`);

      // 2. Gelişmiş filtreleme
      const uniqueStations = this.removeDuplicatesAdvanced(allStations);
      
      // 3. Polyline'a yakın olanları seç
      const nearbyStations = this.filterNearestToRoute(uniqueStations, routePoints, 10);
      console.log(`📍 Stations within 10km of route: ${nearbyStations.length}`);

      // 4. Connector type'a göre filtrele (opsiyonel)
      let filteredStations = nearbyStations;
      if (preferredConnectorType) {
        filteredStations = this.filterByConnectorType(nearbyStations, preferredConnectorType);
        console.log(`🔌 Stations matching connector type ${preferredConnectorType}: ${filteredStations.length}`);
      }

      // 5. Akıllı durak seçimi
      const optimalStops = this.selectOptimalStops(filteredStations, routePoints, batteryRangeKm);
      console.log(`⚡ Optimal charging stops selected: ${optimalStops.length}`);

      // 6. Güç seviyesine göre sırala (hızlı şarj önce)
      const sortedStations = filteredStations.sort((a, b) => {
        const powerA = a.Connections?.[0]?.PowerKW || 0;
        const powerB = b.Connections?.[0]?.PowerKW || 0;
        return powerB - powerA; // Yüksek güçten düşük güce
      });

      console.log(`🔌 Final optimized stations: ${sortedStations.length}`);
      console.log(`🏆 Top 3 fast chargers: ${sortedStations.slice(0, 3).map(s => `${s.AddressInfo?.Title} (${s.Connections?.[0]?.PowerKW || 0}kW)`).join(', ')}`);
      
      return sortedStations;
    } catch (error) {
      console.error('❌ Error finding charging stations along route:', error);
      throw error;
    }
  }

  /**
   * Connector type'a göre filtreler
   */
  private filterByConnectorType(
    stations: ChargingStation[],
    connectorType: string
  ): ChargingStation[] {
    return stations.filter(station => {
      if (!station.Connections || station.Connections.length === 0) {
        return false;
      }

      return station.Connections.some(connection => {
        const connectionTitle = connection.ConnectionType?.Title || '';
        const formalName = connection.ConnectionType?.FormalName || '';
        
        // Connector type mapping
        if (connectorType === 'CCS') {
          return connectionTitle.toLowerCase().includes('ccs') || 
                 formalName.toLowerCase().includes('combined charging system');
        } else if (connectorType === 'Type2') {
          return connectionTitle.toLowerCase().includes('type 2') || 
                 connectionTitle.toLowerCase().includes('type2');
        } else if (connectorType === 'CHAdeMO') {
          return connectionTitle.toLowerCase().includes('chademo');
        }
        
        return false;
      });
    });
  }

  /**
   * Rota üzerinde arama noktalarını seçer
   */
  private selectSearchPointsAlongRoute(
    routePoints: Array<{ latitude: number; longitude: number }>,
    numberOfPoints: number
  ): Array<{ latitude: number; longitude: number }> {
    if (routePoints.length <= numberOfPoints) {
      return routePoints;
    }

    const selectedPoints: Array<{ latitude: number; longitude: number }> = [];
    const step = Math.floor(routePoints.length / numberOfPoints);

    for (let i = 0; i < numberOfPoints; i++) {
      const index = i * step;
      if (index < routePoints.length) {
        selectedPoints.push(routePoints[index]);
      }
    }

    // Son noktayı ekle
    if (selectedPoints[selectedPoints.length - 1] !== routePoints[routePoints.length - 1]) {
      selectedPoints[selectedPoints.length - 1] = routePoints[routePoints.length - 1];
    }

    return selectedPoints;
  }

  /**
   * Şarj istasyonu tiplerini getirir
   */
  async getConnectionTypes() {
    try {
      const response = await axios.get(`${this.baseUrl}/connectiontypes/?output=json`);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching connection types:', error);
      throw error;
    }
  }

  /**
   * Operatörleri getirir
   */
  async getOperators() {
    try {
      const response = await axios.get(`${this.baseUrl}/operators/?output=json`);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching operators:', error);
      throw error;
    }
  }

  /**
   * Mock şarj istasyonları (test için)
   */
  getMockChargingStations(latitude: number, longitude: number): ChargingStation[] {
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
  }
}

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
export function getChargingSearchPoints(
  polylinePoints: { latitude: number; longitude: number }[],
  desiredCount: number
): { latitude: number; longitude: number }[] {
  console.log(`🧭 Creating ${desiredCount} search points from ${polylinePoints.length} route points`);
  
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

  const searchPoints: { latitude: number; longitude: number }[] = [];
  const step = polylinePoints.length / desiredCount;

  for (let i = 0; i < desiredCount; i++) {
    const index = Math.floor(i * step);
    const point = polylinePoints[index];
    searchPoints.push(point);
    
    console.log(`📍 Search point ${i + 1}: lat=${point.latitude.toFixed(5)}, lng=${point.longitude.toFixed(5)} (index: ${index})`);
  }

  console.log(`✅ Created ${searchPoints.length} evenly distributed search points`);
  return searchPoints;
}

export const chargingStationService = new ChargingStationService();
export default chargingStationService; 