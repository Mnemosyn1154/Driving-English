import { NextRequest, NextResponse } from 'next/server';
import { translator } from '@/services/server/translation/geminiTranslator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, texts, articleId, from = 'en', to = 'ko' } = body;

    // Validate input
    if (!text && !texts && !articleId) {
      return NextResponse.json(
        { error: 'Either text, texts array, or articleId is required' },
        { status: 400 }
      );
    }

    // Single text translation
    if (text) {
      const result = await translator.translateText(text, { from, to });
      return NextResponse.json({
        success: true,
        translation: result.translatedText,
        cached: result.cached,
      });
    }

    // Batch translation
    if (texts && Array.isArray(texts)) {
      const results = await translator.translateBatch(texts, { from, to });
      return NextResponse.json({
        success: true,
        translations: results.map(r => ({
          text: r.translatedText,
          cached: r.cached,
        })),
      });
    }

    // Article translation
    if (articleId) {
      const result = await translator.translateArticle(articleId);
      return NextResponse.json({
        success: true,
        article: result,
      });
    }

  } catch (error: any) {
    console.error('Translation API error:', error);
    
    if (error.message?.includes('API key')) {
      return NextResponse.json(
        { error: 'Google Cloud Translation API is not configured properly' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Translation failed', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get translation statistics
    const stats = await translator.getStatistics();
    
    return NextResponse.json({
      success: true,
      statistics: stats,
    });
  } catch (error: any) {
    console.error('Statistics error:', error);
    return NextResponse.json(
      { error: 'Failed to get statistics', details: error.message },
      { status: 500 }
    );
  }
}