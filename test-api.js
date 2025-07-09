// API 엔드포인트 테스트 스크립트

async function testAPIs() {
  const baseUrl = 'http://127.0.0.1:3003';
  
  console.log('=== API 테스트 시작 ===\n');
  
  // 1. Health check
  console.log('1. 서버 상태 확인...');
  try {
    const response = await fetch(baseUrl);
    console.log(`✅ 서버 응답: ${response.status}`);
  } catch (error) {
    console.log(`❌ 서버 연결 실패: ${error.message}`);
    return;
  }
  
  // 2. STT API 테스트 (Mock 오디오 데이터)
  console.log('\n2. STT Command API 테스트...');
  try {
    // 간단한 mock 오디오 데이터
    const mockAudio = 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH/////////';
    
    const response = await fetch(`${baseUrl}/api/stt-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: mockAudio })
    });
    
    const result = await response.json();
    console.log(`응답 상태: ${response.status}`);
    console.log('응답 내용:', JSON.stringify(result, null, 2));
    
    if (response.status === 500 && result.error) {
      console.log(`⚠️ STT API 오류: ${result.error}`);
    }
  } catch (error) {
    console.log(`❌ STT API 테스트 실패: ${error.message}`);
  }
  
  // 3. Gemini API 테스트
  console.log('\n3. Gemini Audio API 테스트...');
  try {
    const mockAudio = 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH/////////';
    
    const response = await fetch(`${baseUrl}/api/gemini-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        audio: mockAudio,
        context: { previousTranscripts: ['테스트'] }
      })
    });
    
    const result = await response.json();
    console.log(`응답 상태: ${response.status}`);
    console.log('응답 내용:', JSON.stringify(result, null, 2));
    
    if (response.status === 500 && result.error) {
      console.log(`⚠️ Gemini API 오류: ${result.error}`);
    }
  } catch (error) {
    console.log(`❌ Gemini API 테스트 실패: ${error.message}`);
  }
  
  console.log('\n=== 테스트 완료 ===');
  console.log('\n💡 참고사항:');
  console.log('- Google Cloud 인증이 설정되어 있어야 STT API가 작동합니다');
  console.log('- Gemini API 키가 유효해야 Gemini API가 작동합니다');
  console.log('- 실제 오디오 데이터가 필요합니다 (현재는 mock 데이터 사용)');
}

// 테스트 실행
testAPIs().catch(console.error);