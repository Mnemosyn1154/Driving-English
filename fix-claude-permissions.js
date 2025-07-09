#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

// Claude 설정 파일 경로
const settingsPath = path.join(process.cwd(), '.claude', 'settings.local.json');

function cleanupPermissions() {
  try {
    // 설정 파일 읽기
    const settingsContent = fs.readFileSync(settingsPath, 'utf8');
    const settings = JSON.parse(settingsContent);
    
    if (!settings.permissions || !settings.permissions.allow) {
      console.log('권한 설정이 없습니다.');
      return;
    }
    
    // 중복 제거 전 권한 개수
    const originalCount = settings.permissions.allow.length;
    console.log(`원래 권한 개수: ${originalCount}`);
    
    // Set을 사용하여 중복 제거
    const uniquePermissions = [...new Set(settings.permissions.allow)];
    
    // 정렬하여 가독성 향상
    uniquePermissions.sort();
    
    // 설정 업데이트
    settings.permissions.allow = uniquePermissions;
    
    // 백업 파일 생성
    const backupPath = settingsPath + '.backup.' + Date.now();
    fs.copyFileSync(settingsPath, backupPath);
    console.log(`백업 파일 생성: ${backupPath}`);
    
    // 정리된 설정 저장
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    
    console.log(`중복 제거 후 권한 개수: ${uniquePermissions.length}`);
    console.log(`제거된 중복 권한: ${originalCount - uniquePermissions.length}개`);
    console.log('\n정리된 권한 목록:');
    uniquePermissions.forEach(perm => console.log(`  - ${perm}`));
    
  } catch (error) {
    console.error('오류 발생:', error.message);
  }
}

// 권한 추가 시 중복 체크하는 함수
function addPermissionSafely(newPermission) {
  try {
    const settingsContent = fs.readFileSync(settingsPath, 'utf8');
    const settings = JSON.parse(settingsContent);
    
    if (!settings.permissions) {
      settings.permissions = { allow: [], deny: [] };
    }
    
    // 이미 존재하는지 확인
    if (settings.permissions.allow.includes(newPermission)) {
      console.log(`권한이 이미 존재합니다: ${newPermission}`);
      return false;
    }
    
    // 새 권한 추가
    settings.permissions.allow.push(newPermission);
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log(`권한 추가됨: ${newPermission}`);
    return true;
    
  } catch (error) {
    console.error('권한 추가 실패:', error.message);
    return false;
  }
}

// 권한 상태 확인
function checkPermissionHealth() {
  try {
    const settingsContent = fs.readFileSync(settingsPath, 'utf8');
    const settings = JSON.parse(settingsContent);
    
    if (!settings.permissions || !settings.permissions.allow) {
      console.log('권한 설정이 없습니다.');
      return;
    }
    
    const permissions = settings.permissions.allow;
    const duplicates = {};
    
    // 중복 찾기
    permissions.forEach(perm => {
      duplicates[perm] = (duplicates[perm] || 0) + 1;
    });
    
    console.log('\n=== 권한 상태 진단 ===');
    console.log(`총 권한 개수: ${permissions.length}`);
    
    const duplicatedPerms = Object.entries(duplicates)
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]);
    
    if (duplicatedPerms.length > 0) {
      console.log('\n중복된 권한:');
      duplicatedPerms.forEach(([perm, count]) => {
        console.log(`  ${perm}: ${count}번`);
      });
    } else {
      console.log('중복된 권한이 없습니다.');
    }
    
  } catch (error) {
    console.error('진단 실패:', error.message);
  }
}

// CLI 인터페이스
const command = process.argv[2];

switch (command) {
  case 'clean':
    cleanupPermissions();
    break;
  case 'check':
    checkPermissionHealth();
    break;
  case 'add':
    const permission = process.argv[3];
    if (permission) {
      addPermissionSafely(permission);
    } else {
      console.log('사용법: node fix-claude-permissions.js add "권한명"');
    }
    break;
  default:
    console.log('Claude 권한 관리 도구');
    console.log('\n사용법:');
    console.log('  node fix-claude-permissions.js clean  - 중복 권한 제거');
    console.log('  node fix-claude-permissions.js check  - 권한 상태 확인');
    console.log('  node fix-claude-permissions.js add "권한명"  - 권한 추가 (중복 체크)');
}