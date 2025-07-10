/**
 * RSS Feed Validation Script
 * Checks all RSS feeds for availability, redirects, and content
 */

import Parser from 'rss-parser';
import { NEWS_SOURCES } from '../src/config/news-sources';
import { RECOMMENDED_RSS_FEEDS } from '../src/data/recommended-rss-feeds';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

interface FeedValidationResult {
  url: string;
  name: string;
  category: string;
  status: 'success' | 'error' | 'redirect';
  finalUrl?: string;
  itemCount?: number;
  errorMessage?: string;
  responseTime?: number;
  isHttps: boolean;
  lastBuildDate?: string;
}

class RSSFeedValidator {
  private parser: Parser;
  private results: FeedValidationResult[] = [];

  constructor() {
    this.parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'Driving English RSS Validator/1.0',
      },
    });
  }

  /**
   * Check if URL uses HTTPS
   */
  private isHttps(url: string): boolean {
    return url.startsWith('https://');
  }

  /**
   * Validate a single RSS feed
   */
  async validateFeed(url: string, name: string, category: string): Promise<FeedValidationResult> {
    const startTime = Date.now();
    const result: FeedValidationResult = {
      url,
      name,
      category,
      status: 'error',
      isHttps: this.isHttps(url),
    };

    try {
      // First, check if URL is accessible using fetch
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow'
      });
      
      clearTimeout(timeout);

      // Check for redirects
      if (response.url && response.url !== url) {
        result.status = 'redirect';
        result.finalUrl = response.url;
        result.isHttps = this.isHttps(response.url);
      }

      // Try to parse the feed
      const feedUrl = result.finalUrl || url;
      const feed = await this.parser.parseURL(feedUrl);
      
      result.status = 'success';
      result.itemCount = feed.items?.length || 0;
      result.lastBuildDate = feed.lastBuildDate || feed.pubDate;
      result.responseTime = Date.now() - startTime;

      // Update finalUrl if not already set
      if (!result.finalUrl && feedUrl !== url) {
        result.finalUrl = feedUrl;
      }

    } catch (error: any) {
      // Try to parse directly if HEAD request fails
      try {
        const feed = await this.parser.parseURL(url);
        result.status = 'success';
        result.itemCount = feed.items?.length || 0;
        result.lastBuildDate = feed.lastBuildDate || feed.pubDate;
        result.responseTime = Date.now() - startTime;
      } catch (parseError: any) {
        result.status = 'error';
        result.errorMessage = parseError.message || error.message;
        result.responseTime = Date.now() - startTime;
      }
    }

    return result;
  }

  /**
   * Validate all feeds from config
   */
  async validateConfigFeeds() {
    console.log('\n📋 Validating feeds from news-sources.ts...\n');
    
    for (const source of NEWS_SOURCES) {
      if (source.type === 'rss' && source.enabled) {
        const result = await this.validateFeed(source.url, source.name, source.category);
        this.results.push(result);
        this.printResult(result);
      }
    }
  }

  /**
   * Validate all recommended feeds
   */
  async validateRecommendedFeeds() {
    console.log('\n📋 Validating feeds from recommended-rss-feeds.ts...\n');
    
    for (const [category, feeds] of Object.entries(RECOMMENDED_RSS_FEEDS)) {
      for (const feed of feeds) {
        const result = await this.validateFeed(feed.url, feed.name, category);
        this.results.push(result);
        this.printResult(result);
      }
    }
  }

  /**
   * Print validation result
   */
  private printResult(result: FeedValidationResult) {
    const icon = result.status === 'success' ? '✅' : result.status === 'redirect' ? '🔄' : '❌';
    const httpsIcon = result.isHttps ? '🔒' : '⚠️';
    
    console.log(`${icon} ${httpsIcon} ${result.name} (${result.category})`);
    console.log(`   URL: ${result.url}`);
    
    if (result.finalUrl && result.finalUrl !== result.url) {
      console.log(`   ➡️  Redirected to: ${result.finalUrl}`);
    }
    
    if (result.status === 'success') {
      console.log(`   📰 Items: ${result.itemCount}`);
      console.log(`   ⏱️  Response time: ${result.responseTime}ms`);
      if (result.lastBuildDate) {
        console.log(`   📅 Last updated: ${result.lastBuildDate}`);
      }
    } else if (result.status === 'error') {
      console.log(`   ❌ Error: ${result.errorMessage}`);
    }
    
    console.log('');
  }

  /**
   * Generate summary report
   */
  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(60) + '\n');

    const total = this.results.length;
    const successful = this.results.filter(r => r.status === 'success').length;
    const redirected = this.results.filter(r => r.status === 'redirect').length;
    const failed = this.results.filter(r => r.status === 'error').length;
    const httpFeeds = this.results.filter(r => !r.isHttps).length;

    console.log(`Total feeds tested: ${total}`);
    console.log(`✅ Successful: ${successful}`);
    console.log(`🔄 Redirected: ${redirected}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Using HTTP (not HTTPS): ${httpFeeds}`);

    // List all HTTP feeds that should be updated
    if (httpFeeds > 0) {
      console.log('\n⚠️  Feeds using HTTP that should be updated to HTTPS:');
      this.results
        .filter(r => !r.isHttps && r.status !== 'error')
        .forEach(r => {
          console.log(`   - ${r.name}: ${r.url}`);
          if (r.finalUrl && r.finalUrl.startsWith('https://')) {
            console.log(`     ✅ Can use: ${r.finalUrl}`);
          }
        });
    }

    // List all failed feeds
    if (failed > 0) {
      console.log('\n❌ Failed feeds that need attention:');
      this.results
        .filter(r => r.status === 'error')
        .forEach(r => {
          console.log(`   - ${r.name}: ${r.url}`);
          console.log(`     Error: ${r.errorMessage}`);
        });
    }

    // Save detailed report to file
    this.saveDetailedReport();
  }

  /**
   * Save detailed report to JSON file
   */
  private saveDetailedReport() {
    const reportPath = path.join(process.cwd(), 'rss-validation-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.length,
        successful: this.results.filter(r => r.status === 'success').length,
        redirected: this.results.filter(r => r.status === 'redirect').length,
        failed: this.results.filter(r => r.status === 'error').length,
        httpFeeds: this.results.filter(r => !r.isHttps).length,
      },
      results: this.results,
      recommendations: this.generateRecommendations(),
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }

  /**
   * Generate recommendations for URL updates
   */
  private generateRecommendations() {
    const recommendations: any[] = [];

    this.results.forEach(result => {
      if (!result.isHttps && result.finalUrl?.startsWith('https://')) {
        recommendations.push({
          type: 'update_to_https',
          name: result.name,
          currentUrl: result.url,
          recommendedUrl: result.finalUrl,
        });
      } else if (result.status === 'redirect' && result.finalUrl) {
        recommendations.push({
          type: 'update_redirect',
          name: result.name,
          currentUrl: result.url,
          recommendedUrl: result.finalUrl,
        });
      } else if (result.status === 'error') {
        recommendations.push({
          type: 'investigate_error',
          name: result.name,
          currentUrl: result.url,
          error: result.errorMessage,
        });
      }
    });

    return recommendations;
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting RSS Feed Validation\n');
  console.log('This will check all RSS feeds for:');
  console.log('- Availability and response time');
  console.log('- HTTP/HTTPS status');
  console.log('- Redirects');
  console.log('- Feed parsing ability');
  console.log('- Number of items in feed\n');

  const validator = new RSSFeedValidator();

  try {
    // Validate feeds from different sources
    await validator.validateConfigFeeds();
    await validator.validateRecommendedFeeds();

    // Generate report
    validator.generateReport();

    console.log('\n✨ Validation completed!');
  } catch (error) {
    console.error('❌ Validation failed:', error);
  }
}

// Run the validator
main().catch(console.error);