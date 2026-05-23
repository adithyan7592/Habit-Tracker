const Habit  = require('../models/habit');
const User   = require('../models/user');
const { generateLLMAnalysis } = require('../utils/llmHelper');

// ── Helper: midnight UTC of a given date ────────────────────────────────────
const toMidnightUTC = (date = new Date()) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

// ── Helper: compute which dayNumber the user SHOULD be submitting today ──────
// Returns null if the user is outside their 7-day window (expired or not started).
const getExpectedDayNumber = (startedAt) => {
  if (!startedAt) return 1; // hasn't started yet — next submission is Day 1

  const start         = toMidnightUTC(startedAt);
  const todayMidnight = toMidnightUTC();
  const diffMs        = todayMidnight - start;
  const diffDays      = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const dayNumber     = diffDays + 1; // Day 1 = diff 0, Day 7 = diff 6

  if (dayNumber < 1 || dayNumber > 7) return null;
  return dayNumber;
};


// ── GET /api/habits/status ───────────────────────────────────────────────────
exports.getStatus = async (req, res) => {
  try {
    const [entries, user] = await Promise.all([
      Habit.find({ phone: req.user.phone }).sort({ dayNumber: 1 }).lean(),
      User.findOne({ phone: req.user.phone }).lean()
    ]);

    const startedAt      = user?.startedAt      || null;
    const reportUnlockAt = user?.reportUnlockAt  || null;
    const now            = new Date();

    const expectedDay   = startedAt ? getExpectedDayNumber(startedAt) : 1;
    const windowExpired = reportUnlockAt ? now >= reportUnlockAt : false;

    const todayMidnight    = toMidnightUTC();
    const tomorrowMidnight = new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000);
    const submittedToday   = entries.some(
      (e) => e.dateSubmitted >= todayMidnight && e.dateSubmitted < tomorrowMidnight
    );

    res.json({
      phone:             req.user.phone,
      daysCompleted: entries.filter(e => e.breakfast && e.lunch && e.dinner).length,
      entries,
      basicDetails:      user?.basicDetails      || {},
      finalReport:       user?.finalReport        || null,
      reportGeneratedAt: user?.reportGeneratedAt  || null,
      startedAt,
      reportUnlockAt,
      expectedDay,
      windowExpired,
      submittedToday,
    });
  } catch (err) {
    console.error('getStatus failed:', err);
    res.status(500).json({ message: 'Failed to load status' });
  }
};


// ── PUT /api/habits/basic-details ────────────────────────────────────────────
exports.saveBasicDetails = async (req, res) => {
  const allowed = ['name', 'age', 'gender', 'heightCm', 'weightKg', 'healthGoal', 'medicalNotes'];
  const basicDetails = {};
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) basicDetails[key] = req.body[key];
  });

  try {
    const user = await User.findOneAndUpdate(
      { phone: req.user.phone },
      { $set: { basicDetails } },
      { new: true, runValidators: true }
    );
    res.json({ message: 'Basic details saved', basicDetails: user.basicDetails });
  } catch (err) {
    res.status(400).json({ message: 'Invalid basic details', error: err.message });
  }
};


// ── POST /api/habits/submit ──────────────────────────────────────────────────
exports.submitHabit = async (req, res) => {
  const breakfast = String(req.body.breakfast || '').trim();
  const lunch     = String(req.body.lunch     || '').trim();
  const dinner    = String(req.body.dinner    || '').trim();

  if (!breakfast) return res.status(400).json({ message: 'Breakfast is required.' });
  if (!lunch)     return res.status(400).json({ message: 'Lunch is required.' });
  if (!dinner)    return res.status(400).json({ message: 'Dinner is required.' });

  const foodDetails = `Breakfast: ${breakfast} | Lunch: ${lunch} | Dinner: ${dinner}`;

  try {
    const user        = await User.findOne({ phone: req.user.phone }).lean();
    const expectedDay = getExpectedDayNumber(user?.startedAt || null);

    if (expectedDay === null) {
      return res.status(400).json({
        message: 'Your 7-day submission window has closed. You can no longer add entries.'
      });
    }

    const lastEntry     = await Habit.findOne({ phone: req.user.phone }).sort({ dayNumber: -1 }).lean();
    const lastStoredDay = lastEntry ? lastEntry.dayNumber : 0;
    const nextExpected  = lastStoredDay + 1;

    if (expectedDay < nextExpected) {
      return res.status(400).json({
        message: `You have already submitted Day ${lastStoredDay}. Come back tomorrow for Day ${nextExpected}.`
      });
    }

    const isFirstEntry = nextExpected === 1;
    const userUpdate   = {};

    if (isFirstEntry) {
      const startMidnight  = toMidnightUTC();
      const unlockMidnight = new Date(startMidnight.getTime() + 7 * 24 * 60 * 60 * 1000);
      userUpdate.startedAt      = startMidnight;
      userUpdate.reportUnlockAt = unlockMidnight;
    }

    const [habit] = await Promise.all([
      Habit.create({ phone: req.user.phone, dayNumber: nextExpected, breakfast, lunch, dinner, foodDetails }),
      Object.keys(userUpdate).length
        ? User.findOneAndUpdate({ phone: req.user.phone }, { $set: userUpdate })
        : Promise.resolve()
    ]);

    res.status(201).json({
      message: `Day ${nextExpected} recorded. ${
        nextExpected < 7
          ? `Come back tomorrow for Day ${nextExpected + 1}.`
          : 'You have completed all 7 days! Your report will unlock tomorrow.'
      }`,
      habit,
      ...(isFirstEntry ? {
        startedAt:      userUpdate.startedAt,
        reportUnlockAt: userUpdate.reportUnlockAt
      } : {})
    });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'You have already submitted for this day.' });
    }
    console.error('submitHabit failed:', err);
    res.status(500).json({ message: 'Habit submission failed' });
  }
};


// ── POST /api/habits/submit-meal ─────────────────────────────────────────────
exports.submitMeal = async (req, res) => {
  const meal  = req.body.meal;
  const value = String(req.body.value || '').trim();

  if (!['breakfast', 'lunch', 'dinner'].includes(meal)) {
    return res.status(400).json({ message: 'Invalid meal type.' });
  }
  if (!value) {
    return res.status(400).json({ message: `${meal} details are required.` });
  }

  try {
    const user        = await User.findOne({ phone: req.user.phone }).lean();
    const expectedDay = getExpectedDayNumber(user?.startedAt || null);

    if (expectedDay === null) {
      return res.status(400).json({ message: 'Your 7-day submission window has closed.' });
    }

    const lastEntry     = await Habit.findOne({ phone: req.user.phone }).sort({ dayNumber: -1 }).lean();
    const lastStoredDay = lastEntry ? lastEntry.dayNumber : 0;

    // Check if today's partial entry already exists for expectedDay
    const todayHabit = await Habit.findOne({
      phone:     req.user.phone,
      dayNumber: expectedDay
    });

    // Block if the day is fully complete (all 3 meals done)
    const dayFullyDone = todayHabit &&
      todayHabit.breakfast && todayHabit.lunch && todayHabit.dinner;

    if (dayFullyDone) {
      return res.status(400).json({
        message: `Day ${expectedDay} is already complete. Come back tomorrow for Day ${expectedDay + 1}.`
      });
    }

    // Block if trying to go to a previous completed day
    if (expectedDay < lastStoredDay) {
      return res.status(400).json({
        message: `Come back tomorrow for Day ${lastStoredDay + 1}.`
      });
    }

    // Block if this specific meal is already saved today
    if (todayHabit && todayHabit[meal]) {
      return res.status(400).json({ message: `${meal} already saved for today.` });
    }

    let habit;

    if (todayHabit) {
      // ── Update existing partial entry with this meal ──
      todayHabit[meal] = value;

      // If all 3 meals now done, combine into foodDetails for LLM
      if (todayHabit.breakfast && todayHabit.lunch && todayHabit.dinner) {
        todayHabit.foodDetails = `Breakfast: ${todayHabit.breakfast} | Lunch: ${todayHabit.lunch} | Dinner: ${todayHabit.dinner}`;
      }

      habit = await todayHabit.save();

    } else {
      // ── Create new entry with just this meal ──
      habit = await Habit.create({
        phone:     req.user.phone,
        dayNumber: expectedDay,
        [meal]:    value
      });

      // Set startedAt + reportUnlockAt on the very first meal of Day 1
      if (expectedDay === 1 && !user?.startedAt) {
        const startMidnight  = toMidnightUTC();
        const unlockMidnight = new Date(startMidnight.getTime() + 7 * 24 * 60 * 60 * 1000);
        await User.findOneAndUpdate(
          { phone: req.user.phone },
          { $set: { startedAt: startMidnight, reportUnlockAt: unlockMidnight } }
        );
      }
    }

    const allMealsDone = !!(habit.breakfast && habit.lunch && habit.dinner);

    return res.status(201).json({
      message: allMealsDone
        ? `Day ${expectedDay} complete! All meals logged.`
        : `${meal.charAt(0).toUpperCase() + meal.slice(1)} saved!`,
      habit,
      allMealsDone
    });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Entry already exists for this day.' });
    }
    console.error('submitMeal failed:', err);
    res.status(500).json({ message: 'Meal submission failed' });
  }
};


// ── POST /api/habits/generate-analysis ──────────────────────────────────────
exports.processAnalysis = async (req, res) => {
  try {
    const user   = await User.findOne({ phone: req.user.phone }).lean();
    const habits = await Habit.find({ phone: req.user.phone }).sort({ dayNumber: 1 }).lean();

    // 1. Validate: 7 entries must exist
    if (habits.length < 7) {
      return res.status(400).json({
        message: `Only ${habits.length}/7 days submitted. Complete all 7 days first.`
      });
    }

    // 2. Validate: reportUnlockAt must have passed
    const reportUnlockAt = user?.reportUnlockAt;
    if (!reportUnlockAt) {
      return res.status(400).json({ message: 'Tracking window not started properly.' });
    }
    if (new Date() < new Date(reportUnlockAt)) {
      const unlockDate = new Date(reportUnlockAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata'
      });
      return res.status(403).json({
        message: `Your report will be available on ${unlockDate} after all 7 days are complete.`,
        reportUnlockAt
      });
    }

    // 3. Return cached report
    if (user?.finalReport) {
      return res.json({ analysis: user.finalReport, cached: true });
    }

    // 4. Build summary and call LLM
    const details = user?.basicDetails || {};
    const summary = [
      `Customer phone: ${req.user.phone}`,
      `Basic details: ${JSON.stringify(details)}`,
      '7-day food habit diary:',
      ...habits.map((h) => `Day ${h.dayNumber} (${new Date(h.dateSubmitted).toLocaleDateString('en-IN')}):
  Breakfast: ${h.breakfast || 'N/A'}
  Lunch: ${h.lunch || 'N/A'}
  Dinner: ${h.dinner || 'N/A'}`)
    ].join('\n');

    const analysis = await generateLLMAnalysis(summary);

    // 5. Persist the report
    await User.findOneAndUpdate(
      { phone: req.user.phone },
      { finalReport: analysis, reportGeneratedAt: new Date() }
    );

    res.json({ analysis });

  } catch (err) {
    console.error('Analysis failed:', err);
    res.status(500).json({ message: 'AI analysis failed', error: err.message });
  }
};