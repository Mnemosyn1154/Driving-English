import { NextRequest, NextResponse } from 'next/server';
import { GeminiTranslator } from '@/services/server/translation/geminiTranslator';
import { TextToSpeechService } from '@/services/server/tts/textToSpeech';
import { Article } from '@/types/news';

const translator = new GeminiTranslator();
const ttsService = new TextToSpeechService();

export async function POST(request: NextRequest) {
  try {
    const article: Article = await request.json();
    
    if (!article.id || !article.sentences) {
      return NextResponse.json(
        { error: 'Invalid article format' },
        { status: 400 }
      );
    }

    // Step 1: Translate article
    const translations = await translator.translateArticleWithConsistency(
      article.title,
      article.summary,
      article.sentences.map(s => s.text)
    );

    // Update article with translations
    article.titleTranslation = translations.title;
    article.summaryTranslation = translations.summary;
    article.sentences.forEach((sentence, index) => {
      sentence.translation = translations.sentences[index];
    });

    // Step 2: Generate audio for each sentence
    const audioPromises = article.sentences.map(async (sentence) => {
      const [englishAudio, koreanAudio] = await Promise.all([
        ttsService.synthesize({
          id: `${sentence.id}_en`,
          text: sentence.text,
          language: 'en',
          speed: 0.9, // Slower for learners
          ssml: true,
        }),
        ttsService.synthesize({
          id: `${sentence.id}_ko`,
          text: sentence.translation!,
          language: 'ko',
          ssml: true,
        }),
      ]);

      return {
        sentenceId: sentence.id,
        english: englishAudio.audioUrl,
        korean: koreanAudio.audioUrl,
      };
    });

    const audioResults = await Promise.all(audioPromises);

    // Update sentences with audio URLs
    article.sentences.forEach((sentence) => {
      const audio = audioResults.find(a => a.sentenceId === sentence.id);
      if (audio) {
        sentence.audioUrl = {
          english: audio.english,
          korean: audio.korean,
        };
      }
    });

    // Mark as processed
    article.isProcessed = true;
    article.processedAt = new Date();

    return NextResponse.json({
      message: 'Article processed successfully',
      article,
      stats: {
        sentencesTranslated: article.sentences.length,
        audioFilesGenerated: audioResults.length * 2,
      },
    });
  } catch (error: any) {
    console.error('Article processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process article', details: error.message },
      { status: 500 }
    );
  }
}