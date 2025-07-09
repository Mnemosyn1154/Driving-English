# Google Cloud 설정 가이드

## 1. Google Cloud 서비스 계정 생성

### Google Cloud Console 접속
1. https://console.cloud.google.com 접속
2. 프로젝트 선택 또는 새 프로젝트 생성

### Speech-to-Text API 활성화
1. API 및 서비스 > 라이브러리
2. "Cloud Speech-to-Text API" 검색
3. "사용" 버튼 클릭

### 서비스 계정 생성
1. IAM 및 관리자 > 서비스 계정
2. "서비스 계정 만들기" 클릭
3. 서비스 계정 이름: "driving-english-stt"
4. 역할 추가:
   - Cloud Speech Client
   - Cloud Translation API User (선택사항)

### 키 생성 및 다운로드
1. 생성된 서비스 계정 클릭
2. "키" 탭 > "키 추가" > "새 키 만들기"
3. JSON 형식 선택
4. 자동으로 다운로드됨

## 2. 프로젝트에 인증 파일 설정

```bash
# credentials 디렉토리 생성
mkdir -p credentials

# 다운로드한 JSON 파일을 프로젝트로 복사
# (다운로드 폴더에서 파일명 확인 후)
cp ~/Downloads/your-project-xxxxx.json credentials/google-cloud-key.json

# 파일 권한 설정 (보안)
chmod 600 credentials/google-cloud-key.json
```

## 3. 환경변수 확인

`.env.local` 파일:
```env
GOOGLE_APPLICATION_CREDENTIALS="./credentials/google-cloud-key.json"
GEMINI_API_KEY="your-gemini-api-key"
```

## 4. .gitignore 확인

`credentials/` 폴더가 git에 커밋되지 않도록 확인:
```gitignore
# Google Cloud credentials
credentials/
*.json
```

## 5. 테스트

1. 서버 재시작: `npm run dev`
2. http://127.0.0.1:3003/test-hybrid-voice 접속
3. "음성 인식 시작" 버튼 클릭
4. 테스트 명령어 말하기

## 문제 해결

### "UNAUTHENTICATED" 오류
- 서비스 계정 JSON 파일 경로 확인
- 파일 권한 확인
- Speech-to-Text API 활성화 여부 확인

### 할당량 초과
- Google Cloud Console에서 할당량 확인
- 무료 등급 한도: 월 60분

## 대안: 환경변수로 직접 설정

JSON 파일 대신 환경변수로 설정하려면:

```bash
# Google Cloud Console에서 서비스 계정 키 내용 복사
export GOOGLE_APPLICATION_CREDENTIALS_JSON='{
  "type": "service_account",
  "project_id": "your-project-id",
  ...
}'
```

그리고 코드에서 처리:
```typescript
// API route에서
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  // Use credentials directly
}