import { NextResponse } from 'next/server';
import { CATEGORY_NAMES } from '@/config/news-sources';

export async function GET() {
  try {
    const categories = Object.entries(CATEGORY_NAMES).map(([id, name]) => ({
      id,
      name,
    }));

    return NextResponse.json({ categories });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories', details: error.message },
      { status: 500 }
    );
  }
}