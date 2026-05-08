const express = require('express');
const router = express.Router();
const habitController = require('../controllers/habitController');
const auth = require('../middleware/authMiddleware');

router.get('/status', auth, habitController.getStatus);
router.put('/basic-details', auth, habitController.saveBasicDetails);
router.post('/submit', auth, habitController.submitHabit);
router.post('/generate-analysis', auth, habitController.processAnalysis);

module.exports = router;
