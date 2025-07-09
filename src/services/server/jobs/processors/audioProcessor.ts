import { Job } from 'bull';
import { PregenerateAudioJobData, updateJobStatus, createJobRecord, JobType } from '../queue';
import { prisma } from '../../database/prisma';
import { TTSService } from '../../tts/ttsService';
import { cacheSet, cacheGet } from '../../cache';

export async function processAudioGenerationJob(job: Job<PregenerateAudioJobData>) {
  const { articleId, sentences: sentenceIndices } = job.data;
  const jobRecordId = await createJobRecord(JobType.PREGENERATE_AUDIO, job.data);
  
  try {
    await updateJobStatus(jobRecordId, 'RUNNING');
    console.log(`Generating audio for article ${articleId}, sentences: ${sentenceIndices?.join(', ') || 'all'}`);

    // Get article sentences
    const sentences = await prisma.sentence.findMany({
      where: {
        articleId,
        ...(sentenceIndices && {
          order: { in: sentenceIndices },
        }),
      },
      orderBy: { order: 'asc' },
    });

    if (sentences.length === 0) {
      console.log('No sentences found for audio generation');
      await updateJobStatus(jobRecordId, 'SUCCESS');
      return;
    }

    const tts = new TTSService();
    let successCount = 0;
    let errorCount = 0;

    // Process each sentence
    for (const sentence of sentences) {
      try {
        // Skip if already has audio
        if (sentence.audioUrlEn && sentence.audioUrlKo) {
          console.log(`Sentence ${sentence.id} already has audio`);
          continue;
        }

        // Generate English audio if needed
        if (!sentence.audioUrlEn) {
          const cacheKey = `sentence:${sentence.id}:audio:en`;
          const cached = await cacheGet(`audio:url:${cacheKey}`);
          
          let audioUrlEn: string;
          if (cached) {
            audioUrlEn = cached;
          } else {
            // Add SSML for better pronunciation
            const ssmlText = await tts.createSSML(sentence.text, {
              language: 'en-US',
              emphasis: detectEmphasisWords(sentence.text),
            });

            audioUrlEn = await tts.generateAudio(ssmlText, {
              languageCode: 'en-US',
              speakingRate: 0.9, // Slightly slower for learning
              pitch: 0,
            });

            // Cache the URL
            await cacheSet(`audio:url:${cacheKey}`, audioUrlEn, 3600 * 24 * 7);
          }

          await prisma.sentence.update({
            where: { id: sentence.id },
            data: { audioUrlEn },
          });
        }

        // Generate Korean audio if translation exists
        if (sentence.translation && !sentence.audioUrlKo) {
          const cacheKey = `sentence:${sentence.id}:audio:ko`;
          const cached = await cacheGet(`audio:url:${cacheKey}`);
          
          let audioUrlKo: string;
          if (cached) {
            audioUrlKo = cached;
          } else {
            audioUrlKo = await tts.generateAudio(sentence.translation, {
              languageCode: 'ko-KR',
              speakingRate: 0.85, // Even slower for clear pronunciation
              pitch: 0,
            });

            // Cache the URL
            await cacheSet(`audio:url:${cacheKey}`, audioUrlKo, 3600 * 24 * 7);
          }

          await prisma.sentence.update({
            where: { id: sentence.id },
            data: { audioUrlKo },
          });
        }

        successCount++;

        // Rate limiting - wait between requests
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`Error generating audio for sentence ${sentence.id}:`, error);
        errorCount++;
        
        // Continue with other sentences
        continue;
      }
    }

    // Update cache entry metadata
    await prisma.cacheEntry.upsert({
      where: { key: `article:${articleId}:audio:meta` },
      create: {
        key: `article:${articleId}:audio:meta`,
        type: 'AUDIO',
        size: sentences.length * 50000, // Estimated 50KB per audio file
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
      update: {
        hits: { increment: 1 },
        lastAccessed: new Date(),
      },
    });

    console.log(`Audio generation completed: ${successCount} success, ${errorCount} errors`);
    await updateJobStatus(jobRecordId, 'SUCCESS');

  } catch (error) {
    console.error(`Audio generation job failed for article ${articleId}:`, error);
    await updateJobStatus(jobRecordId, 'FAILED', (error as Error).message);
    throw error;
  }
}

// Helper function to detect words that should be emphasized
function detectEmphasisWords(text: string): string[] {
  const emphasisPatterns = [
    /\b(?:very|extremely|absolutely|definitely|certainly)\b/gi,
    /\b(?:important|critical|essential|vital|crucial)\b/gi,
    /\b(?:never|always|must|should)\b/gi,
  ];

  const words: string[] = [];
  for (const pattern of emphasisPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      words.push(...matches);
    }
  }

  return [...new Set(words)]; // Remove duplicates
}