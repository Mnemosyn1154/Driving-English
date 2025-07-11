import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '@/lib/env';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(config.api.geminiApiKey || '');

// Helper to extract MIME type from base64 data URL
function getMimeType(base64String: string): string {
  const match = base64String.match(/^data:([^;]+);/);
  if (match) {
    return match[1];
  }
  // Default to webm if no match
  return 'audio/webm';
}

// Helper to extract pure base64 data
function extractBase64Data(base64String: string): string {
  if (base64String.includes(',')) {
    return base64String.split(',')[1];
  }
  return base64String;
}

// System prompt for Gemini
const SYSTEM_PROMPT = `You are an AI assistant for the "Driving English" learning app, helping users learn English while driving.

Your role:
1. Understand voice commands in Korean or English, even when unclear or contextual
2. Identify user intent accurately, especially complex requests with numbers and sources
3. Provide helpful responses for English learning
4. Keep responses concise for driving safety

When analyzing audio, consider:
- Context from previous conversations
- Emotional tone and urgency
- Unclear or mumbled speech
- Mixed language usage (Korean/English)
- Numbers and quantities (e.g., "5개", "3 articles")
- News source names (TechCrunch, CNN, BBC, etc.)

Common intents:
- NAVIGATE_NEWS: Moving between news articles (next, previous, specific topic)
- CONTROL_PLAYBACK: Play, pause, repeat, speed control
- REQUEST_EXPLANATION: Asking for word meanings, grammar explanation
- REQUEST_TRANSLATION: Asking for Korean translation
- REQUEST_SIMPLIFICATION: Asking for easier content
- REQUEST_SOURCE: Requesting news from specific source (e.g., "테크크런치 5개", "CNN 뉴스")
- REQUEST_TOPIC: Requesting news about specific topic (e.g., "AI 뉴스", "경제 기사")
- GENERAL_QUESTION: Other learning-related questions
- UNCLEAR: Cannot determine clear intent

Response in JSON format:
{
  "transcription": "what the user said",
  "intent": "identified intent",
  "confidence": 0.0-1.0,
  "response": "appropriate response in Korean",
  "context": {
    "source": "news source if requested (e.g., 'techcrunch')",
    "count": "number of articles if specified",
    "topic": "topic if specified"
  }
}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audio, context = {} } = body;

    if (!audio) {
      return NextResponse.json(
        { error: 'Audio data is required' },
        { status: 400 }
      );
    }

    // Check if Gemini API key is configured
    if (!config.api.geminiApiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    // Extract audio data
    const mimeType = getMimeType(audio);
    const base64Data = extractBase64Data(audio);

    // Create the model
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });

    // Build context prompt
    let contextPrompt = '';
    if (context.previousTranscripts && context.previousTranscripts.length > 0) {
      contextPrompt = `\n\nPrevious conversation:\n${context.previousTranscripts.join('\n')}`;
    }
    if (context.currentNewsId) {
      contextPrompt += `\n\nCurrently reading news article ID: ${context.currentNewsId}`;
    }

    // Create the prompt with audio
    const prompt = SYSTEM_PROMPT + contextPrompt + '\n\nAnalyze the provided audio and respond:';

    // Prepare the audio part
    const audioPart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    // Generate content
    console.log('Sending audio to Gemini for analysis...');
    const result = await model.generateContent([prompt, audioPart]);
    const response = await result.response;
    const text = response.text();

    console.log('Gemini raw response:', text);

    // Try to parse JSON response
    let parsedResponse;
    try {
      // Extract JSON from the response (Gemini might add markdown formatting)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError);
      
      // Fallback response if parsing fails
      parsedResponse = {
        transcription: 'Audio processed but could not parse response',
        intent: 'UNCLEAR',
        confidence: 0.5,
        response: '죄송합니다. 요청을 처리하는 중 문제가 발생했습니다. 다시 말씀해 주세요.',
      };
    }

    // Ensure all required fields are present
    const finalResponse = {
      transcription: parsedResponse.transcription || '',
      intent: parsedResponse.intent || 'UNCLEAR',
      confidence: parsedResponse.confidence || 0.5,
      response: parsedResponse.response || '',
      context: parsedResponse.context || {},
    };

    // Map intents to commands if applicable
    const intentToCommand: Record<string, string> = {
      'NAVIGATE_NEWS_NEXT': 'NEXT_NEWS',
      'NAVIGATE_NEWS_PREV': 'PREV_NEWS',
      'CONTROL_PLAYBACK_PAUSE': 'PAUSE',
      'CONTROL_PLAYBACK_PLAY': 'RESUME',
      'CONTROL_PLAYBACK_REPEAT': 'REPEAT',
      'REQUEST_TRANSLATION': 'TRANSLATE',
      'REQUEST_EXPLANATION': 'EXPLAIN',
      'REQUEST_SIMPLIFICATION': 'SIMPLIFY',
    };

    // Add command mapping if applicable
    if (intentToCommand[finalResponse.intent]) {
      finalResponse.context.command = intentToCommand[finalResponse.intent];
    }

    return NextResponse.json(finalResponse);

  } catch (error) {
    console.error('Gemini audio processing error:', error);
    
    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'Invalid Gemini API key' },
          { status: 500 }
        );
      }
      
      if (error.message.includes('quota')) {
        return NextResponse.json(
          { error: 'Gemini API quota exceeded' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to process audio with Gemini' },
      { status: 500 }
    );
  }
}