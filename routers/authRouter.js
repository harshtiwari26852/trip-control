const express = require('express');
const authRouter = express.Router();
const rateLimit = require('express-rate-limit');

const authController = require('../controllers/authController');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Please try again later.' }
});

authRouter.get('/api/auth/me', authController.getMe);

authRouter.post('/api/auth/login', loginLimiter, authController.postLogin);
authRouter.post('/api/auth/signup', authController.postSignup);
authRouter.post('/api/auth/logout', authController.postLogout);

module.exports = authRouter;
