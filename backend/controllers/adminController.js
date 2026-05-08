const Habit = require('../models/habit');
const User = require('../models/user');
const { Parser } = require('json2csv');

exports.getAllUsersData = async (req, res) => {
  try {
    const users = await User.find({}, 'phone role basicDetails finalReport reportGeneratedAt createdAt').sort({ phone: 1 }).lean();
    const habits = await Habit.find({}).sort({ phone: 1, dayNumber: 1 }).lean();

    const habitsByPhone = habits.reduce((acc, habit) => {
      acc[habit.phone] ||= [];
      acc[habit.phone].push(habit);
      return acc;
    }, {});

    const data = users.map((user) => ({
      ...user,
      entries: habitsByPhone[user.phone] || [],
      daysCompleted: (habitsByPhone[user.phone] || []).length
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load admin data' });
  }
};

exports.downloadCSV = async (req, res) => {
  try {
    const users = await User.find({}, 'phone basicDetails finalReport reportGeneratedAt').lean();
    const habits = await Habit.find({}).sort({ phone: 1, dayNumber: 1 }).lean();
    const usersByPhone = Object.fromEntries(users.map((u) => [u.phone, u]));

    const rows = habits.map((h) => {
      const u = usersByPhone[h.phone] || {};
      return {
        phone: h.phone,
        name: u.basicDetails?.name || '',
        age: u.basicDetails?.age || '',
        gender: u.basicDetails?.gender || '',
        heightCm: u.basicDetails?.heightCm || '',
        weightKg: u.basicDetails?.weightKg || '',
        healthGoal: u.basicDetails?.healthGoal || '',
        medicalNotes: u.basicDetails?.medicalNotes || '',
        dayNumber: h.dayNumber,
        foodDetails: h.foodDetails,
        dateSubmitted: h.dateSubmitted,
        finalReport: u.finalReport || '',
        reportGeneratedAt: u.reportGeneratedAt || ''
      };
    });

    const fields = [
      'phone', 'name', 'age', 'gender', 'heightCm', 'weightKg', 'healthGoal', 'medicalNotes',
      'dayNumber', 'foodDetails', 'dateSubmitted', 'finalReport', 'reportGeneratedAt'
    ];
    const csv = new Parser({ fields }).parse(rows);

    res.header('Content-Type', 'text/csv');
    res.attachment('food_habits_report.csv');
    res.send(csv);
  } catch (err) {
    console.error('CSV failed:', err);
    res.status(500).json({ message: 'CSV generation failed' });
  }
};
