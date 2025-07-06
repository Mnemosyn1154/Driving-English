// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '';
  },
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock WebSocket
global.WebSocket = jest.fn(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

// Mock Audio Context
global.AudioContext = jest.fn(() => ({
  createMediaStreamSource: jest.fn(),
  createScriptProcessor: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    addEventListener: jest.fn(),
  })),
  close: jest.fn(),
  sampleRate: 16000,
  state: 'running',
}));

// Mock MediaDevices
global.navigator.mediaDevices = {
  getUserMedia: jest.fn(),
  enumerateDevices: jest.fn(),
  getSupportedConstraints: jest.fn(() => ({})),
};

// Mock environment variables
process.env = {
  ...process.env,
  NEXT_PUBLIC_WS_URL: 'ws://localhost:3000/api/voice/stream',
  GEMINI_API_KEY: 'test-gemini-key',
  GOOGLE_APPLICATION_CREDENTIALS: 'test-credentials.json',
  JWT_SECRET: 'test-secret',
};