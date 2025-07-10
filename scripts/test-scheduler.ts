/**
 * Test Job Scheduler
 * Run with: npx tsx scripts/test-scheduler.ts
 */

import { jobScheduler } from '@/services/server/jobs/jobScheduler';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testScheduler() {
  console.log('🧪 Testing Job Scheduler...\n');

  try {
    // Initialize scheduler
    console.log('1️⃣ Initializing scheduler...');
    await jobScheduler.initialize();
    console.log('✅ Scheduler initialized');

    // Get queue statistics
    console.log('\n2️⃣ Getting queue statistics...');
    const stats = await jobScheduler.getQueueStats();
    console.log('Queue stats:', stats);

    // Trigger immediate job
    console.log('\n3️⃣ Triggering immediate news collection...');
    const job = await jobScheduler.triggerNewsCollection(['technology', 'business'], true);
    console.log(`✅ Job triggered with ID: ${job.id}`);

    // Wait for job to complete
    console.log('\n4️⃣ Waiting for job to complete...');
    let completed = false;
    let result: any;

    // Set up listener for job completion
    const checkJob = setInterval(async () => {
      const state = await job.getState();
      console.log(`   Job state: ${state}`);
      
      if (state === 'completed' || state === 'failed') {
        completed = true;
        clearInterval(checkJob);
        
        if (state === 'completed') {
          console.log('✅ Job completed successfully');
        } else {
          console.log('❌ Job failed');
        }
      }
    }, 2000);

    // Wait for completion (max 2 minutes)
    let waited = 0;
    while (!completed && waited < 120000) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      waited += 1000;
    }

    if (!completed) {
      console.log('⏱️ Job timed out');
      clearInterval(checkJob);
    }

    // Get final statistics
    console.log('\n5️⃣ Final statistics:');
    const finalStats = await jobScheduler.getQueueStats();
    console.log('Queue stats:', finalStats);

    // Cleanup
    console.log('\n6️⃣ Cleaning up...');
    await jobScheduler.shutdown();
    console.log('✅ Scheduler shut down');

    console.log('\n✨ All tests completed!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    await jobScheduler.shutdown();
    process.exit(1);
  }
}

// Run the test
testScheduler();