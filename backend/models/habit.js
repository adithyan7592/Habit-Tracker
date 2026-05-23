const mongoose = require('mongoose');

const HabitSchema = new mongoose.Schema({
  phone:        { type: String, required: true, index: true },
  dayNumber:    { type: Number, required: true, min: 1, max: 7 },
  breakfast:    { type: String, required: true, trim: true, maxlength: 1000 },
  lunch:        { type: String, required: true, trim: true, maxlength: 1000 },
  dinner:       { type: String, required: true, trim: true, maxlength: 1000 },
  foodDetails:  { type: String, trim: true, maxlength: 5000 }, // kept for backward compat
  dateSubmitted:{ type: Date, default: Date.now }
});

HabitSchema.index({ phone: 1, dayNumber: 1 }, { unique: true });

module.exports = mongoose.model('Habit', HabitSchema);
