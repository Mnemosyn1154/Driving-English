'use client';

import React, { useState, useEffect } from 'react';
import { OptimizedImage } from './OptimizedComponents';

interface ImageData {
  id: number;
  src: string;
  alt: string;
  title: string;
  size: string;
}

const ImageGallery: React.FC = () => {
  const [images, setImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimizationEnabled, setOptimizationEnabled] = useState(true);

  useEffect(() => {
    // Simulate image data loading
    const timer = setTimeout(() => {
      const imageData = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        src: `https://picsum.photos/300/200?random=${i + 1}`,
        alt: `샘플 이미지 ${i + 1}`,
        title: `이미지 ${i + 1}`,
        size: `${Math.floor(Math.random() * 500 + 100)}KB`
      }));
      setImages(imageData);
      setLoading(false);
    }, 600);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div style={{ 
        height: '400px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        color: '#a0a0a0'
      }}>
        이미지 갤러리 로딩 중...
      </div>
    );
  }

  return (
    <div style={{ 
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '8px',
      padding: '20px',
      position: 'relative'
    }}>
      <div style={{ 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h3 style={{ color: '#e0e0e0', margin: 0 }}>
          이미지 갤러리 ({images.length}개 이미지)
        </h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e0e0e0' }}>
          <input
            type="checkbox"
            checked={optimizationEnabled}
            onChange={(e) => setOptimizationEnabled(e.target.checked)}
          />
          이미지 최적화 사용
        </label>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '15px',
        maxHeight: '400px',
        overflow: 'auto'
      }}>
        {images.map((image, index) => (
          <div
            key={image.id}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {optimizationEnabled ? (
              <OptimizedImage
                src={image.src}
                alt={image.alt}
                width={200}
                height={150}
                lazy={index > 6} // First 6 images load immediately
                priority={index < 3} // First 3 images have priority
              />
            ) : (
              <img
                src={image.src}
                alt={image.alt}
                style={{
                  width: '100%',
                  height: '150px',
                  objectFit: 'cover'
                }}
              />
            )}
            
            <div style={{ padding: '10px' }}>
              <div style={{ 
                color: '#e0e0e0', 
                fontSize: '0.9rem',
                fontWeight: 500,
                marginBottom: '5px'
              }}>
                {image.title}
              </div>
              <div style={{ 
                color: '#a0a0a0', 
                fontSize: '0.8rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>{image.size}</span>
                {optimizationEnabled && (
                  <span style={{ 
                    background: 'rgba(34, 197, 94, 0.2)',
                    color: '#4ade80',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontSize: '0.7rem'
                  }}>
                    WebP
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ 
        position: 'absolute', 
        top: '10px', 
        right: '10px', 
        background: optimizationEnabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
        color: optimizationEnabled ? '#4ade80' : '#f87171',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '0.8rem'
      }}>
        {optimizationEnabled ? '✓ 최적화됨' : '⚠ 기본 로딩'}
      </div>

      <div style={{ 
        marginTop: '15px',
        padding: '10px',
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '6px',
        fontSize: '0.8rem',
        color: '#a0a0a0'
      }}>
        <strong>최적화 기능:</strong> WebP 포맷 변환, 지연 로딩, 우선순위 로딩, 스켈레톤 UI
      </div>
    </div>
  );
};

export default ImageGallery;