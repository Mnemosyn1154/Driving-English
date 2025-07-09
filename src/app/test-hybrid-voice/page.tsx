'use client';

import { useState } from 'react';
import { useHybridSpeechRecognition } from '@/hooks/useHybridSpeechRecognition';
import { CredentialStatus } from '@/components/CredentialStatus';

export default function TestHybridVoicePage() {
  const [results, setResults] = useState<Array<{
    time: string;
    type: 'command' | 'gemini' | 'error';
    transcript?: string;
    intent?: string;
    command?: string;
    response?: string;
    error?: string;
  }>>([]);

  const {
    isRecording,
    status,
    lastTranscript,
    lastIntent,
    lastError,
    startRecording,
    stopRecording,
    clearError,
  } = useHybridSpeechRecognition({
    onCommand: (command, transcript) => {
      console.log('Command detected:', command, transcript);
      setResults(prev => [...prev, {
        time: new Date().toLocaleTimeString(),
        type: 'command',
        command,
        transcript,
      }]);
    },
    onGeminiResponse: (result) => {
      console.log('Gemini response:', result);
      setResults(prev => [...prev, {
        time: new Date().toLocaleTimeString(),
        type: 'gemini',
        transcript: result.transcription,
        intent: result.intent,
        response: result.response,
      }]);
    },
    onError: (error) => {
      console.error('Voice error:', error);
      setResults(prev => [...prev, {
        time: new Date().toLocaleTimeString(),
        type: 'error',
        error: error.message,
      }]);
    },
    onStatusChange: (newStatus) => {
      console.log('Status changed:', newStatus);
    },
  });

  const clearResults = () => {
    setResults([]);
  };

  const getStatusColor = () => {
    switch (status) {
      case 'recording': return 'text-red-500';
      case 'processing_stt': return 'text-yellow-500';
      case 'processing_gemini': return 'text-purple-500';
      case 'success': return 'text-green-500';
      case 'error': return 'text-red-600';
      default: return 'text-gray-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'idle': return '대기 중';
      case 'recording': return '🎤 녹음 중...';
      case 'processing_stt': return '⚡ STT 처리 중...';
      case 'processing_gemini': return '🤖 Gemini 처리 중...';
      case 'success': return '✅ 완료';
      case 'error': return '❌ 오류 발생';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">하이브리드 음성 처리 테스트</h1>
        
        {/* 상태 표시 */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">현재 상태</h2>
            <span className={`text-lg font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </span>
          </div>
          
          {lastTranscript && (
            <div className="mb-2">
              <span className="text-gray-400">인식된 텍스트:</span>
              <p className="text-lg">{lastTranscript}</p>
            </div>
          )}
          
          {lastIntent && (
            <div className="mb-2">
              <span className="text-gray-400">의도:</span>
              <p className="text-lg">{lastIntent}</p>
            </div>
          )}
          
          {lastError && (
            <div className="bg-red-900/20 border border-red-500 rounded p-3 mt-4">
              <p className="text-red-400">{lastError.message}</p>
              <button
                onClick={clearError}
                className="text-sm text-red-300 underline mt-1"
              >
                오류 닫기
              </button>
            </div>
          )}
        </div>

        {/* 컨트롤 버튼 */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={status === 'processing_stt' || status === 'processing_gemini'}
            className={`px-8 py-4 rounded-lg font-medium text-lg transition-all ${
              isRecording 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-blue-600 hover:bg-blue-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isRecording ? '🛑 녹음 중지' : '🎤 음성 인식 시작'}
          </button>
          
          <button
            onClick={clearResults}
            className="px-6 py-4 rounded-lg font-medium text-lg bg-gray-700 hover:bg-gray-600 transition-all"
          >
            결과 지우기
          </button>
        </div>

        {/* 테스트 가이드 */}
        <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold mb-3">테스트 해보세요:</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-blue-300 mb-1">명확한 명령어 (STT):</p>
              <ul className="space-y-1 text-gray-300">
                <li>• "다음 뉴스"</li>
                <li>• "일시정지"</li>
                <li>• "빠르게"</li>
                <li>• "번역해줘"</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-purple-300 mb-1">복잡한 요청 (Gemini):</p>
              <ul className="space-y-1 text-gray-300">
                <li>• "아까 그거 다시 읽어줘"</li>
                <li>• "이거 너무 어려워"</li>
                <li>• "다른 주제 없어?"</li>
                <li>• 웅얼거림이나 불명확한 발음</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 결과 목록 */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">처리 결과</h2>
          {results.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              음성 인식을 시작하면 결과가 여기에 표시됩니다.
            </p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg ${
                    result.type === 'command' 
                      ? 'bg-green-900/20 border border-green-500'
                      : result.type === 'gemini'
                      ? 'bg-purple-900/20 border border-purple-500'
                      : 'bg-red-900/20 border border-red-500'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className={`font-medium ${
                      result.type === 'command' 
                        ? 'text-green-400'
                        : result.type === 'gemini'
                        ? 'text-purple-400'
                        : 'text-red-400'
                    }`}>
                      {result.type === 'command' ? '⚡ STT 명령어' : 
                       result.type === 'gemini' ? '🤖 Gemini 처리' : '❌ 오류'}
                    </span>
                    <span className="text-xs text-gray-400">{result.time}</span>
                  </div>
                  
                  {result.transcript && (
                    <p className="text-sm mb-1">
                      <span className="text-gray-400">인식:</span> {result.transcript}
                    </p>
                  )}
                  
                  {result.command && (
                    <p className="text-sm mb-1">
                      <span className="text-gray-400">명령어:</span> 
                      <code className="ml-2 px-2 py-1 bg-gray-700 rounded">
                        {result.command}
                      </code>
                    </p>
                  )}
                  
                  {result.intent && (
                    <p className="text-sm mb-1">
                      <span className="text-gray-400">의도:</span> {result.intent}
                    </p>
                  )}
                  
                  {result.response && (
                    <p className="text-sm mb-1">
                      <span className="text-gray-400">응답:</span> {result.response}
                    </p>
                  )}
                  
                  {result.error && (
                    <p className="text-sm text-red-300">{result.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 환경 설정 확인 */}
        <CredentialStatus />
      </div>
    </div>
  );
}