import { scheduleRecurringJobs } from './jobs/queue';
import './jobs/worker'; // Import to register job processors
import { prisma } from './database/prisma';
import { getRedisClient } from './cache';
import { isMockMode } from '@/lib/env';
import { supabase } from '@/lib/supabase';

let initialized = false;

export async function initializeServices() {
  if (initialized) {
    return;
  }

  try {
    console.log('Initializing services...');

    if (isMockMode) {
      console.log('✓ Running in Mock Mode - Database/Redis not required');
      initialized = true;
      return;
    }

    // Test database connection
    await prisma.$connect();
    console.log('✓ Database connected');

    // Test Supabase connection
    const { data: supabaseTest, error: supabaseError } = await supabase
      .from('Article')
      .select('id')
      .limit(1);
    
    if (supabaseError && supabaseError.code !== 'PGRST116') {
      // PGRST116 is "no rows found" which is fine
      throw new Error(`Supabase connection failed: ${supabaseError.message}`);
    }
    console.log('✓ Supabase connected');

    // Test Redis connection (optional - falls back to Supabase cache)
    try {
      const redisClient = await getRedisClient();
      if (redisClient) {
        console.log('✓ Redis connected');
      }
    } catch (error) {
      console.log('ℹ️  Redis not available, using Supabase cache');
    }

    // Schedule recurring jobs
    await scheduleRecurringJobs();
    console.log('✓ Recurring jobs scheduled');

    // Initialize Supabase Storage buckets
    await initializeStorageBuckets();

    // Initialize news sources if none exist
    const sourceCount = await prisma.newsSource.count();
    if (sourceCount === 0) {
      console.log('Initializing default news sources...');
      await initializeDefaultSources();
    }

    initialized = true;
    console.log('✓ All services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    console.log('⚠️  Falling back to Mock Mode');
    initialized = true;
  }
}

async function initializeDefaultSources() {
  const defaultSources = [
    {
      name: 'BBC News',
      type: 'RSS',
      url: 'http://feeds.bbci.co.uk/news/rss.xml',
      category: 'general',
      updateInterval: 30,
    },
    {
      name: 'CNN Top Stories',
      type: 'RSS',
      url: 'http://rss.cnn.com/rss/cnn_topstories.rss',
      category: 'general',
      updateInterval: 30,
    },
    {
      name: 'TechCrunch',
      type: 'RSS',
      url: 'https://techcrunch.com/feed/',
      category: 'technology',
      updateInterval: 60,
    },
    {
      name: 'The Verge',
      type: 'RSS',
      url: 'https://www.theverge.com/rss/index.xml',
      category: 'technology',
      updateInterval: 60,
    },
    {
      name: 'Reuters Business',
      type: 'RSS',
      url: 'https://feeds.reuters.com/reuters/businessNews',
      category: 'business',
      updateInterval: 45,
    },
    {
      name: 'News API - Technology',
      type: 'API',
      url: 'https://newsapi.org/v2/top-headlines',
      category: 'technology',
      updateInterval: 120,
    },
  ];

  for (const source of defaultSources) {
    await prisma.newsSource.create({
      data: source,
    });
  }

  console.log(`✓ Created ${defaultSources.length} default news sources`);
}

async function initializeStorageBuckets() {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.warn('Could not list storage buckets:', error.message);
      return;
    }

    const existingBuckets = buckets?.map(b => b.name) || [];
    const requiredBuckets = ['audio-files', 'article-images'];

    for (const bucketName of requiredBuckets) {
      if (!existingBuckets.includes(bucketName)) {
        const { error: createError } = await supabase.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: bucketName === 'audio-files' ? 52428800 : 10485760, // 50MB for audio, 10MB for images
        });

        if (createError) {
          console.warn(`Could not create bucket ${bucketName}:`, createError.message);
        } else {
          console.log(`✓ Created storage bucket: ${bucketName}`);
        }
      }
    }

    console.log('✓ Storage buckets initialized');
  } catch (error) {
    console.warn('Storage bucket initialization skipped:', error);
  }
}

// Graceful shutdown
export async function shutdownServices() {
  console.log('Shutting down services...');
  
  try {
    await prisma.$disconnect();
    console.log('✓ Database disconnected');
  } catch (error) {
    console.error('Error disconnecting database:', error);
  }

  initialized = false;
}