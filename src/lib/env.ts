export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';

// Check if we're in mock mode (when database is not configured)
export const isMockMode = !process.env.DATABASE_URL || process.env.USE_MOCK === 'true';

export const config = {
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  api: {
    newsApiKey: process.env.NEWS_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    googleCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-key',
  },
};

// Log configuration status
if (typeof window === 'undefined') { // Only on server
  console.log('🔧 Environment Configuration:');
  console.log(`   Mode: ${isDevelopment ? 'Development' : 'Production'}`);
  console.log(`   Mock Mode: ${isMockMode ? 'Enabled' : 'Disabled'}`);
  console.log(`   Database: ${config.database.url ? 'Configured' : 'Not configured'}`);
  console.log(`   Redis: ${config.redis.url ? 'Configured' : 'Not configured'}`);
  console.log(`   APIs: ${config.api.newsApiKey ? '✓' : '✗'} News, ${config.api.geminiApiKey ? '✓' : '✗'} Gemini`);
}