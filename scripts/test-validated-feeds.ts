/**
 * Test validated RSS feeds
 */

import { VALIDATED_NEWS_SOURCES } from '../src/config/validated-news-sources';
import { VALIDATED_RSS_FEEDS } from '../src/data/validated-rss-feeds';

console.log('📊 Validated RSS Feeds Summary\n');

// Count sources
const enabledSources = VALIDATED_NEWS_SOURCES.filter(s => s.enabled);
console.log(`✅ Validated news sources: ${enabledSources.length}`);

// Count by category
const categoryCounts: Record<string, number> = {};
enabledSources.forEach(source => {
  categoryCounts[source.category] = (categoryCounts[source.category] || 0) + 1;
});

console.log('\n📂 By Category:');
Object.entries(categoryCounts).forEach(([category, count]) => {
  console.log(`   ${category}: ${count}`);
});

// Count recommended feeds
let totalRecommended = 0;
console.log('\n📋 Recommended Feeds:');
Object.entries(VALIDATED_RSS_FEEDS).forEach(([category, feeds]) => {
  const activeFeeds = feeds.filter(f => f.status === 'active');
  console.log(`   ${category}: ${activeFeeds.length}`);
  totalRecommended += activeFeeds.length;
});

console.log(`\n✅ Total active recommended feeds: ${totalRecommended}`);

// Show some examples
console.log('\n📰 Sample feeds:');
const samples = enabledSources.slice(0, 5);
samples.forEach(source => {
  console.log(`   - ${source.name}: ${source.url}`);
});

console.log('\n✨ Validation complete!');