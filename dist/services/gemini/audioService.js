"use strict";
/**
 * Gemini Audio API Service
 * Handles real-time audio streaming with Gemini's Audio API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiAudioService = void 0;
const generative_ai_1 = require("@google/generative-ai");
class GeminiAudioService {
    constructor(config) {
        this.conversationHistory = [];
        this.isStreaming = false;
        this.currentAudioBuffer = [];
        this.audioSampleRate = 16000;
        this.systemPrompt = `You are a helpful AI assistant for a driving English learning application. 
Users will speak to you in Korean or English while driving. Your responses should be:
1. Concise and clear for driving safety
2. Helpful for English learning
3. Responsive to voice commands about news, learning, and navigation
4. Always respond in Korean unless specifically asked to speak English

Available commands you can help with:
- "다음 뉴스" (next news)
- "이전 뉴스" (previous news)
- "뉴스 읽어줘" (read news)
- "일시정지" (pause)
- "재생" (play)
- "반복" (repeat)
- "종료" (exit)

When users ask for news, help them find relevant English news articles for learning.
When they ask questions about English, provide helpful explanations.
Keep responses under 20 seconds for driving safety.`;
        this.config = config;
        this.geminiConfig = {
            apiKey: process.env.GEMINI_API_KEY || '',
            model: 'gemini-2.0-flash-exp',
            temperature: 0.7,
            maxTokens: 150,
            systemPrompt: this.systemPrompt,
        };
        if (!this.geminiConfig.apiKey) {
            throw new Error('Gemini API key is required');
        }
        this.genAI = new generative_ai_1.GoogleGenerativeAI(this.geminiConfig.apiKey);
        this.initializeModel();
    }
    /**
     * Initialize Gemini model
     */
    initializeModel() {
        try {
            this.model = this.genAI.getGenerativeModel({
                model: this.geminiConfig.model,
                generationConfig: {
                    temperature: this.geminiConfig.temperature,
                    maxOutputTokens: this.geminiConfig.maxTokens,
                },
            });
        }
        catch (error) {
            console.error('Failed to initialize Gemini model:', error);
            this.config.onError?.(error);
        }
    }
    /**
     * Start audio streaming
     */
    async startStream(streamConfig) {
        try {
            this.isStreaming = true;
            this.currentAudioBuffer = [];
            // Set up audio configuration
            if (streamConfig.sampleRate) {
                this.audioSampleRate = streamConfig.sampleRate;
            }
            console.log('Gemini audio stream started');
            // Initialize conversation with system prompt
            if (this.conversationHistory.length === 0) {
                this.conversationHistory.push({
                    role: 'system',
                    content: this.systemPrompt,
                    timestamp: Date.now(),
                });
            }
        }
        catch (error) {
            console.error('Failed to start Gemini audio stream:', error);
            this.config.onError?.(error);
            throw error;
        }
    }
    /**
     * Process audio chunk
     */
    async processAudioChunk(audioData) {
        if (!this.isStreaming) {
            throw new Error('Audio stream not started');
        }
        try {
            // Add audio chunk to buffer
            this.currentAudioBuffer.push(audioData);
            // For now, we'll process accumulated audio every 2 seconds
            // In a real implementation, you'd use Gemini's streaming audio API
            const totalDuration = this.currentAudioBuffer.length * 1024 / this.audioSampleRate;
            if (totalDuration >= 2.0) {
                await this.processAccumulatedAudio();
            }
        }
        catch (error) {
            console.error('Failed to process audio chunk:', error);
            this.config.onError?.(error);
        }
    }
    /**
     * Process accumulated audio (simulated transcription)
     */
    async processAccumulatedAudio() {
        try {
            // Combine audio buffers
            const combinedAudio = Buffer.concat(this.currentAudioBuffer);
            // For now, we'll simulate transcription with a simple text input
            // In a real implementation, you'd send the audio to Gemini's audio API
            const simulatedTranscript = this.simulateTranscription(combinedAudio);
            if (simulatedTranscript) {
                // Send interim result
                this.config.onTranscript?.(simulatedTranscript, false);
                // Process with Gemini
                await this.processTextWithGemini(simulatedTranscript);
            }
            // Clear buffer
            this.currentAudioBuffer = [];
        }
        catch (error) {
            console.error('Failed to process accumulated audio:', error);
            this.config.onError?.(error);
        }
    }
    /**
     * Simulate transcription (placeholder)
     */
    simulateTranscription(audioData) {
        // This is a placeholder - in a real implementation, you would:
        // 1. Convert audio to the format expected by Gemini
        // 2. Send to Gemini's audio API
        // 3. Return the transcription
        // For now, we'll return null to indicate no transcription
        // The actual implementation would use Gemini's multimodal capabilities
        return null;
    }
    /**
     * Process text with Gemini
     */
    async processTextWithGemini(text) {
        try {
            // Add user message to conversation
            const userMessage = {
                role: 'user',
                content: text,
                timestamp: Date.now(),
            };
            this.conversationHistory.push(userMessage);
            // Prepare conversation context
            const conversationContext = this.conversationHistory
                .filter(msg => msg.role !== 'system')
                .map(msg => `${msg.role}: ${msg.content}`)
                .join('\n');
            const prompt = `${this.systemPrompt}\n\n이전 대화:\n${conversationContext}\n\n사용자: ${text}\n\n응답:`;
            // Generate response
            const result = await this.model.generateContent(prompt);
            const response = result.response;
            const responseText = response.text();
            // Add assistant response to conversation
            const assistantMessage = {
                role: 'assistant',
                content: responseText,
                timestamp: Date.now(),
            };
            this.conversationHistory.push(assistantMessage);
            // Send final transcript
            this.config.onTranscript?.(text, true);
            // Convert response to audio and send back
            await this.generateAudioResponse(responseText);
            // Update conversation
            this.config.onConversationUpdate?.(this.conversationHistory);
        }
        catch (error) {
            console.error('Failed to process text with Gemini:', error);
            this.config.onError?.(error);
        }
    }
    /**
     * Generate audio response
     */
    async generateAudioResponse(text) {
        try {
            // For now, we'll use the existing TTS API
            // In a full implementation, you might use Gemini's audio generation
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
                    language: 'ko-KR',
                    voice: 'ko-KR-Standard-A',
                }),
            });
            if (!response.ok) {
                throw new Error('TTS generation failed');
            }
            const result = await response.json();
            if (result.audioUrl) {
                // Fetch audio data
                const audioResponse = await fetch(result.audioUrl);
                const audioBuffer = await audioResponse.arrayBuffer();
                const audioBase64 = Buffer.from(audioBuffer).toString('base64');
                // Send audio response
                this.config.onAudioResponse?.(audioBase64);
            }
        }
        catch (error) {
            console.error('Failed to generate audio response:', error);
            this.config.onError?.(error);
        }
    }
    /**
     * Process command
     */
    async processCommand(command, context) {
        try {
            console.log('Processing command:', command, context);
            // Process command as text
            await this.processTextWithGemini(command);
        }
        catch (error) {
            console.error('Failed to process command:', error);
            this.config.onError?.(error);
        }
    }
    /**
     * End audio stream
     */
    async endStream() {
        try {
            this.isStreaming = false;
            // Process any remaining audio
            if (this.currentAudioBuffer.length > 0) {
                await this.processAccumulatedAudio();
            }
            console.log('Gemini audio stream ended');
        }
        catch (error) {
            console.error('Failed to end audio stream:', error);
            this.config.onError?.(error);
        }
    }
    /**
     * Get conversation history
     */
    getConversationHistory() {
        return this.conversationHistory.filter(msg => msg.role !== 'system');
    }
    /**
     * Clear conversation history
     */
    clearConversationHistory() {
        this.conversationHistory = [
            {
                role: 'system',
                content: this.systemPrompt,
                timestamp: Date.now(),
            }
        ];
    }
    /**
     * Set system prompt
     */
    setSystemPrompt(prompt) {
        this.systemPrompt = prompt;
        this.geminiConfig.systemPrompt = prompt;
        // Update conversation history
        if (this.conversationHistory.length > 0 && this.conversationHistory[0].role === 'system') {
            this.conversationHistory[0].content = prompt;
            this.conversationHistory[0].timestamp = Date.now();
        }
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.geminiConfig = { ...this.geminiConfig, ...config };
        // Re-initialize model if needed
        if (config.model || config.temperature || config.maxTokens) {
            this.initializeModel();
        }
    }
    /**
     * Check if service is available
     */
    async isAvailable() {
        return !!this.geminiConfig.apiKey && !!this.model;
    }
    /**
     * Cleanup resources
     */
    cleanup() {
        this.isStreaming = false;
        this.currentAudioBuffer = [];
        this.conversationHistory = [];
    }
}
exports.GeminiAudioService = GeminiAudioService;
