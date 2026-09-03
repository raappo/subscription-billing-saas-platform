/**
 * Joi validation middleware factory.
 * Usage: validate(schema, 'body') or validate(schema, 'query') or validate(schema, 'params')
 * Returns 400 with detailed validation errors on failure.
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errorCode: 'VALIDATION_ERROR',
        errors,
      });
    }

    // Replace with validated and sanitized values
    req[property] = value;
    next();
  };
};

module.exports = validate;
