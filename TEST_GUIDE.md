# 하이브리드 음성 처리 테스트 가이드

## 테스트 페이지 접속
http://localhost:3004/test-hybrid-voice

## 테스트 전 확인사항

### 1. 환경변수 설정 확인
`.env.local` 파일에 다음이 설정되어 있어야 합니다:
```
GOOGLE_APPLICATION_CREDENTIALS=./path/to/service-account.json
GEMINI_API_KEY=your-gemini-api-key
```

### 2. Google Cloud 서비스 계정
- Google Cloud Console에서 서비스 계정 생성
- Speech-to-Text API 활성화
- 서비스 계정 JSON 키 다운로드

### 3. 마이크 권한
브라우저에서 마이크 사용 권한을 허용해야 합니다.

## 테스트 시나리오

### 1. STT 명령어 테스트 (빠른 응답)
다음 명령어를 말해보세요:
- "다음 뉴스" → NEXT_NEWS
- "일시정지" → PAUSE
- "빠르게" → SPEED_UP
- "번역해줘" → TRANSLATE

예상 결과:
- ⚡ 빠른 STT 처리
- 명확한 명령어 인식
- 1-2초 내 응답

### 2. Gemini 폴백 테스트 (복잡한 요청)
다음과 같은 요청을 해보세요:
- "아까 그거 다시 읽어줘"
- "이거 너무 어려워요"
- "음... 뭐였지?"
- 웅얼거리거나 불명확하게 말하기

예상 결과:
- 🤖 Gemini 처리로 전환
- 문맥 이해 및 의도 파악
- 3-5초 내 응답

### 3. 침묵 감지 테스트
- 녹음 시작 후 2초간 아무 말도 하지 않기
- 자동으로 녹음이 종료되는지 확인

### 4. 오류 상황 테스트
- 네트워크 연결 끊고 테스트
- 잘못된 API 키로 테스트

## 문제 해결

### "Google Cloud credentials not configured" 오류
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
```

### "Invalid Gemini API key" 오류
`.env.local` 파일의 GEMINI_API_KEY 확인

### 마이크 접근 불가
1. 브라우저 설정에서 마이크 권한 확인
2. HTTPS가 아닌 localhost에서는 권한 요청이 매번 필요할 수 있음

## 개발자 콘솔 확인
브라우저 개발자 도구(F12)를 열어서 다음을 확인:
- Console 탭에서 로그 메시지
- Network 탭에서 API 요청/응답
- 오류 메시지 상세 정보