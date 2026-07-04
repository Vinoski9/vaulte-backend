const express = require('express')
const router = express.Router()
const protect = require('../middleware/auth')
const isAdmin = require('../middleware/isAdmin')
const { getRates, getRateById, updateRate, toggleRate, getMarketSummary } = require('../controllers/ratesController')

// Public routes
router.get('/', getRates)
router.get('/market-summary', getMarketSummary) // For landing page
router.get('/:id', getRateById)

// Admin only routes
router.patch('/:id', protect, isAdmin, updateRate)
router.patch('/:id/toggle', protect, isAdmin, toggleRate)

module.exports = router