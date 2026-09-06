const express = require('express');
const authRouter = express.Router();
const rateLimit = require('express-rate-limit');

const authController = require('../controllers/authController')

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Please try again later.' }
});

authRouter.get('/login',authController.getLogin);
authRouter.post('/login', loginLimiter, authController.postLogin);
authRouter.post('/logout', authController.postLogout);
authRouter.get('/signup',authController.getSignup);
authRouter.post('/signup',authController.postSignup);

module.exports = authRouter;