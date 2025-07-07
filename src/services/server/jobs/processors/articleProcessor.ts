import { Job } from 'bull';
import { ProcessArticleJobData, updateJobStatus, createJobRecord, JobType, audioQueue } from '../queue';
import { prisma } from '../../database/prisma';
import { GeminiTranslator } from '../../translation/geminiTranslator';
import { TTSService } from '../../tts/ttsService';
import { cacheSet, cacheGet } from '../../cache';

export async function processArticleJob(job: Job<ProcessArticleJobData>) {
  const { articleId, priority } = job.data;
  const jobRecordId = await createJobRecord(JobType.PROCESS_ARTICLE, job.data);
  
  try {
    await updateJobStatus(jobRecordId, 'RUNNING');
    console.log(`Processing article: ${articleId}`);

    // Get article with sentences
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      include: {
        sentences: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!article) {
      throw new Error(`Article ${articleId} not found`);
    }

    if (article.isProcessed) {
      console.log(`Article ${articleId} already processed`);
      await updateJobStatus(jobRecordId, 'SUCCESS');
      return;
    }

    // Initialize services
    const translator = new GeminiTranslator();
    const tts = new TTSService();

    try {
      // Translate article with context
      const sentences = article.sentences.map(s => s.text);
      const translations = await translator.translateArticleWithConsistency(
        article.title,
        article.summary,
        sentences
      );

      // Update article with translations
      await prisma.article.update({
        where: { id: articleId },
        data: {
          titleKo: translations.title,
          summaryKo: translations.summary,
        },
      });

      // Update sentences with translations
      for (let i = 0; i < article.sentences.length; i++) {
        const sentence = article.sentences[i];
        const translation = translations.sentences[i];

        await prisma.sentence.update({
          where: { id: sentence.id },
          data: { translation },
        });

        // Cache translation
        const cacheKey = `translation:${sentence.id}`;
        await cacheSet(cacheKey, translation, 3600 * 24 * 7); // 7 days
      }

      // Queue audio generation in batches
      const batchSize = 5;
      for (let i = 0; i < article.sentences.length; i += batchSize) {
        const sentenceIndices = [];
        for (let j = i; j < Math.min(i + batchSize, article.sentences.length); j++) {
          sentenceIndices.push(j);
        }

        await audioQueue.add('generate-audio', {
          articleId,
          sentences: sentenceIndices,
        }, {
          priority: priority ? 1 : 10, // Higher priority = lower number
          delay: i * 1000, // Stagger by 1 second per batch
        });
      }

      // Generate full article audio (English and Korean)
      const fullTextEn = `${article.title}. ${article.summary}. ${sentences.join(' ')}`;
      const fullTextKo = `${translations.title}. ${translations.summary}. ${translations.sentences.join(' ')}`;

      // Generate audio with caching
      const audioUrlEn = await generateAndCacheAudio(tts, fullTextEn, 'en-US', `article:${articleId}:en`);
      const audioUrlKo = await generateAndCacheAudio(tts, fullTextKo, 'ko-KR', `article:${articleId}:ko`);

      // Calculate audio duration (estimate: 150 words per minute)
      const wordsEn = fullTextEn.split(/\s+/).length;
      const audioDuration = Math.ceil((wordsEn / 150) * 60);

      // Update article as processed
      await prisma.article.update({
        where: { id: articleId },
        data: {
          isProcessed: true,
          processedAt: new Date(),
          audioUrlEn,
          audioUrlKo,
          audioDuration,
        },
      });

      // Cache processed article data
      const processedData = {
        id: articleId,
        title: article.title,
        titleKo: translations.title,
        summary: article.summary,
        summaryKo: translations.summary,
        audioUrlEn,
        audioUrlKo,
        audioDuration,
        difficulty: article.difficulty,
        category: article.category,
      };

      await cacheSet(
        `article:${articleId}:processed`,
        JSON.stringify(processedData),
        3600 * 24 * 3 // 3 days
      );

      console.log(`Successfully processed article: ${articleId}`);
      await updateJobStatus(jobRecordId, 'SUCCESS');

    } catch (error) {
      // Update article with error
      await prisma.article.update({
        where: { id: articleId },
        data: {
          processingError: (error as Error).message,
        },
      });
      throw error;
    }

  } catch (error) {
    console.error(`Article processing failed for ${articleId}:`, error);
    await updateJobStatus(jobRecordId, 'FAILED', (error as Error).message);
    throw error;
  }
}

async function generateAndCacheAudio(
  tts: TTSService,
  text: string,
  language: string,
  cacheKey: string
): Promise<string> {
  // Check cache first
  const cached = await cacheGet(`audio:url:${cacheKey}`);
  if (cached) {
    return cached;
  }

  // Generate audio
  const audioUrl = await tts.generateAudio(text, {
    languageCode: language,
    speakingRate: language === 'ko-KR' ? 0.9 : 1.0, // Slightly slower for Korean
  });

  // Cache the URL
  await cacheSet(`audio:url:${cacheKey}`, audioUrl, 3600 * 24 * 7); // 7 days

  return audioUrl;
}