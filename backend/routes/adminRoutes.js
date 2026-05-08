const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/authMiddleware');
const adminOnly = require('../middleware/adminOnly');

router.get('/all-data', auth, adminOnly, adminController.getAllUsersData);
router.get('/download-csv', auth, adminOnly, adminController.downloadCSV);

module.exports = router;
