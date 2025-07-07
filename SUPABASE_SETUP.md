# Supabase 설정 가이드

이 가이드는 Driving English 프로젝트를 Supabase와 연동하는 방법을 설명합니다.

## 1. Supabase 프로젝트 생성

1. [Supabase](https://supabase.com)에 가입하고 로그인
2. "New Project" 클릭
3. 프로젝트 정보 입력:
   - Project name: `driving-english` (또는 원하는 이름)
   - Database Password: 강력한 비밀번호 설정 (저장해두세요!)
   - Region: `Northeast Asia (Seoul)` 선택 (한국에서 가장 빠름)
4. "Create new project" 클릭

## 2. 환경 변수 설정

프로젝트가 생성되면 Settings > API 페이지에서 다음 정보를 확인:

1. `.env.local` 파일 생성:
```bash
cp .env.example .env.local
```

2. 다음 값들을 복사하여 `.env.local`에 붙여넣기:
```env
# Supabase Configuration
DATABASE_URL="Settings > Database > Connection string > URI 값"
SUPABASE_URL="Settings > API > Project URL 값"
SUPABASE_ANON_KEY="Settings > API > anon public 키 값"

# 기존 설정들...
GEMINI_API_KEY="your-gemini-key"
NEWS_API_KEY="your-news-api-key"
# ... 등
```

## 3. 데이터베이스 설정

### 방법 1: Prisma 마이그레이션 (권장)
```bash
# Prisma 클라이언트 생성
npm run db:generate

# 스키마를 Supabase에 푸시
npm run db:push

# (선택) 초기 데이터 시드
npm run db:seed
```

### 방법 2: SQL 직접 실행
Supabase Dashboard > SQL Editor에서 다음 쿼리 실행:

```sql
-- Cache 테이블 생성 (Redis 대체용)
CREATE TABLE IF NOT EXISTS cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cache_expires_at ON cache(expires_at);
CREATE INDEX idx_cache_key ON cache(key);

-- 만료된 캐시 자동 삭제 함수
CREATE OR REPLACE FUNCTION delete_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 주기적으로 실행할 크론 작업 (pg_cron 확장 필요)
-- Supabase는 이를 Edge Functions로 대체 가능
```

## 4. Storage 버킷 설정

Supabase Dashboard > Storage에서:

1. "New bucket" 클릭하여 다음 버킷 생성:
   - `audio-files`: 오디오 파일 저장용
     - Public 설정 ON
   - `article-images`: 기사 이미지 저장용
     - Public 설정 ON

2. 버킷 정책 설정 (RLS):
```sql
-- audio-files 버킷 정책
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'audio-files');
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audio-files' AND auth.role() = 'authenticated');

-- article-images 버킷 정책
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'article-images');
```

## 5. 선택사항: Supabase Auth 설정

기존 JWT 인증 대신 Supabase Auth 사용 시:

1. Authentication > Providers에서 원하는 제공자 활성화
2. Authentication > URL Configuration에서 리다이렉트 URL 설정
3. 코드에서 `@supabase/auth-helpers-nextjs` 사용

## 6. 개발 시작

```bash
# 개발 서버 실행
npm run dev

# 백그라운드 워커 실행 (별도 터미널)
npm run worker
```

## 7. 프로덕션 배포 시 주의사항

1. **Connection Pooling**: Supabase는 기본적으로 연결 풀링을 제공
2. **Rate Limits**: 무료 플랜은 초당 300개 요청 제한
3. **Storage Limits**: 무료 플랜은 1GB 스토리지 제한
4. **Backup**: Supabase는 자동 백업 제공 (Pro 플랜부터 PITR)

## 8. 모니터링

Supabase Dashboard에서 제공하는 기능들:
- Database > Monitoring: 쿼리 성능 모니터링
- Logs: 실시간 로그 확인
- Storage: 스토리지 사용량 확인
- Auth: 사용자 통계

## 9. 트러블슈팅

### 연결 오류
- DATABASE_URL이 정확한지 확인
- Supabase 프로젝트가 활성 상태인지 확인
- 방화벽/VPN 설정 확인

### 성능 이슈
- 인덱스가 제대로 생성되었는지 확인
- 쿼리 성능을 Dashboard에서 모니터링
- Connection pooling 설정 확인

### 캐시 관련
- Cache 테이블이 생성되었는지 확인
- 만료된 항목이 정리되고 있는지 확인
- 필요시 Redis로 전환 가능 (REDIS_URL 설정)

## 10. 비용 최적화 팁

1. **캐싱 적극 활용**: 반복 요청 줄이기
2. **이미지 최적화**: Storage 사용량 줄이기
3. **쿼리 최적화**: 불필요한 조인 피하기
4. **Edge Functions 활용**: 서버리스로 비용 절감

## 추가 리소스

- [Supabase 공식 문서](https://supabase.com/docs)
- [Prisma + Supabase 가이드](https://supabase.com/docs/guides/integrations/prisma)
- [Next.js + Supabase 튜토리얼](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs)