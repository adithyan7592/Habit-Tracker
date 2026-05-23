const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// @route   POST /api/auth/request-otp
// @desc    Checks phone number and sends SMS OTP
router.post('/request-otp', authController.requestOTP);

// @route   POST /api/auth/verify-otp
// @desc    Verifies OTP and returns JWT token
router.post('/verify-otp', authController.verifyOTP);
router.post('/direct-login', authController.directLogin);
router.post('/verify-widget', authController.verifyWidget);
module.exports = router;