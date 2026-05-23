const User = require('../models/user');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendSMS = require('../utils/smsHelper');

const normalizePhone = (phone = '') => phone.replace(/\s+/g, '').trim();

const hashOtp = (otp) =>
  crypto.createHash('sha256').update(otp).digest('hex');

const getRoleByPhone = (phone) => {
  return phone === process.env.ADMIN_PHONE ? 'admin' : 'user';
};

exports.requestOTP = async (req, res) => {
  const phone = normalizePhone(req.body.phone);

  if (!/^\+?[1-9]\d{9,14}$/.test(phone)) {
    return res.status(400).json({
      message: 'Enter a valid phone number with country code, example +919876543210.'
    });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 5 * 60 * 1000);
  const role = getRoleByPhone(phone);

  try {
    await User.findOneAndUpdate(
      { phone },
      {
        $set: {
          otp: hashOtp(otp),
          otpExpires,
          role
        },
        $setOnInsert: {
          phone
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );

    await sendSMS(phone, otp);
    return res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error('OTP request failed:', err);
    return res.status(500).json({ message: 'Failed to send OTP' });
  }
};

exports.verifyOTP = async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const { otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ message: 'Phone and OTP are required.' });
  }

  try {
    const user = await User.findOne({
      phone,
      otp: hashOtp(otp),
      otpExpires: { $gt: new Date() }
    }).select('+otp +otpExpires');

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const role = getRoleByPhone(user.phone);

    user.role = role;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = jwt.sign(
      {
        id: user._id,
        phone: user.phone,
        role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        phone: user.phone,
        role
      },
      role,
      phone: user.phone
    });
  } catch (err) {
    console.error('OTP verify failed:', err);
    return res.status(500).json({ message: 'OTP verification failed' });
  }
};
// ── POST /api/auth/direct-login (BACKUP — no OTP) ─────────────────────────
exports.directLogin = async (req, res) => {
  const phone = normalizePhone(req.body.phone);

  if (!/^\+?[1-9]\d{9,14}$/.test(phone)) {
    return res.status(400).json({
      message: 'Enter a valid phone number with country code.'
    });
  }

  try {
    const role = getRoleByPhone(phone);

    // Create user if doesn't exist, return existing if they do
    await User.findOneAndUpdate(
      { phone },
      { $setOnInsert: { phone, role } },
      { upsert: true }
    );

    const user = await User.findOne({ phone });

    const token = jwt.sign(
      { id: user._id, phone: user.phone, role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({ token, role, phone });

  } catch (err) {
    console.error('Direct login failed:', err);
    return res.status(500).json({ message: 'Login failed' });
  }
};
exports.verifyWidget = async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const accessToken = req.body.accessToken;

  try {
    const msg91Res = await fetch('https://control.msg91.com/api/v5/widget/verifyAccessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authkey: process.env.MSG91_AUTH_KEY,
        'access-token': accessToken
      })
    });

    const msg91Data = await msg91Res.json();
    console.log('MSG91 verify response:', msg91Data);

    if (msg91Data.type === 'error' || !msg91Res.ok) {
      return res.status(400).json({ message: 'OTP verification failed' });
    }

    const role = getRoleByPhone(phone);
    await User.findOneAndUpdate(
      { phone },
      { $setOnInsert: { phone, role } },
      { upsert: true }
    );

    const user = await User.findOne({ phone });
    const token = jwt.sign(
      { id: user._id, phone: user.phone, role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({ token, role, phone });

  } catch (err) {
    console.error('Widget verify failed:', err);
    return res.status(500).json({ message: 'Verification failed' });
  }
};