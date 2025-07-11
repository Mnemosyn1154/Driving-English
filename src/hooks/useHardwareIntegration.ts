'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDrivingSafety } from './useDrivingSafety';

export interface HardwareDevice {
  id: string;
  name: string;
  type: 'bluetooth' | 'usb' | 'wireless' | 'sensor' | 'car-system';
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  capabilities: string[];
  lastSeen: number;
  battery?: number;
  signal?: number;
}

export interface CarSystemData {
  speed: number;
  rpm: number;
  fuelLevel: number;
  temperature: number;
  gps: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  diagnostics: {
    engineWarning: boolean;
    brakeWarning: boolean;
    batteryWarning: boolean;
  };
}

export interface HardwareIntegrationConfig {
  enabled: boolean;
  autoConnect: boolean;
  bluetoothEnabled: boolean;
  carSystemEnabled: boolean;
  sensorEnabled: boolean;
  wearableEnabled: boolean;
  maxDevices: number;
}

export function useHardwareIntegration(config: HardwareIntegrationConfig) {
  const [devices, setDevices] = useState<HardwareDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [carSystemData, setCarSystemData] = useState<CarSystemData | null>(null);
  const [preferredDevices, setPreferredDevices] = useState<string[]>([]);
  const [connectionHistory, setConnectionHistory] = useState<any[]>([]);
  
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const carSystemIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sensorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { voiceFeedback } = useDrivingSafety({
    enabled: config.enabled,
    autoDetectSpeed: true,
    speedThresholds: { slow: 30, fast: 80 },
    emergencyDetection: true,
    focusMode: false,
    batteryMonitoring: true,
    locationServices: true,
  });

  // 블루투스 디바이스 스캔
  const scanBluetoothDevices = useCallback(async () => {
    if (!config.bluetoothEnabled || !navigator.bluetooth) return;

    try {
      setIsScanning(true);
      
      // 블루투스 디바이스 검색
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service', 'device_information'],
      });

      if (device) {
        const newDevice: HardwareDevice = {
          id: device.id,
          name: device.name || 'Unknown Device',
          type: 'bluetooth',
          status: 'connecting',
          capabilities: ['audio', 'control'],
          lastSeen: Date.now(),
        };

        setDevices(prev => {
          const existing = prev.find(d => d.id === device.id);
          if (existing) {
            return prev.map(d => d.id === device.id ? { ...d, ...newDevice } : d);
          }
          return [...prev, newDevice];
        });

        // 연결 시도
        await connectToDevice(device.id);
      }
    } catch (error) {
      console.error('Bluetooth scan error:', error);
      voiceFeedback.messages.error.generic();
    } finally {
      setIsScanning(false);
    }
  }, [config.bluetoothEnabled, voiceFeedback]);

  // 디바이스 연결
  const connectToDevice = useCallback(async (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    try {
      setDevices(prev => 
        prev.map(d => d.id === deviceId ? { ...d, status: 'connecting' } : d)
      );

      // 블루투스 연결 로직
      if (device.type === 'bluetooth' && navigator.bluetooth) {
        // 실제 블루투스 연결 구현 필요
        // 여기서는 시뮬레이션
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        setDevices(prev => 
          prev.map(d => d.id === deviceId ? { 
            ...d, 
            status: 'connected',
            lastSeen: Date.now(),
          } : d)
        );

        // 연결 히스토리 기록
        setConnectionHistory(prev => [{
          timestamp: Date.now(),
          deviceId,
          deviceName: device.name,
          action: 'connected',
        }, ...prev.slice(0, 99)]);

        voiceFeedback.messages.status.connected();
      }
    } catch (error) {
      console.error('Device connection error:', error);
      setDevices(prev => 
        prev.map(d => d.id === deviceId ? { ...d, status: 'error' } : d)
      );
      voiceFeedback.messages.error.generic();
    }
  }, [devices, voiceFeedback]);

  // 디바이스 연결 해제
  const disconnectDevice = useCallback(async (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    try {
      setDevices(prev => 
        prev.map(d => d.id === deviceId ? { ...d, status: 'disconnected' } : d)
      );

      // 연결 해제 히스토리 기록
      setConnectionHistory(prev => [{
        timestamp: Date.now(),
        deviceId,
        deviceName: device.name,
        action: 'disconnected',
      }, ...prev.slice(0, 99)]);

      voiceFeedback.messages.status.disconnected();
    } catch (error) {
      console.error('Device disconnection error:', error);
      voiceFeedback.messages.error.generic();
    }
  }, [devices, voiceFeedback]);

  // 차량 시스템 데이터 읽기
  const readCarSystemData = useCallback(async () => {
    if (!config.carSystemEnabled) return;

    try {
      // OBD-II 포트 연결 시뮬레이션
      // 실제 구현에서는 WebUSB 또는 WebSerial API 사용
      const mockCarData: CarSystemData = {
        speed: Math.random() * 120,
        rpm: Math.random() * 6000,
        fuelLevel: Math.random() * 100,
        temperature: 80 + Math.random() * 20,
        gps: {
          latitude: 37.5665 + (Math.random() - 0.5) * 0.01,
          longitude: 126.9780 + (Math.random() - 0.5) * 0.01,
          accuracy: Math.random() * 10,
        },
        diagnostics: {
          engineWarning: Math.random() < 0.1,
          brakeWarning: Math.random() < 0.05,
          batteryWarning: Math.random() < 0.05,
        },
      };

      setCarSystemData(mockCarData);

      // 경고 사항 체크
      if (mockCarData.diagnostics.engineWarning) {
        voiceFeedback.messages.warning.connection();
      }
      if (mockCarData.diagnostics.batteryWarning) {
        voiceFeedback.messages.warning.battery();
      }
    } catch (error) {
      console.error('Car system data read error:', error);
    }
  }, [config.carSystemEnabled, voiceFeedback]);

  // 스마트워치 연동
  const connectSmartWatch = useCallback(async () => {
    if (!config.wearableEnabled) return;

    try {
      // Web Bluetooth를 통한 스마트워치 연결
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: ['heart_rate'] },
          { services: ['battery_service'] },
        ],
      });

      if (device) {
        const watchDevice: HardwareDevice = {
          id: device.id,
          name: device.name || 'Smart Watch',
          type: 'wireless',
          status: 'connecting',
          capabilities: ['notifications', 'health', 'control'],
          lastSeen: Date.now(),
        };

        setDevices(prev => [...prev, watchDevice]);
        await connectToDevice(device.id);
      }
    } catch (error) {
      console.error('Smart watch connection error:', error);
      voiceFeedback.messages.error.generic();
    }
  }, [config.wearableEnabled, voiceFeedback]);

  // 센서 데이터 읽기
  const readSensorData = useCallback(async () => {
    if (!config.sensorEnabled) return;

    try {
      // 가속도계
      if ('DeviceMotionEvent' in window) {
        const handleDeviceMotion = (event: DeviceMotionEvent) => {
          const { acceleration } = event;
          if (acceleration) {
            // 급격한 움직임 감지
            const totalAcceleration = Math.sqrt(
              (acceleration.x || 0) ** 2 + 
              (acceleration.y || 0) ** 2 + 
              (acceleration.z || 0) ** 2
            );
            
            if (totalAcceleration > 20) { // 급브레이크 또는 충격
              voiceFeedback.addUrgentMessage('급격한 움직임이 감지되었습니다', 'warning');
            }
          }
        };

        window.addEventListener('devicemotion', handleDeviceMotion);
        
        return () => {
          window.removeEventListener('devicemotion', handleDeviceMotion);
        };
      }

      // 자이로스코프
      if ('DeviceOrientationEvent' in window) {
        const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
          // 기울기 감지 등
          const { alpha, beta, gamma } = event;
          if (beta && Math.abs(beta) > 45) {
            voiceFeedback.messages.warning.connection();
          }
        };

        window.addEventListener('deviceorientation', handleDeviceOrientation);
        
        return () => {
          window.removeEventListener('deviceorientation', handleDeviceOrientation);
        };
      }
    } catch (error) {
      console.error('Sensor data read error:', error);
    }
  }, [config.sensorEnabled, voiceFeedback]);

  // 오디오 출력 디바이스 관리
  const manageAudioDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
      
      const audioDevices: HardwareDevice[] = audioOutputs.map(device => ({
        id: device.deviceId,
        name: device.label || 'Audio Device',
        type: 'bluetooth',
        status: 'connected',
        capabilities: ['audio_output'],
        lastSeen: Date.now(),
      }));

      setDevices(prev => {
        const nonAudioDevices = prev.filter(d => !d.capabilities.includes('audio_output'));
        return [...nonAudioDevices, ...audioDevices];
      });
    } catch (error) {
      console.error('Audio device management error:', error);
    }
  }, []);

  // 자동 연결
  const autoConnect = useCallback(async () => {
    if (!config.autoConnect) return;

    for (const deviceId of preferredDevices) {
      const device = devices.find(d => d.id === deviceId);
      if (device && device.status === 'disconnected') {
        await connectToDevice(deviceId);
        await new Promise(resolve => setTimeout(resolve, 1000)); // 연결 간 대기
      }
    }
  }, [config.autoConnect, preferredDevices, devices, connectToDevice]);

  // 디바이스 상태 모니터링
  const monitorDeviceStatus = useCallback(() => {
    const now = Date.now();
    const timeout = 30000; // 30초

    setDevices(prev => 
      prev.map(device => {
        if (device.status === 'connected' && now - device.lastSeen > timeout) {
          return { ...device, status: 'disconnected' };
        }
        return device;
      })
    );
  }, []);

  // 하드웨어 통합 시작
  const startHardwareIntegration = useCallback(() => {
    if (!config.enabled) return;

    // 주기적 스캔
    if (config.autoConnect) {
      scanIntervalRef.current = setInterval(autoConnect, 10000);
    }

    // 차량 시스템 데이터 읽기
    if (config.carSystemEnabled) {
      carSystemIntervalRef.current = setInterval(readCarSystemData, 5000);
    }

    // 센서 데이터 읽기
    if (config.sensorEnabled) {
      readSensorData();
    }

    // 디바이스 상태 모니터링
    const statusInterval = setInterval(monitorDeviceStatus, 5000);

    // 오디오 디바이스 관리
    manageAudioDevices();

    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (carSystemIntervalRef.current) clearInterval(carSystemIntervalRef.current);
      if (sensorIntervalRef.current) clearInterval(sensorIntervalRef.current);
      clearInterval(statusInterval);
    };
  }, [config, autoConnect, readCarSystemData, readSensorData, monitorDeviceStatus, manageAudioDevices]);

  // 하드웨어 통합 중지
  const stopHardwareIntegration = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (carSystemIntervalRef.current) {
      clearInterval(carSystemIntervalRef.current);
      carSystemIntervalRef.current = null;
    }
    if (sensorIntervalRef.current) {
      clearInterval(sensorIntervalRef.current);
      sensorIntervalRef.current = null;
    }
  }, []);

  // 초기화
  useEffect(() => {
    const cleanup = startHardwareIntegration();
    return cleanup;
  }, [startHardwareIntegration]);

  // 정리
  useEffect(() => {
    return () => {
      stopHardwareIntegration();
    };
  }, [stopHardwareIntegration]);

  // 디바이스 통계
  const getDeviceStatistics = useCallback(() => {
    const connected = devices.filter(d => d.status === 'connected').length;
    const disconnected = devices.filter(d => d.status === 'disconnected').length;
    const errors = devices.filter(d => d.status === 'error').length;

    return {
      total: devices.length,
      connected,
      disconnected,
      errors,
      byType: devices.reduce((acc, device) => {
        acc[device.type] = (acc[device.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }, [devices]);

  // 추천 디바이스 목록
  const getRecommendedDevices = useCallback(() => {
    return [
      {
        name: 'Bluetooth 헤드셋',
        type: 'bluetooth',
        reason: '핸즈프리 음성 통화 및 음성 명령',
        priority: 'high',
      },
      {
        name: '차량 오디오 시스템',
        type: 'car-system',
        reason: '고품질 오디오 출력',
        priority: 'high',
      },
      {
        name: '스마트워치',
        type: 'wireless',
        reason: '간편한 제어 및 알림',
        priority: 'medium',
      },
      {
        name: 'OBD-II 어댑터',
        type: 'car-system',
        reason: '차량 진단 데이터 수집',
        priority: 'low',
      },
    ];
  }, []);

  return {
    // 상태
    devices,
    carSystemData,
    isScanning,
    connectionHistory,
    
    // 디바이스 관리
    scanBluetoothDevices,
    connectToDevice,
    disconnectDevice,
    
    // 특수 디바이스
    connectSmartWatch,
    readCarSystemData,
    
    // 제어
    startHardwareIntegration,
    stopHardwareIntegration,
    
    // 설정
    preferredDevices,
    setPreferredDevices,
    
    // 통계 및 추천
    getDeviceStatistics,
    getRecommendedDevices,
    
    // 오디오
    manageAudioDevices,
  };
}