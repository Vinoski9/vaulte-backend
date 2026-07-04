const express = require('express')
const router = express.Router()
const pool = require('../config/db')
const protect = require('../middleware/auth')

// Generate referral code
const generateReferralCode = (userId) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `VLT${code}${userId.toString().padStart(3, '0')}`
}

// GET /api/referrals/generate
router.get('/generate', protect, async (req, res) => {
  try {
    const userId = req.user.id
    const existing = await pool.query(
      'SELECT referral_code FROM users WHERE id = $1',
      [userId]
    )
    if (existing.rows[0]?.referral_code) {
      return res.json({ referral_code: existing.rows[0].referral_code })
    }
    const referralCode = generateReferralCode(userId)
    await pool.query(
      'UPDATE users SET referral_code = $1 WHERE id = $2',
      [referralCode, userId]
    )
    res.json({ referral_code: referralCode })
  } catch (error) {
    console.error('Generate referral error:', error)
    res.status(500).json({ error: 'Failed to generate referral code' })
  }
})

// POST /api/referrals/validate
router.post('/validate', async (req, res) => {
  const { referral_code } = req.body
  if (!referral_code) {
    return res.status(400).json({ error: 'Referral code is required' })
  }
  try {
    const result = await pool.query(
      'SELECT id, full_name FROM users WHERE referral_code = $1',
      [referral_code.toUpperCase()]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid referral code' })
    }
    res.json({ 
      valid: true, 
      referrer_id: result.rows[0].id,
      referrer_name: result.rows[0].full_name 
    })
  } catch (error) {
    console.error('Validate referral error:', error)
    res.status(500).json({ error: 'Failed to validate referral code' })
  }
})

// POST /api/referrals/track
router.post('/track', protect, async (req, res) => {
  const { referral_code } = req.body
  const refereeId = req.user.id
  if (!referral_code) {
    return res.status(400).json({ error: 'Referral code is required' })
  }
  try {
    const referrerResult = await pool.query(
      'SELECT id FROM users WHERE referral_code = $1',
      [referral_code.toUpperCase()]
    )
    if (referrerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid referral code' })
    }
    const referrerId = referrerResult.rows[0].id
    if (referrerId === refereeId) {
      return res.status(400).json({ error: 'You cannot refer yourself' })
    }
    const existing = await pool.query(
      'SELECT id FROM referrals WHERE referee_id = $1',
      [refereeId]
    )
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'You have already been referred' })
    }
    await pool.query(
      `INSERT INTO referrals (referrer_id, referee_id, status)
       VALUES ($1, $2, 'pending')`,
      [referrerId, refereeId]
    )
    await pool.query(
      'UPDATE users SET referral_count = referral_count + 1 WHERE id = $1',
      [referrerId]
    )
    await pool.query(
      'UPDATE users SET referred_by = $1 WHERE id = $2',
      [referrerId, refereeId]
    )
    res.json({ 
      message: 'Referral tracked successfully',
      referrer_id: referrerId
    })
  } catch (error) {
    console.error('Track referral error:', error)
    res.status(500).json({ error: 'Failed to track referral' })
  }
})

// GET /api/referrals/stats
router.get('/stats', protect, async (req, res) => {
  try {
    const userId = req.user.id
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_referrals,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_referrals,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_referrals,
        COALESCE(SUM(reward_amount), 0) as total_earnings
       FROM referrals 
       WHERE referrer_id = $1`,
      [userId]
    )
    const userResult = await pool.query(
      'SELECT referral_code, referral_count, referral_earnings FROM users WHERE id = $1',
      [userId]
    )
    res.json({
      stats: result.rows[0],
      referral_code: userResult.rows[0]?.referral_code || null,
      referral_count: userResult.rows[0]?.referral_count || 0,
      referral_earnings: userResult.rows[0]?.referral_earnings || 0
    })
  } catch (error) {
    console.error('Referral stats error:', error)
    res.status(500).json({ error: 'Failed to fetch referral stats' })
  }
})

// GET /api/referrals/history
router.get('/history', protect, async (req, res) => {
  try {
    const userId = req.user.id
    const result = await pool.query(
      `SELECT 
        r.*,
        u.full_name as referee_name,
        u.email as referee_email,
        u.created_at as referee_joined
       FROM referrals r
       JOIN users u ON r.referee_id = u.id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Referral history error:', error)
    res.status(500).json({ error: 'Failed to fetch referral history' })
  }
})

// GET /api/referrals/admin/all (admin only)
router.get('/admin/all', protect, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        r.*,
        ru.full_name as referrer_name,
        ru.email as referrer_email,
        re.full_name as referee_name,
        re.email as referee_email
       FROM referrals r
       JOIN users ru ON r.referrer_id = ru.id
       JOIN users re ON r.referee_id = re.id
       ORDER BY r.created_at DESC`
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Admin referrals error:', error)
    res.status(500).json({ error: 'Failed to fetch referrals' })
  }
})

module.exports = router