"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketError = exports.ValidationError = exports.AuthError = exports.AudioError = exports.TranslationError = exports.AppError = void 0;
/**
 * Base error class for the application
 */
class AppError extends Error {
    constructor(message, code, statusCode) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.statusCode = statusCode;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
/**
 * Translation-related errors
 */
class TranslationError extends AppError {
    constructor(message, code = 'TRANSLATION_ERROR') {
        super(message, code, 500);
    }
}
exports.TranslationError = TranslationError;
/**
 * Audio processing errors
 */
class AudioError extends AppError {
    constructor(message, code = 'AUDIO_ERROR') {
        super(message, code, 500);
    }
}
exports.AudioError = AudioError;
/**
 * Authentication errors
 */
class AuthError extends AppError {
    constructor(message, code = 'AUTH_ERROR') {
        super(message, code, 401);
    }
}
exports.AuthError = AuthError;
/**
 * Validation errors
 */
class ValidationError extends AppError {
    constructor(message, code = 'VALIDATION_ERROR') {
        super(message, code, 400);
    }
}
exports.ValidationError = ValidationError;
/**
 * WebSocket errors
 */
class WebSocketError extends AppError {
    constructor(message, code = 'WEBSOCKET_ERROR') {
        super(message, code, 500);
    }
}
exports.WebSocketError = WebSocketError;
