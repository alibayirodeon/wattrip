console.log('--- DEMO BAŞLIYOR ---');

const { demoSlopeBasedConsumption } = require('./src/utils/routePlanningDemo');

// Google Elevation API anahtarınızı buraya girin:
const API_KEY = process.env.GOOGLE_API_KEY || ' AIzaSyC1RCUy97Gu_yFZuCSi9lFP2Utv3pm75Mc';

(async () => {
  try {
    await demoSlopeBasedConsumption(API_KEY);
    console.log('Demo tamamlandı.');
  } catch (err) {
    console.error('Hata:', err);
  }
  console.log('--- DEMO BİTTİ ---');
})(); 