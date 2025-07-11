'use client';

import React, { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import { performanceOptimizer } from '@/services/optimization/performanceOptimizer';

// Lazy loaded components for code splitting
const HeavyChart = lazy(() => import('./HeavyChart'));
const DataTable = lazy(() => import('./DataTable'));
const ImageGallery = lazy(() => import('./ImageGallery'));

// Loading components
const ChartSkeleton = () => (
  <div className="skeleton-chart" style={{ height: '300px', background: '#f0f0f0', borderRadius: '8px' }} />
);

const TableSkeleton = () => (
  <div className="skeleton-table" style={{ height: '400px', background: '#f0f0f0', borderRadius: '8px' }} />
);

const GallerySkeleton = () => (
  <div className="skeleton-gallery" style={{ height: '200px', background: '#f0f0f0', borderRadius: '8px' }} />
);

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  lazy?: boolean;
  priority?: boolean;
}

// Optimized Image component with lazy loading and WebP support
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  lazy = true,
  priority = false
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(!lazy);
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    if (!lazy) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    const imageRef = document.querySelector(`img[alt="${alt}"]`);
    if (imageRef) {
      observer.observe(imageRef);
    }

    return () => observer.disconnect();
  }, [lazy, alt]);

  useEffect(() => {
    // Check WebP support and use optimized format
    const canvas = document.createElement('canvas');
    const supportsWebP = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    
    if (supportsWebP && !src.includes('.webp')) {
      const webpSrc = src.replace(/\.(jpg|jpeg|png)$/, '.webp');
      setCurrentSrc(webpSrc);
    }
  }, [src]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    // Fallback to original format if WebP fails
    if (currentSrc !== src) {
      setCurrentSrc(src);
    }
  };

  return (
    <div style={{ position: 'relative', width, height }}>
      {!isLoaded && (
        <div
          className="skeleton"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, #f0f0f0 25%, transparent 37%, #f0f0f0 63%)',
            backgroundSize: '400% 100%',
            animation: 'skeleton-loading 1.4s ease-in-out infinite',
            borderRadius: '4px'
          }}
        />
      )}
      
      {isInView && (
        <img
          src={currentSrc}
          alt={alt}
          width={width}
          height={height}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease',
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
          loading={priority ? 'eager' : 'lazy'}
        />
      )}
    </div>
  );
};

// Virtual scrolling component for large lists
interface VirtualScrollProps {
  items: any[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: any, index: number) => React.ReactNode;
}

export const VirtualScrollList: React.FC<VirtualScrollProps> = ({
  items,
  itemHeight,
  containerHeight,
  renderItem
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Enable virtual scrolling based on performance optimization settings
    setEnabled((window as any).__virtualScrollingEnabled || items.length > 100);
  }, [items.length]);

  const visibleItems = useMemo(() => {
    if (!enabled) return items;

    const containerItemCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(startIndex + containerItemCount + 1, items.length);
    
    return items.slice(startIndex, endIndex).map((item, index) => ({
      ...item,
      originalIndex: startIndex + index
    }));
  }, [items, scrollTop, itemHeight, containerHeight, enabled]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  if (!enabled) {
    return (
      <div 
        style={{ height: containerHeight, overflow: 'auto' }}
        onScroll={handleScroll}
      >
        {items.map((item, index) => (
          <div key={index} style={{ height: itemHeight }}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.floor(scrollTop / itemHeight);
  const offsetY = startIndex * itemHeight;

  return (
    <div 
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div key={item.originalIndex} style={{ height: itemHeight }}>
              {renderItem(item, item.originalIndex)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Adaptive component that adjusts based on performance
interface AdaptiveComponentProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  performanceThreshold?: number;
}

export const AdaptiveComponent: React.FC<AdaptiveComponentProps> = ({
  children,
  fallback,
  performanceThreshold = 2500
}) => {
  const [shouldRender, setShouldRender] = useState(true);
  const [isLowPerformance, setIsLowPerformance] = useState(false);

  useEffect(() => {
    // Check performance metrics
    const checkPerformance = () => {
      if ('performance' in window) {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const lcp = navigation.loadEventEnd - navigation.loadEventStart;
        
        if (lcp > performanceThreshold) {
          setIsLowPerformance(true);
          setShouldRender(false);
        }
      }
    };

    checkPerformance();
    
    // Listen for performance optimization events
    const handleOptimization = () => {
      checkPerformance();
    };

    window.addEventListener('performance-optimized', handleOptimization);
    return () => window.removeEventListener('performance-optimized', handleOptimization);
  }, [performanceThreshold]);

  if (isLowPerformance && fallback) {
    return <>{fallback}</>;
  }

  return shouldRender ? <>{children}</> : null;
};

// Performance-aware content loader
export const PerformanceAwareLoader: React.FC<{
  children: React.ReactNode;
  priority: 'high' | 'medium' | 'low';
}> = ({ children, priority }) => {
  const [shouldLoad, setShouldLoad] = useState(priority === 'high');

  useEffect(() => {
    if (priority === 'high') return;

    const loadTimer = setTimeout(() => {
      setShouldLoad(true);
    }, priority === 'medium' ? 100 : 500);

    return () => clearTimeout(loadTimer);
  }, [priority]);

  if (!shouldLoad) {
    return (
      <div 
        className="skeleton"
        style={{
          height: '100px',
          background: 'linear-gradient(90deg, #f0f0f0 25%, transparent 37%, #f0f0f0 63%)',
          backgroundSize: '400% 100%',
          animation: 'skeleton-loading 1.4s ease-in-out infinite',
          borderRadius: '4px'
        }}
      />
    );
  }

  return <>{children}</>;
};

// Main demo component showcasing all optimization techniques
export const OptimizationDemo: React.FC = () => {
  const [activeTab, setActiveTab] = useState('charts');
  const [optimizationEnabled, setOptimizationEnabled] = useState(true);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  const toggleOptimization = () => {
    setOptimizationEnabled(!optimizationEnabled);
    if (!optimizationEnabled) {
      performanceOptimizer.startOptimization();
    }
  };

  return (
    <div style={{ padding: '20px', color: '#e0e0e0' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2>성능 최적화 데모</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={optimizationEnabled}
            onChange={toggleOptimization}
          />
          성능 최적화 활성화
        </label>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => handleTabChange('charts')}
          style={{
            padding: '8px 16px',
            marginRight: '10px',
            background: activeTab === 'charts' ? '#3b82f6' : 'transparent',
            border: '1px solid #3b82f6',
            color: '#e0e0e0',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          차트 (지연 로딩)
        </button>
        <button
          onClick={() => handleTabChange('table')}
          style={{
            padding: '8px 16px',
            marginRight: '10px',
            background: activeTab === 'table' ? '#3b82f6' : 'transparent',
            border: '1px solid #3b82f6',
            color: '#e0e0e0',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          테이블 (가상 스크롤)
        </button>
        <button
          onClick={() => handleTabChange('gallery')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'gallery' ? '#3b82f6' : 'transparent',
            border: '1px solid #3b82f6',
            color: '#e0e0e0',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          갤러리 (이미지 최적화)
        </button>
      </div>

      <div style={{ minHeight: '400px' }}>
        {activeTab === 'charts' && (
          <AdaptiveComponent fallback={<ChartSkeleton />}>
            <Suspense fallback={<ChartSkeleton />}>
              <HeavyChart />
            </Suspense>
          </AdaptiveComponent>
        )}

        {activeTab === 'table' && (
          <PerformanceAwareLoader priority="medium">
            <Suspense fallback={<TableSkeleton />}>
              <DataTable />
            </Suspense>
          </PerformanceAwareLoader>
        )}

        {activeTab === 'gallery' && (
          <PerformanceAwareLoader priority="low">
            <Suspense fallback={<GallerySkeleton />}>
              <ImageGallery />
            </Suspense>
          </PerformanceAwareLoader>
        )}
      </div>

      <style jsx>{`
        @keyframes skeleton-loading {
          0% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
};