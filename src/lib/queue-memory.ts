/**
 * In-Memory Queue Implementation
 * Fallback for development without Redis
 */

import { EventEmitter } from 'events';

interface Job<T = any> {
  id: string;
  name: string;
  data: T;
  opts: any;
  attemptsMade: number;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  progress: number;
}

class InMemoryQueue extends EventEmitter {
  private jobs: Map<string, Job> = new Map();
  private jobCounter: number = 0;
  private processors: Map<string, Function> = new Map();
  private isProcessing: boolean = false;
  private repeatableJobs: Map<string, any> = new Map();

  constructor(public name: string) {
    super();
  }

  async add(name: string, data: any, opts: any = {}): Promise<Job> {
    const job: Job = {
      id: `${++this.jobCounter}`,
      name,
      data,
      opts,
      attemptsMade: 0,
      timestamp: Date.now(),
      progress: 0,
    };

    this.jobs.set(job.id, job);

    // Handle repeatable jobs
    if (opts.repeat) {
      const key = `${name}:${opts.repeat.cron}`;
      this.repeatableJobs.set(key, {
        name,
        key,
        cron: opts.repeat.cron,
        next: Date.now() + 30 * 60 * 1000, // Next run in 30 minutes
      });
    }

    // Start processing
    setImmediate(() => this.processNext());

    // Add getState method to job
    const jobWithMethods = {
      ...job,
      getState: async () => {
        const currentJob = this.jobs.get(job.id);
        if (!currentJob) return 'unknown';
        if (currentJob.failedReason) return 'failed';
        if (currentJob.finishedOn) return 'completed';
        if (currentJob.processedOn) return 'active';
        return 'waiting';
      }
    };

    return jobWithMethods;
  }

  process(name: string, concurrency: number, processor: Function): void {
    this.processors.set(name, processor);
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const pendingJobs = Array.from(this.jobs.values()).filter(
      job => !job.processedOn && !job.finishedOn
    );

    for (const job of pendingJobs) {
      const processor = this.processors.get(job.name);
      if (!processor) continue;

      try {
        job.processedOn = Date.now();
        const jobWrapper = {
          ...job,
          progress: async (value: number) => {
            job.progress = value;
          },
          getState: async () => 'active',
        };

        const result = await processor(jobWrapper);
        job.finishedOn = Date.now();
        this.emit('completed', job, result);
      } catch (error) {
        job.attemptsMade++;
        job.failedReason = error.message;
        this.emit('failed', job, error);
      }
    }

    this.isProcessing = false;
  }

  async getJobCounts(): Promise<any> {
    const jobs = Array.from(this.jobs.values());
    return {
      waiting: jobs.filter(j => !j.processedOn).length,
      active: jobs.filter(j => j.processedOn && !j.finishedOn).length,
      completed: jobs.filter(j => j.finishedOn && !j.failedReason).length,
      failed: jobs.filter(j => j.failedReason).length,
      delayed: 0,
      paused: 0,
    };
  }

  async getRepeatableJobs(): Promise<any[]> {
    return Array.from(this.repeatableJobs.values());
  }

  async removeRepeatableByKey(key: string): Promise<void> {
    this.repeatableJobs.delete(key);
  }

  async getDelayed(): Promise<Job[]> {
    return [];
  }

  async clean(grace: number, type: string): Promise<void> {
    const cutoff = Date.now() - grace;
    const jobs = Array.from(this.jobs.values());
    
    jobs.forEach(job => {
      if (job.finishedOn && job.finishedOn < cutoff) {
        if ((type === 'completed' && !job.failedReason) ||
            (type === 'failed' && job.failedReason)) {
          this.jobs.delete(job.id);
        }
      }
    });
  }

  async close(): Promise<void> {
    this.removeAllListeners();
    this.jobs.clear();
    this.processors.clear();
  }

  on(event: string, listener: Function): this {
    super.on(event, listener);
    return this;
  }
}

// Create a Bull-compatible wrapper
export function createInMemoryQueue(name: string, config?: any): any {
  const queue = new InMemoryQueue(name);
  
  // Add Bull-compatible methods
  const wrapper = {
    add: queue.add.bind(queue),
    process: queue.process.bind(queue),
    on: queue.on.bind(queue),
    getJobCounts: queue.getJobCounts.bind(queue),
    getRepeatableJobs: queue.getRepeatableJobs.bind(queue),
    removeRepeatableByKey: queue.removeRepeatableByKey.bind(queue),
    getDelayed: queue.getDelayed.bind(queue),
    clean: queue.clean.bind(queue),
    close: queue.close.bind(queue),
  };

  return wrapper;
}