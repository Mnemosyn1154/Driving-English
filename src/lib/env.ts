// Environment mode helpers
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';
export const isTest = process.env.NODE_ENV === 'test';

// Check if we're in mock mode (when database is not configured)
export const isMockMode = !process.env.DATABASE_URL || process.env.USE_MOCK === 'true';

// Centralized configuration object
export const config = {
  // Environment
  env: {
    nodeEnv: process.env.NODE_ENV || 'development',
    isDevelopment,
    isProduction,
    isTest,
    isMockMode,
  },
  
  // Database
  database: {
    url: process.env.DATABASE_URL,
  },
  
  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  // API Keys
  api: {
    newsApiKey: process.env.NEWS_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    googleCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  },
  
  // Authentication
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-key',
    skipAuth: process.env.NEXT_PUBLIC_SKIP_AUTH === 'true',
  },
  
  // Supabase
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  
  // Server
  server: {
    port: process.env.PORT || '3000',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  },
  
  // Feature Flags
  features: {
    enableServiceWorker: process.env.NEXT_PUBLIC_ENABLE_SW === 'true',
    enableAnalytics: process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT ? true : false,
    analyticsEndpoint: process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT,
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