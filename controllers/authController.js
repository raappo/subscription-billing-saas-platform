const User = require('../models/User');
const { generateToken } = require('../utils/token');
const { logAudit } = require('../utils/auditLogger');
const AppError = require('../utils/AppError');

/**
 * POST /api/auth/register
 * Register a new user (customer or admin).
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('A user with this email already exists.', 409, 'DUPLICATE_EMAIL');
    }

    const user = new User({
      name,
      email,
      passwordHash: password, // pre-save hook will hash it
      role: role || 'customer',
    });

    await user.save();

    const token = generateToken(user);

    await logAudit(user._id, 'REGISTER', 'User', user._id, { role: user.role }, req.ip);

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: {
        user: user.toJSON(),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Authenticate a user and return a JWT.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError('Invalid email or password.', 401, 'AUTH_INVALID_CREDENTIALS');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Invalid email or password.', 401, 'AUTH_INVALID_CREDENTIALS');
    }

    const token = generateToken(user);

    await logAudit(user._id, 'LOGIN', 'User', user._id, {}, req.ip);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user: user.toJSON(),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Get the current authenticated user's profile.
 */
const getProfile = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Profile retrieved.',
      data: { user: req.user.toJSON() },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getProfile };
