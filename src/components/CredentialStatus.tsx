'use client';

import { useEffect, useState } from 'react';

interface EnvStatus {
  environment: string;
  credentials: {
    googleCloud: {
      path: string;
      fileExists: string;
    };
    geminiApi: {
      key: string;
      length: number;
    };
    supabase: {
      url: string;
      anonKey: string;
    };
  };
}

export function CredentialStatus() {
  const [status, setStatus] = useState<EnvStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    fetch('/api/check-env')
      .then(res => res.json())
      .then(data => {
        setStatus(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);
  
  if (loading) {
    return (
      <div className="mt-8 text-xs text-gray-500">
        <p>환경변수 체크 중...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="mt-8 text-xs text-red-500">
        <p>환경변수 체크 실패: {error}</p>
      </div>
    );
  }
  
  if (!status) return null;
  
  return (
    <div className="mt-8 text-xs text-gray-500">
      <p className="font-medium mb-2">환경변수 상태:</p>
      <div className="space-y-2 text-gray-400">
        <div>
          <p className="font-medium text-gray-300">Google Cloud:</p>
          <ul className="ml-4">
            <li>• 인증 경로: {status.credentials.googleCloud.path}</li>
            <li>• 파일 존재: {status.credentials.googleCloud.fileExists}</li>
          </ul>
        </div>
        <div>
          <p className="font-medium text-gray-300">Gemini API:</p>
          <ul className="ml-4">
            <li>• API 키: {status.credentials.geminiApi.key}</li>
            {status.credentials.geminiApi.length > 0 && (
              <li>• 키 길이: {status.credentials.geminiApi.length}자</li>
            )}
          </ul>
        </div>
        <div>
          <p className="font-medium text-gray-300">Supabase:</p>
          <ul className="ml-4">
            <li>• URL: {status.credentials.supabase.url}</li>
            <li>• Anon Key: {status.credentials.supabase.anonKey}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}