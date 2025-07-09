import { NextResponse } from 'next/server';
import fs from 'fs';

export async function GET() {
  // 보안을 위해 개발 환경에서만 작동
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    );
  }

  const googleCredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let googleCredExists = false;
  
  if (googleCredPath) {
    try {
      googleCredExists = fs.existsSync(googleCredPath);
    } catch (error) {
      googleCredExists = false;
    }
  }

  return NextResponse.json({
    environment: process.env.NODE_ENV,
    credentials: {
      googleCloud: {
        path: googleCredPath ? '✅ Set' : '❌ Not set',
        fileExists: googleCredExists ? '✅ File exists' : '❌ File not found',
      },
      geminiApi: {
        key: process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Not set',
        length: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0,
      },
      supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Not set',
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Not set',
      }
    }
  });
}