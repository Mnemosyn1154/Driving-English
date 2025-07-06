import { NextRequest, NextResponse } from 'next/server';
import { GeminiTranslator } from '@/services/server/translation/geminiTranslator';
import { TranslationRequest } from '@/types/translation';

const translator = new GeminiTranslator();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request
    if (!body.text || !body.type) {
      return NextResponse.json(
        { error: 'Missing required fields: text, type' },
        { status: 400 }
      );
    }

    const translationRequest: TranslationRequest = {
      id: body.id || `translation_${Date.now()}`,
      text: body.text,
      sourceLanguage: body.sourceLanguage || 'en',
      targetLanguage: body.targetLanguage || 'ko',
      type: body.type,
      context: body.context,
    };

    // Translate
    const result = await translator.translate(translationRequest);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: 'Translation failed', details: error.message },
      { status: 500 }
    );
  }
}

// Batch translation endpoint
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.requests || !Array.isArray(body.requests)) {
      return NextResponse.json(
        { error: 'Missing required field: requests (array)' },
        { status: 400 }
      );
    }

    const result = await translator.translateBatch({
      requests: body.requests,
      priority: body.priority,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Batch translation error:', error);
    return NextResponse.json(
      { error: 'Batch translation failed', details: error.message },
      { status: 500 }
    );
  }
}