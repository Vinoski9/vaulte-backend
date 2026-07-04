const express = require('express')
const router = express.Router()
const protect = require('../middleware/auth')
const isAdmin = require('../middleware/isAdmin')
const { getSummary } = require('../controllers/adminController')

// Admin only — dashboard summary stats
router.get('/summary', protect, isAdmin, getSummary)

module.exports = router