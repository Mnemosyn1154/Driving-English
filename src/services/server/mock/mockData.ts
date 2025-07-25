export const mockArticles = [
  {
    id: '1',
    sourceId: 'mock',
    title: 'Electric Vehicles Lead the Future of Transportation',
    titleKo: '전기차가 이끄는 미래 교통의 변화',
    summary: 'Major automakers announce ambitious plans to transition to electric vehicles by 2030.',
    summaryKo: '주요 자동차 제조사들이 2030년까지 전기차로 전환하는 야심찬 계획을 발표했습니다.',
    content: 'Electric vehicles are becoming mainstream. Battery technology has improved significantly. Charging infrastructure is expanding rapidly.',
    url: 'https://example.com/article1',
    imageUrl: 'https://via.placeholder.com/600x400',
    publishedAt: new Date('2024-01-15'),
    difficulty: 3,
    wordCount: 250,
    readingTime: 75,
    category: 'technology',
    tags: ['electric-vehicles', 'sustainability', 'transportation'],
    isProcessed: true,
    processedAt: new Date(),
    audioUrlEn: '/mock-audio/article1-en.mp3',
    audioUrlKo: '/mock-audio/article1-ko.mp3',
    audioDuration: 180,
    sentences: [
      {
        id: 's1',
        articleId: '1',
        order: 0,
        text: 'Electric vehicles are becoming mainstream.',
        translation: '전기차가 주류가 되고 있습니다.',
        audioUrlEn: '/mock-audio/s1-en.mp3',
        audioUrlKo: '/mock-audio/s1-ko.mp3',
        difficulty: 2,
        wordCount: 5,
      },
      {
        id: 's2',
        articleId: '1',
        order: 1,
        text: 'Battery technology has improved significantly.',
        translation: '배터리 기술이 크게 향상되었습니다.',
        audioUrlEn: '/mock-audio/s2-en.mp3',
        audioUrlKo: '/mock-audio/s2-ko.mp3',
        difficulty: 3,
        wordCount: 5,
      },
      {
        id: 's3',
        articleId: '1',
        order: 2,
        text: 'Charging infrastructure is expanding rapidly.',
        translation: '충전 인프라가 빠르게 확장되고 있습니다.',
        audioUrlEn: '/mock-audio/s3-en.mp3',
        audioUrlKo: '/mock-audio/s3-ko.mp3',
        difficulty: 3,
        wordCount: 5,
      },
    ],
  },
  {
    id: '2',
    sourceId: 'mock',
    title: 'AI Transforms Healthcare Diagnosis',
    titleKo: 'AI가 변화시키는 의료 진단',
    summary: 'Artificial intelligence shows promising results in early disease detection.',
    summaryKo: '인공지능이 조기 질병 진단에서 유망한 결과를 보여주고 있습니다.',
    content: 'Medical AI systems are revolutionizing healthcare. Deep learning models can detect diseases earlier than traditional methods. Patient outcomes are improving with AI assistance.',
    url: 'https://example.com/article2',
    imageUrl: 'https://via.placeholder.com/600x400',
    publishedAt: new Date('2024-01-14'),
    difficulty: 4,
    wordCount: 280,
    readingTime: 84,
    category: 'health',
    tags: ['artificial-intelligence', 'healthcare', 'technology'],
    isProcessed: true,
    processedAt: new Date(),
    audioUrlEn: '/mock-audio/article2-en.mp3',
    audioUrlKo: '/mock-audio/article2-ko.mp3',
    audioDuration: 200,
    sentences: [
      {
        id: 's4',
        articleId: '2',
        order: 0,
        text: 'Medical AI systems are revolutionizing healthcare.',
        translation: '의료 AI 시스템이 의료 분야를 혁신하고 있습니다.',
        audioUrlEn: '/mock-audio/s4-en.mp3',
        audioUrlKo: '/mock-audio/s4-ko.mp3',
        difficulty: 4,
        wordCount: 6,
      },
      {
        id: 's5',
        articleId: '2',
        order: 1,
        text: 'Deep learning models can detect diseases earlier than traditional methods.',
        translation: '딥러닝 모델은 전통적인 방법보다 질병을 더 일찍 발견할 수 있습니다.',
        audioUrlEn: '/mock-audio/s5-en.mp3',
        audioUrlKo: '/mock-audio/s5-ko.mp3',
        difficulty: 4,
        wordCount: 10,
      },
      {
        id: 's6',
        articleId: '2',
        order: 2,
        text: 'Patient outcomes are improving with AI assistance.',
        translation: 'AI의 도움으로 환자 치료 결과가 개선되고 있습니다.',
        audioUrlEn: '/mock-audio/s6-en.mp3',
        audioUrlKo: '/mock-audio/s6-ko.mp3',
        difficulty: 3,
        wordCount: 7,
      },
    ],
  },
];

export const mockStatistics = {
  totalArticles: 150,
  processedArticles: 120,
  unprocessedArticles: 30,
  totalSentences: 3500,
  articlesByCategory: [
    { category: 'technology', count: 45 },
    { category: 'business', count: 38 },
    { category: 'health', count: 32 },
    { category: 'general', count: 35 },
  ],
  articlesByDifficulty: [
    { difficulty: 1, count: 10 },
    { difficulty: 2, count: 25 },
    { difficulty: 3, count: 40 },
    { difficulty: 4, count: 35 },
    { difficulty: 5, count: 10 },
  ],
};

export const mockJobStatus = {
  queues: {
    news: { active: 1, waiting: 2, completed: 45, failed: 3 },
    processing: { active: 2, waiting: 5, completed: 120, failed: 5 },
    maintenance: { active: 0, waiting: 1, completed: 30, failed: 0 },
    audio: { active: 3, waiting: 10, completed: 250, failed: 8 },
  },
  recentJobs: [
    {
      id: 'job1',
      type: 'FETCH_NEWS',
      status: 'SUCCESS',
      createdAt: new Date('2024-01-15T10:00:00'),
      startedAt: new Date('2024-01-15T10:00:05'),
      completedAt: new Date('2024-01-15T10:02:00'),
      attempts: 1,
    },
    {
      id: 'job2',
      type: 'PROCESS_ARTICLE',
      status: 'RUNNING',
      createdAt: new Date('2024-01-15T10:05:00'),
      startedAt: new Date('2024-01-15T10:05:10'),
      attempts: 1,
    },
  ],
  statistics: [
    { type: 'FETCH_NEWS', status: 'SUCCESS', count: 45 },
    { type: 'FETCH_NEWS', status: 'FAILED', count: 3 },
    { type: 'PROCESS_ARTICLE', status: 'SUCCESS', count: 120 },
    { type: 'PROCESS_ARTICLE', status: 'FAILED', count: 5 },
  ],
};