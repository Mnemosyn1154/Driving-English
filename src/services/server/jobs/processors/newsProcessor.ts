import { Job } from 'bull';
import { FetchNewsJobData, updateJobStatus, createJobRecord, JobType, processingQueue } from '../queue';
import { prisma } from '../../database/prisma';
import { NewsFetcher } from '../../news/fetcher';
import { NewsParser } from '../../news/parser';
import { cacheSet } from '../../cache';

export async function processNewsFetchJob(job: Job<FetchNewsJobData>) {
  const { sourceId, category } = job.data;
  const jobRecordId = await createJobRecord(JobType.FETCH_NEWS, job.data);
  
  try {
    await updateJobStatus(jobRecordId, 'RUNNING');
    console.log(`Processing news fetch job: ${job.id}`);

    // Get sources to fetch
    const sources = await prisma.newsSource.findMany({
      where: {
        enabled: true,
        ...(sourceId && { id: sourceId }),
        ...(category && { category }),
      },
    });

    if (sources.length === 0) {
      console.log('No enabled sources found');
      await updateJobStatus(jobRecordId, 'SUCCESS');
      return;
    }

    const fetcher = new NewsFetcher();
    const parser = new NewsParser();
    let totalArticles = 0;

    for (const source of sources) {
      try {
        // Check if update is needed
        const needsUpdate = await fetcher.checkNeedsUpdate(source.url, {
          id: source.id,
          name: source.name,
          type: source.type as 'RSS' | 'API',
          url: source.url,
          category: source.category,
          updateInterval: source.updateInterval,
          lastFetch: source.lastFetch || undefined,
        });

        if (!needsUpdate) {
          console.log(`Source ${source.name} doesn't need update`);
          continue;
        }

        // Fetch articles
        const articles = source.type === 'RSS'
          ? await fetcher.fetchFromRSS(source.url, source.category)
          : await fetcher.fetchFromNewsAPI(source.category, 20);

        // Parse and save articles
        for (const article of articles) {
          try {
            // Check if article already exists
            const exists = await prisma.article.findUnique({
              where: { url: article.url },
            });

            if (exists) {
              continue;
            }

            // Parse article content
            const parsed = parser.parseArticle(article);
            const difficulty = parser.calculateDifficulty(parsed.content);

            // Calculate word count and reading time
            const wordCount = parsed.content.split(/\s+/).length;
            const readingTime = Math.ceil(wordCount / 200) * 60; // 200 WPM average

            // Save article
            const savedArticle = await prisma.article.create({
              data: {
                sourceId: source.id,
                title: parsed.title,
                summary: parsed.summary,
                content: parsed.content,
                url: article.url,
                imageUrl: article.imageUrl,
                publishedAt: new Date(article.publishedAt),
                difficulty,
                wordCount,
                readingTime,
                category: article.category,
                tags: article.tags || [],
              },
            });

            // Parse sentences
            const sentences = parser.splitIntoSentences(parsed.content);
            
            // Save sentences
            for (let i = 0; i < sentences.length; i++) {
              const sentence = sentences[i];
              const sentenceWordCount = sentence.split(/\s+/).length;
              const sentenceDifficulty = parser.calculateDifficulty(sentence);

              await prisma.sentence.create({
                data: {
                  articleId: savedArticle.id,
                  order: i,
                  text: sentence,
                  difficulty: sentenceDifficulty,
                  wordCount: sentenceWordCount,
                },
              });
            }

            totalArticles++;

            // Queue article for processing
            await processingQueue.add('process-article', {
              articleId: savedArticle.id,
              priority: difficulty <= 3, // Prioritize easier articles
            });

            // Cache article metadata
            await cacheSet(
              `article:${savedArticle.id}:meta`,
              JSON.stringify({
                title: savedArticle.title,
                difficulty,
                category: savedArticle.category,
                wordCount,
              }),
              3600 * 24 // 24 hours
            );

          } catch (error) {
            console.error(`Error processing article ${article.url}:`, error);
          }
        }

        // Update source last fetch time
        await prisma.newsSource.update({
          where: { id: source.id },
          data: { lastFetch: new Date() },
        });

      } catch (error) {
        console.error(`Error fetching from source ${source.name}:`, error);
      }
    }

    console.log(`Fetched ${totalArticles} new articles`);
    await updateJobStatus(jobRecordId, 'SUCCESS');

  } catch (error) {
    console.error('News fetch job failed:', error);
    await updateJobStatus(jobRecordId, 'FAILED', (error as Error).message);
    throw error;
  }
}

// Process pending articles
export async function processPendingArticles() {
  const pendingArticles = await prisma.article.findMany({
    where: {
      isProcessed: false,
      processingError: null,
    },
    orderBy: [
      { difficulty: 'asc' }, // Process easier articles first
      { publishedAt: 'desc' }, // Then by newest
    ],
    take: 10, // Process 10 at a time
  });

  for (const article of pendingArticles) {
    await processingQueue.add('process-article', {
      articleId: article.id,
    });
  }

  return pendingArticles.length;
}