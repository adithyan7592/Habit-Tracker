const mongoose = require('mongoose');

const BasicDetailsSchema = new mongoose.Schema({
  name:         { type: String, trim: true, default: '' },
  age:          { type: Number, min: 1, max: 120 },
  gender:       { type: String, trim: true, default: '' },
  heightCm:     { type: Number, min: 50, max: 250 },
  weightKg:     { type: Number, min: 10, max: 300 },
  healthGoal:   { type: String, trim: true, default: '' },
  medicalNotes: { type: String, trim: true, default: '' }
}, { _id: false });

const UserSchema = new mongoose.Schema({
  phone:     { type: String, required: true, unique: true, index: true },
  role:      { type: String, enum: ['user', 'admin'], default: 'user' },
  otp:       { type: String, select: false },
  otpExpires:{ type: Date,   select: false },

  basicDetails:      { type: BasicDetailsSchema, default: () => ({}) },
  finalReport:       { type: String, default: null },
  reportGeneratedAt: { type: Date,   default: null },

  // ── Calendar-anchor fields ─────────────────────────────────────────────────
  // Set to midnight (UTC) of the day the user submits Day 1.
  startedAt:      { type: Date, default: null },
  reportUnlockAt: { type: Date, default: null },
  // ──────────────────────────────────────────────────────────────────────────

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
