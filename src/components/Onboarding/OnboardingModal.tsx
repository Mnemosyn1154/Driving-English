'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './OnboardingModal.module.css';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: 'Driving English에 오신 것을 환영합니다! 🎉',
      content: '운전하면서 영어 뉴스를 들으며 자연스럽게 영어 실력을 향상시키세요.',
      image: '🚗',
      action: null
    },
    {
      title: '개인화된 뉴스 추천 📰',
      content: '관심 카테고리를 선택하면 AI가 맞춤형 뉴스를 추천해드립니다.',
      image: '🎯',
      highlights: [
        '음성 검색 시 관련 뉴스 우선 표시',
        '선택한 분야의 고품질 RSS 피드 추천',
        '전문 용어와 표현 집중 학습'
      ]
    },
    {
      title: '음성으로 편리하게 🎤',
      content: '운전 중에도 안전하게 음성 명령으로 뉴스를 검색하고 들을 수 있습니다.',
      image: '🗣️',
      action: {
        text: '카테고리 선택하러 가기',
        onClick: () => {
          onClose();
          router.push('/settings?tab=categories');
        }
      }
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('onboardingCompleted', 'true');
    onClose();
  };

  if (!isOpen) return null;

  const step = steps[currentStep];

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.skipButton} onClick={handleSkip}>
          건너뛰기
        </button>

        <div className={styles.content}>
          <div className={styles.image}>{step.image}</div>
          <h2 className={styles.title}>{step.title}</h2>
          <p className={styles.description}>{step.content}</p>
          
          {step.highlights && (
            <ul className={styles.highlights}>
              {step.highlights.map((highlight, index) => (
                <li key={index}>{highlight}</li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.dots}>
          {steps.map((_, index) => (
            <span
              key={index}
              className={`${styles.dot} ${index === currentStep ? styles.active : ''}`}
            />
          ))}
        </div>

        <div className={styles.actions}>
          {currentStep > 0 && (
            <button className={styles.prevButton} onClick={handlePrev}>
              이전
            </button>
          )}
          
          {currentStep < steps.length - 1 ? (
            <button className={styles.nextButton} onClick={handleNext}>
              다음
            </button>
          ) : (
            step.action && (
              <button className={styles.primaryButton} onClick={step.action.onClick}>
                {step.action.text}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};