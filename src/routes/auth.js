const express = require('express')
const router = express.Router()
const protect = require('../middleware/auth')
const { 
  register, 
  login, 
  verifyEmail,
  resendVerification,
  updateBankDetails, 
  getBankDetails, 
  changePassword 
} = require('../controllers/authController')

// Public routes
router.post('/register', register)
router.post('/login', login)
router.get('/verify/:token', verifyEmail)
router.post('/resend-verification', resendVerification)

// Protected routes
router.put('/bank-details', protect, updateBankDetails)
router.get('/bank-details', protect, getBankDetails)
router.put('/change-password', protect, changePassword)

module.exports = router