const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const pool = require('../config/db')
const { sendVerificationEmail } = require('../config/email')

// Generate a unique referral code
const generateReferralCode = (userId) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `VLT${code}${userId.toString().padStart(3, '0')}`
}

// Generate verification token
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex')
}

// REGISTER - With email verification (5 minutes expiry)
const register = async (req, res) => {
  const { email, password, full_name, referral_code } = req.body
  
  try {
    // Check if user exists
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' })
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 12)
    
    // Generate verification token
    const verificationToken = generateVerificationToken()
    const tokenExpires = new Date(Date.now() + 5 * 60 * 1000) // 5 MINUTES

    // Create user (unverified)
    const result = await pool.query(
      `INSERT INTO users (email, password, full_name, is_verified, verification_token, verification_token_expires) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, email, full_name, role, is_verified`,
      [email, hashed, full_name, false, verificationToken, tokenExpires]
    )
    
    const user = result.rows[0]
    const userId = user.id

    // Generate referral code
    const newUserReferralCode = generateReferralCode(userId)
    await pool.query(
      'UPDATE users SET referral_code = $1 WHERE id = $2',
      [newUserReferralCode, userId]
    )
    user.referral_code = newUserReferralCode

    // Handle referral if provided
    if (referral_code) {
      const referrerResult = await pool.query(
        'SELECT id FROM users WHERE referral_code = $1',
        [referral_code.toUpperCase()]
      )

      if (referrerResult.rows.length > 0) {
        const referrerId = referrerResult.rows[0].id
        if (referrerId !== userId) {
          const existingReferral = await pool.query(
            'SELECT id FROM referrals WHERE referee_id = $1',
            [userId]
          )
          if (existingReferral.rows.length === 0) {
            await pool.query(
              `INSERT INTO referrals (referrer_id, referee_id, status)
               VALUES ($1, $2, 'pending')`,
              [referrerId, userId]
            )
            await pool.query(
              'UPDATE users SET referral_count = referral_count + 1 WHERE id = $1',
              [referrerId]
            )
            await pool.query(
              'UPDATE users SET referred_by = $1 WHERE id = $2',
              [referrerId, userId]
            )
          }
        }
      }
    }

    // Respond to the client immediately — don't make them wait on SMTP.
    res.status(201).json({
      message: 'Registration successful! Please check your email to verify your account. Link expires in 5 minutes.',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        is_verified: false
      }
    })

    // Send verification email in the background. If it fails, log it —
    // the user can still request a resend from the login/verify screens.
    sendVerificationEmail(email, full_name, verificationToken).catch((err) => {
      console.error('Failed to send verification email:', err.message)
    })
    
  } catch (err) {
    console.error('Register error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
}

// ✅ VERIFY EMAIL - COMPLETE WORKING VERSION
const verifyEmail = async (req, res) => {
  const { token } = req.params
  
  try {
    console.log('🔍 Verifying token:', token)
    
    // Find user with this token
    const result = await pool.query(
      `SELECT id, email, full_name, is_verified, verification_token_expires, role 
       FROM users 
       WHERE verification_token = $1`,
      [token]
    )
    
    console.log('👤 User found:', result.rows.length > 0)
    
    if (result.rows.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid or expired verification token' 
      })
    }
    
    const user = result.rows[0]
    
    // ✅ If user is already verified, return SUCCESS
    if (user.is_verified === true) {
      console.log('✅ User already verified:', user.email)
      
      const jwtToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role || 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      )
      
      return res.status(200).json({
        success: true,
        message: 'Email already verified!',
        token: jwtToken,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          is_verified: true,
          role: user.role || 'user'
        }
      })
    }
    
    // Check if token expired
    const now = new Date()
    const expires = new Date(user.verification_token_expires)
    
    if (now > expires) {
      return res.status(400).json({ 
        success: false,
        error: 'Verification link has expired. Please request a new one.' 
      })
    }
    
    // ✅ Verify user
    await pool.query(
      `UPDATE users 
       SET is_verified = true, 
           verification_token = NULL, 
           verification_token_expires = NULL 
       WHERE id = $1`,
      [user.id]
    )
    
    console.log(`✅ User verified: ${user.email}`)
    
    // Generate JWT for auto-login
    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role || 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )
    
    // ✅ RETURN SUCCESS
    res.status(200).json({
      success: true,
      message: 'Email verified successfully!',
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        is_verified: true,
        role: user.role || 'user'
      }
    })
    
  } catch (err) {
    console.error('❌ Verify email error:', err.message)
    res.status(500).json({ 
      success: false,
      error: 'Server error. Please try again.' 
    })
  }
}

// RESEND VERIFICATION EMAIL
const resendVerification = async (req, res) => {
  const { email } = req.body
  
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, is_verified FROM users WHERE email = $1',
      [email]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    const user = result.rows[0]
    
    if (user.is_verified) {
      return res.status(400).json({ error: 'Email already verified' })
    }
    
    // Generate new token (5 minutes expiry)
    const verificationToken = generateVerificationToken()
    const tokenExpires = new Date(Date.now() + 5 * 60 * 1000)
    
    await pool.query(
      `UPDATE users 
       SET verification_token = $1, verification_token_expires = $2 
       WHERE id = $3`,
      [verificationToken, tokenExpires, user.id]
    )
    
    // Respond immediately — don't make the client wait on SMTP.
    res.json({ message: 'Verification email resent successfully' })

    // Send in the background.
    sendVerificationEmail(email, user.full_name, verificationToken).catch((err) => {
      console.error('Failed to resend verification email:', err.message)
    })
    
  } catch (err) {
    console.error('Resend verification error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
}

// LOGIN
const login = async (req, res) => {
  const { email, password } = req.body
  
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' })
    }
    
    const user = result.rows[0]
    
    // Check if email is verified
    if (!user.is_verified) {
      return res.status(403).json({ 
        error: 'Please verify your email before logging in',
        needsVerification: true,
        email: user.email
      })
    }

    if (!user.referral_code) {
      const referralCode = generateReferralCode(user.id)
      await pool.query(
        'UPDATE users SET referral_code = $1 WHERE id = $2',
        [referralCode, user.id]
      )
      user.referral_code = referralCode
    }

    const match = await bcrypt.compare(password, user.password)
    if (!match) {
      return res.status(400).json({ error: 'Invalid credentials' })
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        referral_code: user.referral_code,
        is_verified: user.is_verified
      }
    })
    
  } catch (err) {
    console.error('Login error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
}

// UPDATE BANK DETAILS
const updateBankDetails = async (req, res) => {
  const { bank_name, account_number, account_name } = req.body
  try {
    await pool.query(
      'UPDATE users SET bank_name = $1, account_number = $2, account_name = $3 WHERE id = $4',
      [bank_name, account_number, account_name, req.user.id]
    )
    res.json({ message: 'Bank details updated' })
  } catch (err) {
    console.error('Bank update error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
}

// GET BANK DETAILS
const getBankDetails = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT bank_name, account_number, account_name FROM users WHERE id = $1',
      [req.user.id]
    )
    res.json(result.rows[0])
  } catch (err) {
    console.error('Get bank details error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
}

// CHANGE PASSWORD
const changePassword = async (req, res) => {
  const { old_password, new_password } = req.body
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id])
    const user = result.rows[0]

    const match = await bcrypt.compare(old_password, user.password)
    if (!match) {
      return res.status(400).json({ error: 'Current password is incorrect' })
    }

    const hashed = await bcrypt.hash(new_password, 12)
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id])

    res.json({ message: 'Password updated successfully' })
  } catch (err) {
    console.error('Change password error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
}

module.exports = { 
  register, 
  login, 
  verifyEmail,
  resendVerification,
  updateBankDetails, 
  getBankDetails, 
  changePassword 
}