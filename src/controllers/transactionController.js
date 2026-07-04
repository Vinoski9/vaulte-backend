const pool = require('../config/db')
const paystackTransfer = require('../config/paystack')

const BANK_CODES = {
  'Access Bank': '044',
  'GTBank': '058',
  'First Bank': '011',
  'Zenith Bank': '057',
  'UBA': '033',
  'Fidelity Bank': '070',
  'Sterling Bank': '232',
  'Kuda Bank': '090267',
  'Opay': '100004',
  'Palmpay': '100033',
  'Moniepoint': '090405',
  'Stanbic IBTC': '221',
  'Union Bank': '032',
  'Wema Bank': '035',
  'Polaris Bank': '076',
  'Ecobank': '050'
}

const getTransactions = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
}

const createTransaction = async (req, res) => {
  const { card_name, card_value, card_code, naira_value } = req.body
  try {
    const result = await pool.query(
      'INSERT INTO transactions (user_id, card_name, card_value, card_code, naira_value, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.user.id, card_name, card_value, card_code, naira_value, 'pending']
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error('Transaction error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
}

const getAllTransactions = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT t.*, u.full_name, u.email FROM transactions t JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC'
    )
    res.json(result.rows)
  } catch (err) {
    console.error('Admin fetch error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
}


const updateTransactionStatus = async (req, res) => {
  const { id } = req.params
  const { status } = req.body
  try {
    // Get transaction and user bank details
    const txResult = await pool.query(
      'SELECT t.*, u.bank_name, u.account_number, u.account_name FROM transactions t JOIN users u ON t.user_id = u.id WHERE t.id = $1',
      [id]
    )
    const tx = txResult.rows[0]

    if (!tx) return res.status(404).json({ error: 'Transaction not found' })

    // Update status
    const result = await pool.query(
      'UPDATE transactions SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    )

    // If approving, trigger Paystack payout
    if (status === 'completed') {
      if (!tx.account_number || !tx.bank_name) {
        return res.status(400).json({ error: 'User has no bank details saved' })
      }
      const bankCode = BANK_CODES[tx.bank_name]
      if (!bankCode) {
        return res.status(400).json({ error: 'Bank not supported' })
      }
      const payout = await paystackTransfer(
        tx.naira_value,
        tx.account_number,
        bankCode,
        tx.account_name,
        `Vaulte gift card payout - TXN-${tx.id}`
      )
      console.log('Paystack payout:', payout)
    }

    res.json(result.rows[0])
  } catch (err) {
    console.error('Status update error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
}

const getDashboardStats = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        COALESCE(SUM(naira_value) FILTER (WHERE status = 'completed'), 0) as total_earned,
        COALESCE(SUM(naira_value) FILTER (WHERE status = 'pending'), 0) as pending_value,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) as total_trades
      FROM transactions WHERE user_id = $1`,
      [req.user.id]
    )
    res.json(result.rows[0])
  } catch (err) {
    console.error('Stats error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
}

module.exports = { getTransactions, createTransaction, getAllTransactions, updateTransactionStatus, getDashboardStats }