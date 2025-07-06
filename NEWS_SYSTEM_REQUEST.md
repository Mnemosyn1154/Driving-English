# News Collection System Implementation Request

Please implement the news collection and processing system for Driving English.

## Requirements:

### 1. News Fetcher (src/services/server/news/fetcher.ts)
- Fetch news from multiple sources:
  - RSS feeds (BBC, CNN, Reuters, etc.)
  - News APIs (NewsAPI.org, etc.)
- Support multiple categories (business, technology, world, etc.)
- Handle rate limiting and retries
- Cache fetched articles

### 2. News Parser (src/services/server/news/parser.ts)
- Extract clean article content
- Remove ads and unnecessary elements
- Split content into sentences
- Extract metadata (title, author, date, category)
- Handle different content formats

### 3. News Preprocessor (src/services/server/news/preprocessor.ts)
- Filter articles by difficulty level
- Prepare articles for translation
- Batch articles for efficient processing
- Generate unique IDs for tracking

### 4. News Sources Configuration (src/config/news-sources.ts)
- Define RSS feed URLs
- API configurations
- Category mappings
- Update frequencies

### 5. News Types (src/types/news.ts)
- TypeScript interfaces for news data
- Article, Sentence, Source types
- Metadata structures

### 6. API Routes
- GET /api/news/latest - Get latest news
- GET /api/news/:id - Get specific article
- GET /api/news/categories - Get available categories
- POST /api/news/refresh - Trigger news update

## Technical Specifications:
- Use node-fetch for HTTP requests
- Use rss-parser for RSS parsing
- Implement caching with Redis
- Handle errors gracefully
- Support Korean and English content
- Optimize for mobile data usage

## Example RSS Feeds:
- BBC: http://feeds.bbci.co.uk/news/world/rss.xml
- CNN: http://rss.cnn.com/rss/edition_world.rss
- Reuters: http://feeds.reuters.com/reuters/worldNews

Please provide complete TypeScript implementations with proper error handling and documentation.