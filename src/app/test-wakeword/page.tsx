'use client';

import React, { useState } from 'react';
import { useWakeWord } from '@/hooks/useWakeWord';
import styles from './page.module.css';

export default function TestWakeWordPage() {
  const [log, setLog] = useState<string[]>([]);
  const [customWakeWords, setCustomWakeWords] = useState('헤이 드라이빙,hey driving');

  const {
    isListening,
    isSupported,
    lastDetection,
    start,
    stop,
    updateWakeWords,
    error,
  } = useWakeWord({
    autoStart: false,
    onDetected: (event) => {
      const logEntry = `[${new Date().toLocaleTimeString()}] Wake word detected: "${event.data.wakeWord}" (confidence: ${event.data.confidence.toFixed(2)})`;
      setLog(prev => [logEntry, ...prev].slice(0, 10));
    },
    onError: (err) => {
      const logEntry = `[${new Date().toLocaleTimeString()}] Error: ${err.message}`;
      setLog(prev => [logEntry, ...prev].slice(0, 10));
    },
  });

  const handleToggle = async () => {
    if (isListening) {
      stop();
    } else {
      try {
        await start();
      } catch (err) {
        console.error('Failed to start:', err);
      }
    }
  };

  const handleUpdateWakeWords = () => {
    const words = customWakeWords.split(',').map(w => w.trim()).filter(w => w);
    updateWakeWords(words);
    setLog(prev => [`[${new Date().toLocaleTimeString()}] Wake words updated: ${words.join(', ')}`, ...prev].slice(0, 10));
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Wake Word Detection Test</h1>
      
      <div className={styles.status}>
        <div className={styles.statusItem}>
          <span>Support:</span>
          <span className={isSupported ? styles.supported : styles.unsupported}>
            {isSupported ? '✓ Supported' : '✗ Not Supported'}
          </span>
        </div>
        
        <div className={styles.statusItem}>
          <span>Status:</span>
          <span className={isListening ? styles.active : styles.inactive}>
            {isListening ? '🎤 Listening' : '⏸ Stopped'}
          </span>
        </div>
        
        {error && (
          <div className={styles.statusItem}>
            <span>Error:</span>
            <span className={styles.error}>{error.message}</span>
          </div>
        )}
      </div>

      <div className={styles.controls}>
        <button
          className={`${styles.button} ${isListening ? styles.stopButton : styles.startButton}`}
          onClick={handleToggle}
          disabled={!isSupported}
        >
          {isListening ? 'Stop Listening' : 'Start Listening'}
        </button>
      </div>

      <div className={styles.wakeWords}>
        <h3>Wake Words</h3>
        <div className={styles.inputGroup}>
          <input
            type="text"
            value={customWakeWords}
            onChange={(e) => setCustomWakeWords(e.target.value)}
            placeholder="Enter wake words separated by commas"
            className={styles.input}
          />
          <button onClick={handleUpdateWakeWords} className={styles.updateButton}>
            Update
          </button>
        </div>
        <p className={styles.hint}>
          Try saying: "헤이 드라이빙", "Hey Driving", "드라이빙", or "Driving"
        </p>
      </div>

      {lastDetection && (
        <div className={styles.lastDetection}>
          <h3>Last Detection</h3>
          <p>Wake word: <strong>{lastDetection.wakeWord}</strong></p>
          <p>Confidence: <strong>{(lastDetection.confidence * 100).toFixed(0)}%</strong></p>
          <p>Time: <strong>{new Date(lastDetection.timestamp).toLocaleTimeString()}</strong></p>
        </div>
      )}

      <div className={styles.log}>
        <h3>Activity Log</h3>
        <div className={styles.logContent}>
          {log.length === 0 ? (
            <p className={styles.noLog}>No activity yet. Start listening and say a wake word!</p>
          ) : (
            log.map((entry, index) => (
              <div key={index} className={styles.logEntry}>
                {entry}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}