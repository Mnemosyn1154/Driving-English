import { NextRequest, NextResponse } from 'next/server';

// Temporary in-memory storage (replace with database)
const articleStore = new Map<string, any>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params;
    
    // For now, return mock data
    // TODO: Implement database storage
    const article = articleStore.get(articleId);
    
    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(article);
  } catch (error: any) {
    console.error('Error fetching article:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article', details: error.message },
      { status: 500 }
    );
  }
}