/**
 * Basic integration tests to verify core functionality
 */

describe('Basic Integration Tests', () => {
  describe('Project Setup', () => {
    it('should have required dependencies installed', () => {
      const packageJson = require('../../package.json');
      
      expect(packageJson.dependencies).toHaveProperty('next');
      expect(packageJson.dependencies).toHaveProperty('react');
      expect(packageJson.dependencies).toHaveProperty('ws');
      expect(packageJson.dependencies).toHaveProperty('@google-cloud/speech');
    });

    it('should have test framework configured', () => {
      expect(jest).toBeDefined();
      expect(typeof jest.fn).toBe('function');
    });
  });

  describe('Type Definitions', () => {
    it('should be able to import core types', () => {
      const { WebSocketMessage } = require('@/types/websocket');
      const { AudioConfig } = require('@/types/audio');
      const { Article } = require('@/types/news');
      
      expect(WebSocketMessage).toBeDefined();
      expect(AudioConfig).toBeDefined();
      expect(Article).toBeDefined();
    });
  });

  describe('Service Classes', () => {
    it('should be able to instantiate AudioRecorder', () => {
      const { AudioRecorder } = require('@/services/client/audio/recorder');
      const recorder = new AudioRecorder();
      
      expect(recorder).toBeDefined();
      expect(typeof recorder.initialize).toBe('function');
      expect(typeof recorder.start).toBe('function');
      expect(typeof recorder.stop).toBe('function');
    });

    it('should be able to instantiate WebSocketClient', () => {
      const { WebSocketClient } = require('@/services/client/websocket/client');
      const client = new WebSocketClient({
        url: 'ws://localhost:3000',
        token: 'test-token'
      });
      
      expect(client).toBeDefined();
      expect(typeof client.connect).toBe('function');
      expect(typeof client.disconnect).toBe('function');
    });

    it('should be able to instantiate NewsParser', () => {
      const { NewsParser } = require('@/services/server/news/parser');
      const parser = new NewsParser();
      
      expect(parser).toBeDefined();
      expect(typeof parser.parseArticle).toBe('function');
      expect(typeof parser.validateArticle).toBe('function');
    });

    it('should be able to instantiate GeminiTranslator', () => {
      const { GeminiTranslator } = require('@/services/server/translation/geminiTranslator');
      const translator = new GeminiTranslator('test-api-key');
      
      expect(translator).toBeDefined();
      expect(typeof translator.translate).toBe('function');
      expect(typeof translator.translateBatch).toBe('function');
    });
  });

  describe('Cache System', () => {
    it('should have working translation cache', () => {
      const { TranslationCache } = require('@/services/server/translation/cache');
      const cache = new TranslationCache();
      
      cache.set('test-key', 'test-value');
      expect(cache.get('test-key')).toBe('test-value');
      expect(cache.size()).toBe(1);
      
      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should have custom error classes', () => {
      const { TranslationError, AudioError, WebSocketError } = require('@/types/errors');
      
      const translationError = new TranslationError('Test error');
      expect(translationError).toBeInstanceOf(Error);
      expect(translationError.message).toBe('Test error');
      expect(translationError.code).toBe('TRANSLATION_ERROR');
      
      const audioError = new AudioError('Audio test error');
      expect(audioError).toBeInstanceOf(Error);
      expect(audioError.code).toBe('AUDIO_ERROR');
      
      const wsError = new WebSocketError('WebSocket test error');
      expect(wsError).toBeInstanceOf(Error);
      expect(wsError.code).toBe('WEBSOCKET_ERROR');
    });
  });
});