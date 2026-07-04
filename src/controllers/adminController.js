const pool = require('../config/db')

// GET /api/admin/summary
// Returns real counts/sums from the database for the admin dashboard top cards.
const getSummary = async (req, res) => {
  try {
    const usersResult = await pool.query('SELECT COUNT(*) AS total_users FROM users')

    const volumeResult = await pool.query(
      `SELECT COALESCE(SUM(naira_value), 0) AS total_volume
       FROM transactions
       WHERE status = 'completed'`
    )

    const todayTradesResult = await pool.query(
      `SELECT COUNT(*) AS today_trades
       FROM transactions
       WHERE created_at >= CURRENT_DATE
         AND created_at < CURRENT_DATE + INTERVAL '1 day'`
    )

    // "Active users" = distinct users who made a transaction in the last 24 hours
    const activeUsersResult = await pool.query(
      `SELECT COUNT(DISTINCT user_id) AS active_users
       FROM transactions
       WHERE created_at >= NOW() - INTERVAL '24 hours'`
    )

    res.json({
      totalUsers: parseInt(usersResult.rows[0].total_users, 10),
      totalVolume: parseFloat(volumeResult.rows[0].total_volume),
      todayTrades: parseInt(todayTradesResult.rows[0].today_trades, 10),
      activeUsers: parseInt(activeUsersResult.rows[0].active_users, 10)
    })
  } catch (err) {
    console.error('Admin summary error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
}

module.exports = { getSummary }