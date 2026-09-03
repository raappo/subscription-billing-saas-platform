const mongoose = require('mongoose');

/**
 * Centralized error-handling middleware.
 * Catches all errors thrown/passed via next(err) and returns
 * consistent JSON error responses.
 *
 * Must be registered LAST in the Express middleware chain.
 */
const errorHandler = (err, req, res, _next) => {
  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', err);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errorCode: 'VALIDATION_ERROR',
      errors,
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `Duplicate value for field: ${field}. This ${field} already exists.`,
      errorCode: 'DUPLICATE_KEY',
    });
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(404).json({
      success: false,
      message: `Resource not found. Invalid ID: ${err.value}`,
      errorCode: 'NOT_FOUND',
    });
  }

  // JWT errors (fallback — auth middleware handles most)
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token.',
      errorCode: 'AUTH_TOKEN_INVALID',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token has expired.',
      errorCode: 'AUTH_TOKEN_EXPIRED',
    });
  }

  // Custom application errors (thrown with statusCode)
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message || 'An error occurred.',
      errorCode: err.errorCode || 'APPLICATION_ERROR',
    });
  }

  // Default: 500 Internal Server Error
  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'Internal server error.',
    errorCode: 'INTERNAL_ERROR',
  });
};

module.exports = errorHandler;
