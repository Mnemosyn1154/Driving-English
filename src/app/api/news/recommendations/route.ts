import { NextRequest, NextResponse } from 'next/server';

/**
 * @deprecated Use GET /api/news/articles?type=recommendations instead
 */
export async function GET(request: NextRequest) {
  // Redirect to the new unified endpoint
  const url = new URL(request.url);
  const newUrl = new URL('/api/news/articles', url.origin);
  
  // Add type parameter
  newUrl.searchParams.set('type', 'recommendations');
  
  // Copy all other query parameters
  url.searchParams.forEach((value, key) => {
    if (key !== 'type') {
      newUrl.searchParams.set(key, value);
    }
  });

  // Log deprecation warning
  console.warn('[DEPRECATED] /api/news/recommendations is deprecated. Use /api/news/articles?type=recommendations instead');

  // Redirect to new endpoint
  return NextResponse.redirect(newUrl, 301);
}