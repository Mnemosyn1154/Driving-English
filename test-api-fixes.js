#!/usr/bin/env node

/**
 * Next.js 15 API 수정 사항 테스트 스크립트
 */

const https = require('https');
const http = require('http');

// 테스트 환경 설정
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DEVICE_ID = 'test-device-' + Date.now();

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// HTTP 요청 헬퍼
function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const defaultOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };
    
    const req = client.request({ ...defaultOptions, ...options }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// 테스트 케이스들
async function testAPIs() {
  log('=== Next.js 15 API 수정 사항 테스트 시작 ===', 'blue');
  
  let passed = 0;
  let failed = 0;
  
  // 1. RSS API 목록 조회 테스트 (인증 없이)
  log('\n1. RSS API 목록 조회 테스트 (비인증)', 'yellow');
  try {
    const result = await makeRequest(`/api/rss?deviceId=${DEVICE_ID}`);
    if (result.status === 200 && result.data.feeds) {
      log('✓ RSS 목록 조회 성공', 'green');
      passed++;
    } else {
      log('✗ RSS 목록 조회 실패: ' + JSON.stringify(result.data), 'red');
      failed++;
    }
  } catch (error) {
    log('✗ RSS 목록 조회 에러: ' + error.message, 'red');
    failed++;
  }
  
  // 2. RSS 피드 추가 테스트
  log('\n2. RSS 피드 추가 테스트', 'yellow');
  try {
    const result = await makeRequest('/api/rss', {
      method: 'POST',
      body: {
        name: 'Test Feed',
        url: 'https://example.com/rss',
        category: 'test',
        deviceId: DEVICE_ID
      }
    });
    
    if (result.status === 200 || result.status === 409) {
      log('✓ RSS 피드 추가 API 호출 성공', 'green');
      passed++;
    } else {
      log('✗ RSS 피드 추가 실패: ' + JSON.stringify(result.data), 'red');
      failed++;
    }
  } catch (error) {
    log('✗ RSS 피드 추가 에러: ' + error.message, 'red');
    failed++;
  }
  
  // 3. RSS 피드 가져오기 테스트
  log('\n3. RSS 피드 가져오기 테스트', 'yellow');
  try {
    const result = await makeRequest('/api/rss/fetch', {
      method: 'POST',
      body: {
        deviceId: DEVICE_ID,
        forceUpdate: false
      }
    });
    
    if (result.status === 200) {
      log('✓ RSS 피드 가져오기 성공', 'green');
      passed++;
    } else {
      log('✗ RSS 피드 가져오기 실패: ' + JSON.stringify(result.data), 'red');
      failed++;
    }
  } catch (error) {
    log('✗ RSS 피드 가져오기 에러: ' + error.message, 'red');
    failed++;
  }
  
  // 4. 배치 RSS 추가 테스트
  log('\n4. 배치 RSS 추가 테스트', 'yellow');
  try {
    const result = await makeRequest('/api/rss/batch', {
      method: 'POST',
      body: {
        feeds: [
          { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml' },
          { name: 'CNN', url: 'http://rss.cnn.com/rss/edition.rss' }
        ],
        deviceId: DEVICE_ID
      }
    });
    
    if (result.status === 200) {
      log('✓ 배치 RSS 추가 성공', 'green');
      passed++;
    } else {
      log('✗ 배치 RSS 추가 실패: ' + JSON.stringify(result.data), 'red');
      failed++;
    }
  } catch (error) {
    log('✗ 배치 RSS 추가 에러: ' + error.message, 'red');
    failed++;
  }
  
  // 결과 요약
  log('\n=== 테스트 결과 요약 ===', 'blue');
  log(`통과: ${passed}`, 'green');
  log(`실패: ${failed}`, 'red');
  log(`총 테스트: ${passed + failed}`, 'yellow');
  
  if (failed === 0) {
    log('\n✅ 모든 테스트 통과!', 'green');
  } else {
    log('\n❌ 일부 테스트 실패', 'red');
    log('서버가 실행 중인지 확인하세요: npm run dev', 'yellow');
  }
}

// 테스트 실행
testAPIs().catch(console.error);