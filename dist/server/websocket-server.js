"use strict";
/**
 * WebSocket Server for Real-time Audio Communication
 * Integrates with Express server and handles Gemini Audio API
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DrivingWebSocketServer = void 0;
const ws_1 = require("ws");
const audioService_1 = require("@/services/gemini/audioService");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class DrivingWebSocketServer {
    constructor(config) {
        this.clients = new Map();
        this.heartbeatInterval = null;
        this.config = {
            server: config.server,
            path: config.path || '/api/voice/stream',
            jwtSecret: config.jwtSecret || process.env.JWT_SECRET || 'default-secret',
            corsOrigin: config.corsOrigin || process.env.CORS_ORIGIN || '*',
        };
        // Initialize WebSocket server
        this.wss = new ws_1.WebSocketServer({
            server: this.config.server,
            path: this.config.path,
            verifyClient: this.verifyClient.bind(this),
        });
        this.setupEventHandlers();
        this.startHeartbeat();
        console.log(`WebSocket server started on path: ${this.config.path}`);
    }
    /**
     * Verify client connection
     */
    verifyClient(info) {
        // Basic CORS check
        if (this.config.corsOrigin !== '*' && info.origin !== this.config.corsOrigin) {
            console.warn(`Rejected connection from origin: ${info.origin}`);
            return false;
        }
        return true;
    }
    /**
     * Setup WebSocket event handlers
     */
    setupEventHandlers() {
        this.wss.on('connection', (ws, request) => {
            const clientId = this.generateClientId();
            const client = {
                id: clientId,
                ws,
                isAuthenticated: false,
                lastPing: Date.now(),
            };
            this.clients.set(clientId, client);
            console.log(`Client connected: ${clientId}`);
            // Send authentication required
            this.sendMessage(client, {
                type: 'auth_required',
                message: 'Authentication required',
                timestamp: Date.now(),
            });
            // Setup client event handlers
            ws.on('message', (data) => {
                this.handleMessage(client, data);
            });
            ws.on('close', (code, reason) => {
                this.handleDisconnect(client, code, reason.toString());
            });
            ws.on('error', (error) => {
                this.handleError(client, error);
            });
            ws.on('pong', () => {
                client.lastPing = Date.now();
            });
        });
        this.wss.on('error', (error) => {
            console.error('WebSocket server error:', error);
        });
    }
    /**
     * Handle incoming messages
     */
    async handleMessage(client, data) {
        try {
            const message = JSON.parse(data.toString());
            switch (message.type) {
                case 'auth':
                    await this.handleAuth(client, message);
                    break;
                case 'audio_stream_start':
                    await this.handleAudioStreamStart(client, message);
                    break;
                case 'audio_chunk':
                    await this.handleAudioChunk(client, message);
                    break;
                case 'audio_stream_end':
                    await this.handleAudioStreamEnd(client, message);
                    break;
                case 'command':
                    await this.handleCommand(client, message);
                    break;
                case 'ping':
                    client.lastPing = Date.now();
                    this.sendMessage(client, {
                        type: 'pong',
                        timestamp: Date.now(),
                    });
                    break;
                default:
                    this.sendError(client, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${message.type}`);
            }
        }
        catch (error) {
            console.error('Error handling message:', error);
            this.sendError(client, 'INVALID_MESSAGE', 'Invalid message format');
        }
    }
    /**
     * Handle authentication
     */
    async handleAuth(client, message) {
        try {
            // In development, accept any token
            if (process.env.NODE_ENV === 'development') {
                client.isAuthenticated = true;
                client.userId = 'dev-user';
            }
            else {
                // Verify JWT token
                const decoded = jsonwebtoken_1.default.verify(message.token, this.config.jwtSecret);
                client.userId = decoded.userId || decoded.sub;
                client.isAuthenticated = true;
            }
            // Send authentication success
            const response = {
                type: 'auth_success',
                sessionId: client.id,
                userId: client.userId,
                timestamp: Date.now(),
            };
            this.sendMessage(client, response);
            console.log(`Client authenticated: ${client.id} (${client.userId})`);
        }
        catch (error) {
            console.error('Authentication failed:', error);
            this.sendError(client, 'AUTH_FAILED', 'Invalid authentication token');
        }
    }
    /**
     * Handle audio stream start
     */
    async handleAudioStreamStart(client, message) {
        if (!client.isAuthenticated) {
            this.sendError(client, 'AUTH_REQUIRED', 'Authentication required');
            return;
        }
        try {
            // Initialize Gemini Audio Service
            client.geminiService = new audioService_1.GeminiAudioService({
                onTranscript: (transcript, isFinal) => {
                    const response = {
                        type: 'recognition_result',
                        transcript,
                        isFinal,
                        confidence: 0.9, // Placeholder confidence
                        timestamp: Date.now(),
                    };
                    this.sendMessage(client, response);
                },
                onAudioResponse: (audioData) => {
                    const response = {
                        type: 'audio_response',
                        data: audioData,
                        format: 'base64',
                        duration: 0,
                        text: '',
                        language: 'ko-KR',
                        timestamp: Date.now(),
                    };
                    this.sendMessage(client, response);
                },
                onError: (error) => {
                    this.sendError(client, 'GEMINI_ERROR', error.message);
                },
            });
            await client.geminiService.startStream(message.config);
            console.log(`Audio stream started for client: ${client.id}`);
        }
        catch (error) {
            console.error('Failed to start audio stream:', error);
            this.sendError(client, 'STREAM_START_FAILED', 'Failed to start audio stream');
        }
    }
    /**
     * Handle audio chunk
     */
    async handleAudioChunk(client, message) {
        if (!client.isAuthenticated) {
            this.sendError(client, 'AUTH_REQUIRED', 'Authentication required');
            return;
        }
        if (!client.geminiService) {
            this.sendError(client, 'STREAM_NOT_STARTED', 'Audio stream not started');
            return;
        }
        try {
            // Convert base64 to binary
            const audioData = Buffer.from(message.data, 'base64');
            await client.geminiService.processAudioChunk(audioData);
        }
        catch (error) {
            console.error('Failed to process audio chunk:', error);
            this.sendError(client, 'AUDIO_PROCESSING_FAILED', 'Failed to process audio chunk');
        }
    }
    /**
     * Handle audio stream end
     */
    async handleAudioStreamEnd(client, message) {
        if (!client.isAuthenticated) {
            this.sendError(client, 'AUTH_REQUIRED', 'Authentication required');
            return;
        }
        if (client.geminiService) {
            try {
                await client.geminiService.endStream();
                client.geminiService = undefined;
                console.log(`Audio stream ended for client: ${client.id}`);
            }
            catch (error) {
                console.error('Failed to end audio stream:', error);
                this.sendError(client, 'STREAM_END_FAILED', 'Failed to end audio stream');
            }
        }
    }
    /**
     * Handle command
     */
    async handleCommand(client, message) {
        if (!client.isAuthenticated) {
            this.sendError(client, 'AUTH_REQUIRED', 'Authentication required');
            return;
        }
        console.log(`Command received from ${client.id}: ${message.command}`);
        // Process command through Gemini if available
        if (client.geminiService) {
            try {
                await client.geminiService.processCommand(message.command, message.context);
            }
            catch (error) {
                console.error('Failed to process command:', error);
                this.sendError(client, 'COMMAND_PROCESSING_FAILED', 'Failed to process command');
            }
        }
    }
    /**
     * Handle client disconnect
     */
    handleDisconnect(client, code, reason) {
        console.log(`Client disconnected: ${client.id} (${code}: ${reason})`);
        // Clean up Gemini service
        if (client.geminiService) {
            client.geminiService.cleanup();
        }
        this.clients.delete(client.id);
    }
    /**
     * Handle client error
     */
    handleError(client, error) {
        console.error(`Client error (${client.id}):`, error);
        // Clean up on error
        if (client.geminiService) {
            client.geminiService.cleanup();
        }
        this.clients.delete(client.id);
    }
    /**
     * Send message to client
     */
    sendMessage(client, message) {
        if (client.ws.readyState === ws_1.WebSocket.OPEN) {
            try {
                client.ws.send(JSON.stringify(message));
            }
            catch (error) {
                console.error('Failed to send message:', error);
            }
        }
    }
    /**
     * Send error message to client
     */
    sendError(client, code, message) {
        const errorMessage = {
            type: 'error',
            code,
            message,
            timestamp: Date.now(),
        };
        this.sendMessage(client, errorMessage);
    }
    /**
     * Start heartbeat mechanism
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            const now = Date.now();
            for (const [clientId, client] of this.clients) {
                // Check if client is still alive
                if (now - client.lastPing > 60000) { // 1 minute timeout
                    console.log(`Client ${clientId} timed out`);
                    client.ws.terminate();
                    this.clients.delete(clientId);
                }
                else {
                    // Send ping
                    if (client.ws.readyState === ws_1.WebSocket.OPEN) {
                        client.ws.ping();
                    }
                }
            }
        }, 30000); // Check every 30 seconds
    }
    /**
     * Generate unique client ID
     */
    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Get connected clients count
     */
    getConnectedClientsCount() {
        return this.clients.size;
    }
    /**
     * Get authenticated clients count
     */
    getAuthenticatedClientsCount() {
        return Array.from(this.clients.values()).filter(client => client.isAuthenticated).length;
    }
    /**
     * Close server
     */
    close() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        // Close all client connections
        for (const client of this.clients.values()) {
            if (client.geminiService) {
                client.geminiService.cleanup();
            }
            client.ws.terminate();
        }
        this.clients.clear();
        this.wss.close();
        console.log('WebSocket server closed');
    }
}
exports.DrivingWebSocketServer = DrivingWebSocketServer;
