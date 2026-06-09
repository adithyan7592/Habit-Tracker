const Habit  = require('../models/habit');
const User   = require('../models/user');
const { generateLLMAnalysis } = require('../utils/llmHelper');

// ── Helper: midnight UTC of a given date ────────────────────────────────────
const toMidnightUTC = (date = new Date()) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

// ── Helper: compute expected day within current week ─────────────────────────
const getExpectedDayInWeek = (weekStartedAt) => {
  if (!weekStartedAt) return 1;
  const start         = toMidnightUTC(weekStartedAt);
  const todayMidnight = toMidnightUTC();
  const diffDays      = Math.floor((todayMidnight - start) / (1000 * 60 * 60 * 24));
  return Math.min(diffDays + 1, 7);
};

// ── Helper: check if week has expired (7+ days since weekStartedAt) ──────────
const isWeekExpired = (weekStartedAt) => {
  if (!weekStartedAt) return false;
  const start         = toMidnightUTC(weekStartedAt);
  const todayMidnight = toMidnightUTC();
  return (todayMidnight - start) >= 7 * 24 * 60 * 60 * 1000;
};


// ── GET /api/habits/status ───────────────────────────────────────────────────
exports.getStatus = async (req, res) => {
  try {
    const user = await User.findOne({ phone: req.user.phone }).lean();

    const currentWeek    = user?.currentWeek    || 1;
    const weekStartedAt  = user?.weekStartedAt  || null;

    // Get all entries sorted
    const allEntries = await Habit.find({ phone: req.user.phone })
      .sort({ weekNumber: 1, dayNumber: 1 }).lean();

    // Current week entries only
    const weekEntries = allEntries.filter(e => (e.weekNumber || 1) === currentWeek);

    // Expected day calculation
    const expectedDay = getExpectedDayInWeek(weekStartedAt);
    const weekExpired = isWeekExpired(weekStartedAt);

    // Today's entry check (UTC safe)
    const todayMidnight    = toMidnightUTC();
    const tomorrowMidnight = new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000);
    const todayEntry = weekEntries.find(e =>
      new Date(e.dateSubmitted) >= todayMidnight &&
      new Date(e.dateSubmitted) < tomorrowMidnight
    );

    // Count only fully completed days
    const daysCompleted = weekEntries.filter(
      e => e.breakfast && e.lunch && e.dinner
    ).length;

    const currentWeekReport = user?.weekReports?.find(
      r => r.weekNumber === currentWeek
    ) || null;

    res.json({
      phone:             req.user.phone,
      currentWeek,
      daysCompleted,
      entries:           weekEntries,
      allEntries,
      basicDetails:      user?.basicDetails || {},
      weekReports:       user?.weekReports  || [],
      currentWeekReport,
      weekStartedAt,
      expectedDay,
      weekExpired,
      todayEntry:        todayEntry || null,
      submittedToday:    !!todayEntry,
      // backward compat for old frontend references
      finalReport:       user?.finalReport        || null,
      reportGeneratedAt: user?.reportGeneratedAt  || null,
      startedAt:         user?.startedAt          || null,
      reportUnlockAt:    user?.reportUnlockAt      || null,
      windowExpired:     weekExpired,
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
// Legacy route kept for backward compatibility
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
    let currentWeek   = user?.currentWeek   || 1;
    let weekStartedAt = user?.weekStartedAt || null;

    // Auto-advance week if expired and report generated
    if (weekStartedAt && isWeekExpired(weekStartedAt)) {
      const thisWeekReport = user?.weekReports?.find(r => r.weekNumber === currentWeek);
      if (thisWeekReport) {
        currentWeek   = currentWeek + 1;
        weekStartedAt = toMidnightUTC();
        await User.findOneAndUpdate(
          { phone: req.user.phone },
          { $set: { currentWeek, weekStartedAt } }
        );
      }
    }

    const expectedDay = getExpectedDayInWeek(weekStartedAt);

    const lastEntry = await Habit.findOne({
      phone: req.user.phone, weekNumber: currentWeek
    }).sort({ dayNumber: -1 }).lean();
    const lastStoredDay = lastEntry ? lastEntry.dayNumber : 0;
    const nextExpected  = lastStoredDay + 1;

    if (expectedDay < nextExpected) {
      return res.status(400).json({
        message: `You have already submitted Day ${lastStoredDay}. Come back tomorrow for Day ${nextExpected}.`
      });
    }

    const isFirstEntry = nextExpected === 1 && !weekStartedAt;
    const userUpdate   = {};
    if (isFirstEntry) {
      userUpdate.weekStartedAt = toMidnightUTC();
      userUpdate.currentWeek   = 1;
    }

    const [habit] = await Promise.all([
      Habit.create({
        phone: req.user.phone, weekNumber: currentWeek,
        dayNumber: nextExpected, breakfast, lunch, dinner, foodDetails
      }),
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
    const user = await User.findOne({ phone: req.user.phone }).lean();
    let currentWeek   = user?.currentWeek   || 1;
    let weekStartedAt = user?.weekStartedAt || null;

    // ── Auto-advance to next week if expired and report generated ─────────
    if (weekStartedAt && isWeekExpired(weekStartedAt)) {
      const thisWeekReport = user?.weekReports?.find(r => r.weekNumber === currentWeek);
      if (thisWeekReport) {
        currentWeek   = currentWeek + 1;
        weekStartedAt = toMidnightUTC();
        await User.findOneAndUpdate(
          { phone: req.user.phone },
          { $set: { currentWeek, weekStartedAt } }
        );
      }
    }

    const expectedDay = getExpectedDayInWeek(weekStartedAt);

    // Check today's habit for this week
    const todayHabit = await Habit.findOne({
      phone:      req.user.phone,
      weekNumber: currentWeek,
      dayNumber:  expectedDay
    });

    // Block if day fully complete
    const dayFullyDone = todayHabit &&
      todayHabit.breakfast && todayHabit.lunch && todayHabit.dinner;

    if (dayFullyDone) {
      return res.status(400).json({
        message: `Day ${expectedDay} is already complete. Come back tomorrow for Day ${expectedDay + 1}.`
      });
    }

    // Block if this meal already saved
    if (todayHabit && todayHabit[meal]) {
      return res.status(400).json({ message: `${meal} already saved for today.` });
    }

    let habit;

    if (todayHabit) {
      // Update existing partial entry
      todayHabit[meal] = value;
      if (todayHabit.breakfast && todayHabit.lunch && todayHabit.dinner) {
        todayHabit.foodDetails = `Breakfast: ${todayHabit.breakfast} | Lunch: ${todayHabit.lunch} | Dinner: ${todayHabit.dinner}`;
      }
      habit = await todayHabit.save();
    } else {
      // Create new entry
      habit = await Habit.create({
        phone:      req.user.phone,
        weekNumber: currentWeek,
        dayNumber:  expectedDay,
        [meal]:     value
      });

      // Set weekStartedAt on very first meal ever
      if (!weekStartedAt) {
        await User.findOneAndUpdate(
          { phone: req.user.phone },
          { $set: { weekStartedAt: toMidnightUTC(), currentWeek: 1 } }
        );
        weekStartedAt = toMidnightUTC();
      }
    }

    const allMealsDone = !!(habit.breakfast && habit.lunch && habit.dinner);

    // Recalculate reportUnlockAt dynamically
    if (allMealsDone) {
      const totalSubmitted = await Habit.countDocuments({
        phone:      req.user.phone,
        weekNumber: currentWeek,
        breakfast:  { $ne: '' },
        lunch:      { $ne: '' },
        dinner:     { $ne: '' }
      });
      const remainingDays = 7 - totalSubmitted;
      if (remainingDays > 0) {
        const newUnlockAt = new Date(toMidnightUTC().getTime() + remainingDays * 24 * 60 * 60 * 1000);
        await User.findOneAndUpdate(
          { phone: req.user.phone },
          { $set: { reportUnlockAt: newUnlockAt } }
        );
      }
    }

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
    const user        = await User.findOne({ phone: req.user.phone }).lean();
    const currentWeek = user?.currentWeek || 1;
    const weekStartedAt = user?.weekStartedAt || null;

    // Must have started
    if (!weekStartedAt) {
      return res.status(400).json({ message: 'Start submitting meals first.' });
    }

    // Check if report already generated for this week
    const existingReport = user?.weekReports?.find(r => r.weekNumber === currentWeek);
    if (existingReport) {
      return res.json({ analysis: existingReport.report, cached: true, weekNumber: currentWeek });
    }

    // Week must have expired OR all 7 days submitted
    const weekDiff = Math.floor(
      (toMidnightUTC() - toMidnightUTC(weekStartedAt)) / (1000 * 60 * 60 * 24)
    );
    const habits = await Habit.find({
      phone: req.user.phone, weekNumber: currentWeek
    }).sort({ dayNumber: 1 }).lean();

    const completeDays = habits.filter(h => h.breakfast && h.lunch && h.dinner).length;

    if (weekDiff < 7 && completeDays < 7) {
      return res.status(403).json({
        message: `Report unlocks after 7 days. ${7 - weekDiff} day${7 - weekDiff > 1 ? 's' : ''} remaining.`
      });
    }

    // Build summary — all 7 days, mark missing ones
    const details = user?.basicDetails || {};
    const allDays = Array.from({ length: 7 }, (_, i) => {
      const day = habits.find(h => h.dayNumber === i + 1);
      if (day && day.breakfast && day.lunch && day.dinner) {
        return `Day ${i + 1}: Breakfast: ${day.breakfast} | Lunch: ${day.lunch} | Dinner: ${day.dinner}`;
      }
      return `Day ${i + 1}: Not submitted`;
    });

    const summary = [
      `Customer phone: ${req.user.phone}`,
      `Week number: ${currentWeek}`,
      `Basic details: ${JSON.stringify(details)}`,
      `Week ${currentWeek} food habit diary:`,
      ...allDays
    ].join('\n');

    const analysis = await generateLLMAnalysis(summary);

    // Save report and advance to next week
    const nextWeek         = currentWeek + 1;
    const nextWeekStartsAt = toMidnightUTC();

    await User.findOneAndUpdate(
      { phone: req.user.phone },
      {
        $push: {
          weekReports: {
            weekNumber:    currentWeek,
            report:        analysis,
            generatedAt:   new Date(),
            daysSubmitted: completeDays
          }
        },
        $set: {
          currentWeek:   nextWeek,
          weekStartedAt: nextWeekStartsAt,
          // also update legacy fields for backward compat
          finalReport:       analysis,
          reportGeneratedAt: new Date(),
          reportUnlockAt:    new Date(nextWeekStartsAt.getTime() + 7 * 24 * 60 * 60 * 1000)
        }
      }
    );

    res.json({ analysis, weekNumber: currentWeek });

  } catch (err) {
    console.error('Analysis failed:', err);
    res.status(500).json({ message: 'AI analysis failed', error: err.message });
  }
};