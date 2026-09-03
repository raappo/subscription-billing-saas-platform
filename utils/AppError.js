/**
 * Custom application error class.
 * Extends Error with statusCode and errorCode for the centralized error handler.
 */
class AppError extends Error {
  constructor(message, statusCode, errorCode = 'APPLICATION_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
