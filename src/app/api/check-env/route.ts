import { NextResponse } from 'next/server';
import fs from 'fs';
import { config, isProduction } from '@/lib/env';

export async function GET() {
  // 보안을 위해 개발 환경에서만 작동
  if (isProduction) {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    );
  }

  const googleCredPath = config.api.googleCredentials;
  let googleCredExists = false;
  
  if (googleCredPath) {
    try {
      googleCredExists = fs.existsSync(googleCredPath);
    } catch (error) {
      googleCredExists = false;
    }
  }

  return NextResponse.json({
    environment: config.env.nodeEnv,
    credentials: {
      googleCloud: {
        path: googleCredPath ? '✅ Set' : '❌ Not set',
        fileExists: googleCredExists ? '✅ File exists' : '❌ File not found',
      },
      geminiApi: {
        key: config.api.geminiApiKey ? '✅ Set' : '❌ Not set',
        length: config.api.geminiApiKey ? config.api.geminiApiKey.length : 0,
      },
      supabase: {
        url: config.supabase.url ? '✅ Set' : '❌ Not set',
        anonKey: config.supabase.anonKey ? '✅ Set' : '❌ Not set',
      }
    }
  });
}