/**
 * Base error class for the application
 */
export class AppError extends Error {
  code: string;
  statusCode?: number;

  constructor(message: string, code: string, statusCode?: number) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Translation-related errors
 */
export class TranslationError extends AppError {
  constructor(message: string, code: string = 'TRANSLATION_ERROR') {
    super(message, code, 500);
  }
}

/**
 * Audio processing errors
 */
export class AudioError extends AppError {
  constructor(message: string, code: string = 'AUDIO_ERROR') {
    super(message, code, 500);
  }
}

/**
 * Authentication errors
 */
export class AuthError extends AppError {
  constructor(message: string, code: string = 'AUTH_ERROR') {
    super(message, code, 401);
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  constructor(message: string, code: string = 'VALIDATION_ERROR') {
    super(message, code, 400);
  }
}

/**
 * WebSocket errors
 */
export class WebSocketError extends AppError {
  constructor(message: string, code: string = 'WEBSOCKET_ERROR') {
    super(message, code, 500);
  }
}