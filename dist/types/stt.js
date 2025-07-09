"use strict";
/**
 * Speech-to-Text Service Types and Interfaces
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.STTErrorCodes = exports.STTError = void 0;
// Error types
class STTError extends Error {
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'STTError';
    }
}
exports.STTError = STTError;
exports.STTErrorCodes = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    AUTH_ERROR: 'AUTH_ERROR',
    INVALID_AUDIO: 'INVALID_AUDIO',
    LANGUAGE_NOT_SUPPORTED: 'LANGUAGE_NOT_SUPPORTED',
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};
