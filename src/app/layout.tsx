import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Driving English - 운전하며 배우는 AI 영어 뉴스',
  description: '운전 중에도 안전하게 사용할 수 있는 AI 기반 영어 학습 서비스',
  manifest: '/manifest.json',
  themeColor: '#1e3c72',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>{children}</body>
    </html>
  );
}