// 명령어 패턴 정의
export const COMMAND_PATTERNS = {
  // 특정 소스 + 개수 패턴
  // 예: "테크크런치 뉴스 5개", "블룸버그에서 3개"
  sourceWithCount: /(.+?)\s*(뉴스|기사)?\s*(\d+)\s*개/,
  
  // 소스에서 뉴스 요청
  // 예: "테크크런치에서 뉴스", "BBC 뉴스 보여줘"
  sourceNews: /(.+?)(에서|의)?\s*(뉴스|기사)\s*(보여|찾아|추천|알려)/,
  
  // 카테고리 추천
  // 예: "기술 뉴스 추천해줘", "스포츠 기사 보여줘"
  categoryRecommend: /(기술|비즈니스|과학|건강|스포츠|엔터테인먼트|국제|정치)\s*(뉴스|기사)?\s*(추천|보여|찾아|알려)/,
  
  // 카테고리 + 개수
  // 예: "기술 뉴스 3개"
  categoryWithCount: /(기술|비즈니스|과학|건강|스포츠|엔터테인먼트|국제|정치)\s*(뉴스|기사)?\s*(\d+)\s*개/,
  
  // 자연스러운 요청
  // 예: "흥미로운 뉴스 추천해줘", "최신 뉴스 보여줘"
  naturalRequest: /(흥미로운|재미있는|최신|오늘의|인기있는)\s*(뉴스|기사)\s*(추천|보여|찾아)/,
  
  // 숫자 선택
  // 예: "1번", "3번째"
  numberSelection: /(\d+)\s*번(째)?/,
  
  // 일반 검색
  searchPattern: /(검색|찾아|찾아줘|보여줘|알려줘)/
};

// 명령어 타입 정의
export type CommandType = 
  | 'source_with_count'
  | 'source_news'
  | 'category_recommend'
  | 'category_with_count'
  | 'natural_request'
  | 'number_selection'
  | 'general_search'
  | 'navigation'
  | 'playback'
  | 'help'
  | 'unknown';

// 명령어 분석 결과
export interface CommandAnalysis {
  type: CommandType;
  source?: string;
  category?: string;
  count?: number;
  number?: number;
  keyword?: string;
  confidence: number;
}

// 명령어 분석 함수
export function analyzeCommand(text: string): CommandAnalysis {
  const lowerText = text.toLowerCase();
  
  // 1. 특정 소스 + 개수
  const sourceCountMatch = text.match(COMMAND_PATTERNS.sourceWithCount);
  if (sourceCountMatch) {
    return {
      type: 'source_with_count',
      source: sourceCountMatch[1].trim(),
      count: parseInt(sourceCountMatch[3]),
      confidence: 0.95
    };
  }
  
  // 2. 소스에서 뉴스
  const sourceMatch = text.match(COMMAND_PATTERNS.sourceNews);
  if (sourceMatch) {
    return {
      type: 'source_news',
      source: sourceMatch[1].trim(),
      count: 5, // 기본값
      confidence: 0.9
    };
  }
  
  // 3. 카테고리 + 개수
  const categoryCountMatch = text.match(COMMAND_PATTERNS.categoryWithCount);
  if (categoryCountMatch) {
    return {
      type: 'category_with_count',
      category: categoryCountMatch[1],
      count: parseInt(categoryCountMatch[3]),
      confidence: 0.95
    };
  }
  
  // 4. 카테고리 추천
  const categoryMatch = text.match(COMMAND_PATTERNS.categoryRecommend);
  if (categoryMatch) {
    return {
      type: 'category_recommend',
      category: categoryMatch[1],
      count: 5, // 기본값
      confidence: 0.9
    };
  }
  
  // 5. 자연스러운 요청
  const naturalMatch = text.match(COMMAND_PATTERNS.naturalRequest);
  if (naturalMatch) {
    return {
      type: 'natural_request',
      keyword: naturalMatch[1],
      count: 5,
      confidence: 0.8
    };
  }
  
  // 6. 숫자 선택
  const numberMatch = text.match(COMMAND_PATTERNS.numberSelection);
  if (numberMatch) {
    return {
      type: 'number_selection',
      number: parseInt(numberMatch[1]),
      confidence: 0.95
    };
  }
  
  // 7. 네비게이션 명령
  if (lowerText.includes('다음') || lowerText.includes('next')) {
    return { type: 'navigation', keyword: 'next', confidence: 0.9 };
  }
  if (lowerText.includes('이전') || lowerText.includes('previous')) {
    return { type: 'navigation', keyword: 'previous', confidence: 0.9 };
  }
  
  // 8. 재생 제어
  if (lowerText.includes('일시정지') || lowerText.includes('pause')) {
    return { type: 'playback', keyword: 'pause', confidence: 0.9 };
  }
  if (lowerText.includes('재생') || lowerText.includes('play')) {
    return { type: 'playback', keyword: 'play', confidence: 0.9 };
  }
  if (lowerText.includes('반복') || lowerText.includes('repeat')) {
    return { type: 'playback', keyword: 'repeat', confidence: 0.9 };
  }
  
  // 9. 도움말
  if (lowerText.includes('도움말') || lowerText.includes('help')) {
    return { type: 'help', confidence: 0.95 };
  }
  
  // 10. 일반 검색
  if (text.match(COMMAND_PATTERNS.searchPattern)) {
    return { type: 'general_search', confidence: 0.7 };
  }
  
  return { type: 'unknown', confidence: 0.3 };
}

// 응답 메시지 템플릿
export const RESPONSE_TEMPLATES = {
  sourceFound: (source: string, count: number) => 
    `${source}에서 최신 뉴스 ${count}개를 찾았습니다! 번호를 말씀해주시면 해당 뉴스를 선택할 수 있습니다.`,
  
  categoryFound: (category: string, count: number) =>
    `${category} 카테고리의 추천 뉴스 ${count}개입니다. 어떤 기사를 들으시겠어요?`,
  
  noResults: (query: string) =>
    `"${query}"에 대한 뉴스를 찾을 수 없습니다. 다른 키워드로 검색해보세요.`,
  
  searchResults: (keywords: string[], count: number) =>
    `"${keywords.join(', ')}" 관련 뉴스 ${count}개를 찾았습니다. 번호로 선택해주세요.`,
  
  numberSelected: (number: number) =>
    `${number}번 뉴스를 선택했습니다. 지금 재생할게요.`,
  
  helpMessage: () =>
    `사용 가능한 명령어:
• "테크크런치 뉴스 5개" - 특정 매체의 뉴스
• "기술 뉴스 추천" - 카테고리별 뉴스
• "AI 관련 뉴스" - 키워드 검색
• "1번" - 뉴스 선택
• "다음/이전" - 문장 이동
• "재생/일시정지" - 재생 제어`,
  
  error: () =>
    `죄송합니다. 요청을 처리할 수 없습니다. 다시 한 번 말씀해주세요.`
};