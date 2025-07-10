/**
 * Initialize Job Scheduler
 * Run with: npx tsx scripts/init-scheduler.ts
 */

import { jobScheduler } from '@/services/server/jobs/jobScheduler';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function initScheduler() {
  console.log('🚀 Initializing job scheduler...\n');

  try {
    // Initialize scheduler
    await jobScheduler.initialize();

    // Get initial status
    const stats = await jobScheduler.getQueueStats();
    console.log('\n📊 Queue Statistics:');
    console.log('News Queue:', stats.news);
    console.log('Processing Queue:', stats.processing);

    // Get scheduled jobs
    const scheduled = await jobScheduler.getScheduledJobs();
    console.log('\n⏰ Scheduled Jobs:');
    console.log('Recurring:', scheduled.recurring);
    console.log('Delayed:', scheduled.delayed.length);

    // Keep the process running
    console.log('\n✅ Scheduler is running. Press Ctrl+C to stop.');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down scheduler...');
      await jobScheduler.shutdown();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to initialize scheduler:', error);
    process.exit(1);
  }
}

// Run the initializer
initScheduler();