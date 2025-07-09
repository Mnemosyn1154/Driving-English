'use client';

import React, { useState, useEffect } from 'react';
import { useHybridSpeechRecognition } from '@/hooks/useHybridSpeechRecognition';

export default function TestVoiceCommands() {
  const [results, setResults] = useState<any[]>([]);
  const [testCommands] = useState([
    '다음',
    '테크크런치',
    '테크크런치 5개',
    'CNN 뉴스 보여줘',
    'AI 관련 뉴스',
    '어제 뉴스',
  ]);

  const {
    isRecording,
    status,
    error,
    startRecording,
    stopRecording,
  } = useHybridSpeechRecognition({
    onSttResult: (result) => {
      console.log('STT Result:', result);
      setResults(prev => [...prev, {
        type: 'STT',
        timestamp: new Date().toISOString(),
        ...result
      }]);
    },
    onGeminiResult: (result) => {
      console.log('Gemini Result:', result);
      setResults(prev => [...prev, {
        type: 'Gemini',
        timestamp: new Date().toISOString(),
        ...result
      }]);
    },
    onError: (error) => {
      console.error('Voice Error:', error);
      setResults(prev => [...prev, {
        type: 'Error',
        timestamp: new Date().toISOString(),
        error: error.message
      }]);
    },
  });

  const clearResults = () => setResults([]);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>음성 명령어 테스트</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>테스트할 명령어 예시:</h2>
        <ul>
          {testCommands.map((cmd, idx) => (
            <li key={idx} style={{ margin: '5px 0' }}>"{cmd}"</li>
          ))}
        </ul>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          style={{
            padding: '10px 20px',
            fontSize: '18px',
            backgroundColor: isRecording ? '#dc3545' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          {isRecording ? '녹음 중지' : '녹음 시작'}
        </button>
        
        <button
          onClick={clearResults}
          style={{
            marginLeft: '10px',
            padding: '10px 20px',
            fontSize: '18px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          결과 초기화
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <p>상태: <strong>{status}</strong></p>
        {error && <p style={{ color: 'red' }}>에러: {error}</p>}
      </div>

      <div>
        <h2>인식 결과:</h2>
        <div style={{ 
          backgroundColor: '#f5f5f5', 
          padding: '10px', 
          borderRadius: '5px',
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          {results.length === 0 ? (
            <p>아직 결과가 없습니다.</p>
          ) : (
            results.map((result, idx) => (
              <div key={idx} style={{ 
                marginBottom: '15px', 
                padding: '10px', 
                backgroundColor: 'white',
                borderRadius: '5px',
                border: `2px solid ${result.type === 'STT' ? '#28a745' : result.type === 'Gemini' ? '#007bff' : '#dc3545'}`
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                  [{result.type}] {new Date(result.timestamp).toLocaleTimeString()}
                </div>
                {result.error ? (
                  <div style={{ color: 'red' }}>에러: {result.error}</div>
                ) : (
                  <>
                    {result.transcription && (
                      <div>인식된 텍스트: "{result.transcription}"</div>
                    )}
                    {result.command && (
                      <div>명령어: {result.command} (신뢰도: {result.confidence})</div>
                    )}
                    {result.intent && (
                      <div>의도: {result.intent}</div>
                    )}
                    {result.response && (
                      <div>응답: {result.response}</div>
                    )}
                    {result.context && Object.keys(result.context).length > 0 && (
                      <div>컨텍스트: {JSON.stringify(result.context)}</div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        <p>💡 팁:</p>
        <ul>
          <li>단순 명령어는 STT로 빠르게 처리됩니다</li>
          <li>복잡한 명령어 (예: "테크크런치 5개")는 Gemini로 처리됩니다</li>
          <li>녹음 후 1.5초 침묵 시 자동으로 처리됩니다</li>
        </ul>
      </div>
    </div>
  );
}