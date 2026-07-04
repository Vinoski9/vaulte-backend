const express = require('express')
const router = express.Router()
const protect = require('../middleware/auth')
const isAdmin = require('../middleware/isAdmin')
const { getTransactions, createTransaction, getAllTransactions, updateTransactionStatus, getDashboardStats } = require('../controllers/transactionController')

router.get('/stats', protect, getDashboardStats)
router.get('/', protect, getTransactions)
router.post('/', protect, createTransaction)

// Admin routes
router.get('/admin/all', protect, isAdmin, getAllTransactions)
router.patch('/admin/:id', protect, isAdmin, updateTransactionStatus)

module.exports = router