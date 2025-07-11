import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const ttsClient = new TextToSpeechClient();

// 읽기 난이도 계산 (1-5 레벨)
function calculateDifficulty(content: string): number {
  const words = content.split(/\s+/);
  const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = words.length / sentences.length;
  
  // 단어 평균 길이와 문장 평균 길이를 고려하여 난이도 계산
  let difficulty = 1;
  if (avgWordLength > 5) difficulty++;
  if (avgWordLength > 7) difficulty++;
  if (avgSentenceLength > 15) difficulty++;
  if (avgSentenceLength > 25) difficulty++;
  
  return Math.min(difficulty, 5);
}

// 문장 분할 및 번역
async function translateToKorean(text: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const prompt = `Please translate the following English text to Korean naturally. Keep the meaning intact but make it sound natural in Korean:

${text}

Please provide only the Korean translation without any additional text or explanations.`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error('Translation error:', error);
    return text; // 번역 실패시 원문 반환
  }
}

// 문장 분할 및 TTS 생성
async function generateSentenceData(article: any) {
  const sentences = article.content
    .split(/[.!?]+/)
    .filter((s: string) => s.trim().length > 10)
    .slice(0, 20); // 최대 20문장으로 제한
  
  const sentenceData = [];
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (!sentence) continue;
    
    console.log(`  Processing sentence ${i + 1}/${sentences.length}...`);
    
    // 번역
    const translation = await translateToKorean(sentence);
    
    // TTS 생성
    const audioFileName = `${article.id}_${i + 1}.mp3`;
    const audioPath = path.join(process.cwd(), 'public', 'audio', audioFileName);
    
    try {
      const [response] = await ttsClient.synthesizeSpeech({
        input: { text: sentence },
        voice: { languageCode: 'en-US', name: 'en-US-Wavenet-D' },
        audioConfig: { audioEncoding: 'MP3' },
      });
      
      // 오디오 파일 저장
      fs.writeFileSync(audioPath, response.audioContent as Buffer);
      
      sentenceData.push({
        id: `${article.id}_${i + 1}`,
        text: sentence,
        translation: translation,
        audioUrl: `/audio/${audioFileName}`,
        order: i + 1,
      });
      
      // API 제한을 피하기 위한 지연
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`TTS generation error for sentence ${i + 1}:`, error);
      // TTS 실패시에도 텍스트 데이터는 저장
      sentenceData.push({
        id: `${article.id}_${i + 1}`,
        text: sentence,
        translation: translation,
        audioUrl: null,
        order: i + 1,
      });
    }
  }
  
  return sentenceData;
}

async function processArticle(article: any) {
  console.log(`\n🔄 Processing: ${article.title}`);
  
  try {
    // 문장 분할 및 번역, TTS 생성
    const sentences = await generateSentenceData(article);
    
    // 난이도 계산
    const difficulty = calculateDifficulty(article.content);
    
    // 기사 업데이트
    await prisma.article.update({
      where: { id: article.id },
      data: {
        difficulty: difficulty,
        sentences: sentences,
        isProcessed: true,
        processedAt: new Date(),
      }
    });
    
    console.log(`✅ Processed: ${article.title} (Difficulty: ${difficulty}, Sentences: ${sentences.length})`);
    
  } catch (error) {
    console.error(`❌ Error processing article ${article.id}:`, error);
    
    // 에러 발생시에도 처리 완료로 표시 (무한 루프 방지)
    await prisma.article.update({
      where: { id: article.id },
      data: {
        isProcessed: true,
        processedAt: new Date(),
      }
    });
  }
}

async function processAllArticles() {
  console.log('🔄 Starting article processing...\n');
  
  // 오디오 디렉토리 생성
  const audioDir = path.join(process.cwd(), 'public', 'audio');
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }
  
  // 처리되지 않은 기사들 가져오기
  const unprocessedArticles = await prisma.article.findMany({
    where: { isProcessed: false },
    orderBy: { publishedAt: 'desc' },
    take: 50, // 한 번에 50개씩 처리
  });
  
  console.log(`Found ${unprocessedArticles.length} unprocessed articles`);
  
  if (unprocessedArticles.length === 0) {
    console.log('✨ All articles are already processed!');
    return;
  }
  
  // 각 기사 처리
  for (const article of unprocessedArticles) {
    await processArticle(article);
    
    // API 제한을 피하기 위한 지연
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // 처리 완료 통계
  const processedCount = await prisma.article.count({
    where: { isProcessed: true }
  });
  
  const totalCount = await prisma.article.count();
  
  console.log(`\n📊 Processing Statistics:`);
  console.log(`  Processed: ${processedCount}/${totalCount} articles`);
  console.log(`  Remaining: ${totalCount - processedCount} articles`);
}

async function main() {
  try {
    await processAllArticles();
    console.log('\n✨ Article processing completed!');
  } catch (error) {
    console.error('Error processing articles:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();