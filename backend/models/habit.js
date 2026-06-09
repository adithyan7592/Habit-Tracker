const HabitSchema = new mongoose.Schema({
  phone:        { type: String, required: true, index: true },
  weekNumber:   { type: Number, required: true, default: 1 },  // ← add this
  dayNumber:    { type: Number, required: true, min: 1, max: 7 },
  breakfast:    { type: String, trim: true, default: '' },
  lunch:        { type: String, trim: true, default: '' },
  dinner:       { type: String, trim: true, default: '' },
  foodDetails:  { type: String, trim: true, default: '' },
  dateSubmitted:{ type: Date, default: Date.now }
});
HabitSchema.index({ phone: 1, weekNumber: 1, dayNumber: 1 }, { unique: true });