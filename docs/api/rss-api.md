# RSS API Documentation

## Overview

The RSS API provides a RESTful interface for managing RSS sources and fetching articles. It supports both system-wide RSS sources and user-specific RSS sources.

## Base URL

```
/api/rss
```

## Endpoints

### RSS Sources

#### List RSS Sources
```http
GET /api/rss/sources
```

Query Parameters:
- `category` (string, optional): Filter by category
- `enabled` (boolean, optional): Filter by enabled status
- `type` (string, optional): Filter by type ('RSS', 'USER_RSS', 'ALL')

Response:
```json
{
  "sources": [
    {
      "id": "string",
      "name": "string",
      "url": "string",
      "category": "string",
      "enabled": boolean,
      "type": "RSS" | "USER_RSS",
      "lastFetch": "datetime",
      "lastError": "string"
    }
  ],
  "count": number
}
```

#### Get RSS Source
```http
GET /api/rss/sources/{id}
```

Response:
```json
{
  "source": { /* RSS Source object */ },
  "statistics": {
    "totalArticles": number,
    "recentArticles": number
  }
}
```

#### Create RSS Source
```http
POST /api/rss/sources
```

Request Body:
```json
{
  "name": "string",
  "url": "string",
  "category": "string",
  "enabled": boolean,
  "updateInterval": number
}
```

Response:
```json
{
  "message": "RSS source created successfully",
  "source": { /* RSS Source object */ },
  "feedInfo": { /* Feed validation info */ }
}
```

#### Update RSS Source
```http
PUT /api/rss/sources/{id}
```

Request Body:
```json
{
  "name": "string",
  "category": "string",
  "enabled": boolean,
  "updateInterval": number
}
```

#### Delete RSS Source
```http
DELETE /api/rss/sources/{id}
```

### RSS Operations

#### Validate RSS Feed
```http
POST /api/rss/validate
```

Request Body:
```json
{
  "url": "string"
}
```

Response:
```json
{
  "valid": boolean,
  "feedInfo": {
    "title": "string",
    "description": "string",
    "link": "string",
    "language": "string",
    "itemCount": number,
    "categories": ["string"]
  },
  "error": "string" // if invalid
}
```

#### Fetch Articles from Source
```http
POST /api/rss/sources/{id}/fetch
```

Query Parameters:
- `immediate` (boolean, optional): If true, fetch immediately. Otherwise, queue for background processing.

Response (immediate=true):
```json
{
  "message": "Fetch completed",
  "result": {
    "success": boolean,
    "articlesCount": number,
    "errors": ["string"],
    "duration": number
  }
}
```

Response (immediate=false):
```json
{
  "message": "Fetch queued for processing",
  "jobId": "string",
  "source": { /* Basic source info */ }
}
```

#### Batch Operations
```http
POST /api/rss/sources/batch
```

Request Body:
```json
{
  "action": "fetch" | "enable" | "disable" | "delete",
  "sourceIds": ["string"]
}
```

### Statistics

#### Get RSS Statistics
```http
GET /api/rss/statistics
```

Query Parameters:
- `sourceId` (string, optional): Get statistics for specific source

Response:
```json
{
  "statistics": {
    "totalSources": number,
    "enabledSources": number,
    "totalArticles": number,
    "recentArticles": number,
    "sourceBreakdown": [
      {
        "sourceId": "string",
        "name": "string",
        "articleCount": number,
        "lastFetch": "datetime",
        "enabled": boolean
      }
    ],
    "userSourcesCount": number, // if authenticated
    "userEnabledCount": number  // if authenticated
  },
  "timestamp": "datetime"
}
```

## Authentication

Most endpoints support both authenticated and unauthenticated access:
- Unauthenticated users can only see system RSS sources
- Authenticated users can see both system and their own RSS sources
- Creating, updating, and deleting user RSS sources requires authentication

## Error Responses

All endpoints follow a consistent error response format:

```json
{
  "error": "Error message",
  "details": "Detailed error information" // optional
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error

## Migration from Old Endpoints

The following endpoints are deprecated and will redirect to new endpoints:

- `GET /api/rss` → `GET /api/rss/sources?type=USER_RSS`
- `POST /api/rss/fetch` → `POST /api/rss/sources/{id}/fetch`
- `POST /api/rss/batch` → `POST /api/rss/sources/batch`

## Client Usage Example

```typescript
import { rssClient } from '@/lib/api/rssClient';

// Get all RSS sources
const { sources } = await rssClient.getSources();

// Validate a feed
const validation = await rssClient.validateFeed('https://example.com/rss');
if (validation.valid) {
  // Create the source
  const { source } = await rssClient.createSource({
    name: validation.feedInfo.title,
    url: 'https://example.com/rss',
    category: 'technology'
  });
  
  // Fetch articles
  await rssClient.fetchSource(source.id, true);
}

// Batch enable multiple sources
await rssClient.batchOperation('enable', ['id1', 'id2', 'id3']);

// Get statistics
const stats = await rssClient.getStatistics();
```