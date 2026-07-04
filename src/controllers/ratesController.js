const pool = require('../config/db')
const axios = require('axios')

// Get real market rate for USD/NGN
const getMarketRate = async () => {
  try {
    // Try multiple sources for reliability
    const sources = [
      'https://api.exchangerate-api.com/v4/latest/USD',
      'https://api.ratesapi.io/api/latest?base=USD&symbols=NGN'
    ]
    
    for (const url of sources) {
      try {
        const response = await axios.get(url, { timeout: 5000 })
        if (response.data.rates && response.data.rates.NGN) {
          return Math.round(response.data.rates.NGN)
        }
      } catch (e) {
        console.log('Source failed, trying next...')
      }
    }
    
    // Fallback: use your fixed base rate
    return 1280 // Your market rate
  } catch (err) {
    console.error('Error fetching market rate:', err.message)
    return 1280 // Fallback
  }
}

// Get rates with Vaulte logic: Market Rate - ₦100
const getRates = async (req, res) => {
  try {
    // Get current market rate (USD/NGN)
    const marketRate = await getMarketRate()
    
    // Vaulte rate = Market rate - ₦100
    const vaulteRate = marketRate - 100
    
    console.log(`📊 Market Rate: ₦${marketRate}, Vaulte Rate: ₦${vaulteRate}`)

    // Get gift card rates from database
    const result = await pool.query(
      'SELECT * FROM rates WHERE is_active = true ORDER BY category, card_name'
    )
    
    // Apply Vaulte rate to all gift cards
    // Each card keeps its rate as a base percentage of the Vaulte rate
    const rates = result.rows.map(rate => {
      // Calculate percentage based on original rate
      // This preserves the relative value between different cards
      const baseRate = 1180 // Your original Vaulte rate
      const percentage = rate.rate / baseRate
      const adjustedRate = Math.round(vaulteRate * percentage)
      
      return {
        ...rate,
        rate: adjustedRate,
        market_rate: marketRate,
        vaulte_rate: vaulteRate,
        margin: 100, // ₦100 per $1
        last_updated: new Date().toISOString()
      }
    })
    
    res.json({
      rates,
      market_rate: marketRate,
      vaulte_rate: vaulteRate,
      margin: 100,
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    console.error('Get rates error:', err.message)
    // Fallback: return database rates without live adjustment
    const result = await pool.query(
      'SELECT * FROM rates WHERE is_active = true ORDER BY category, card_name'
    )
    res.json({
      rates: result.rows,
      market_rate: 1280,
      vaulte_rate: 1180,
      margin: 100,
      timestamp: new Date().toISOString()
    })
  }
}

// Get market summary for landing page
const getMarketSummary = async (req, res) => {
  try {
    const marketRate = await getMarketRate()
    const vaulteRate = marketRate - 100
    
    // Get top rates
    const rates = await pool.query(
      'SELECT flag, card_name, rate, category FROM rates WHERE is_active = true ORDER BY rate DESC LIMIT 6'
    )
    
    // Apply Vaulte rate adjustment
    const baseRate = 1180
    const adjustedRates = rates.rows.map(rate => ({
      ...rate,
      rate: Math.round(rate.rate * (vaulteRate / baseRate))
    }))
    
    res.json({
      rates: adjustedRates,
      market_rate: marketRate,
      vaulte_rate: vaulteRate,
      margin: 100,
      last_updated: new Date().toISOString()
    })
  } catch (err) {
    console.error('Market summary error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get single rate by ID
const getRateById = async (req, res) => {
  const { id } = req.params
  try {
    const marketRate = await getMarketRate()
    const vaulteRate = marketRate - 100
    
    const result = await pool.query(
      'SELECT * FROM rates WHERE id = $1 AND is_active = true',
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rate not found' })
    }
    
    const rate = result.rows[0]
    const baseRate = 1180
    const adjustedRate = Math.round(rate.rate * (vaulteRate / baseRate))
    
    res.json({
      ...rate,
      rate: adjustedRate,
      market_rate: marketRate,
      vaulte_rate: vaulteRate,
      margin: 100
    })
  } catch (err) {
    console.error('Get rate error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
}

// UPDATE a rate (for admin)
const updateRate = async (req, res) => {
  const { id } = req.params
  const { rate } = req.body
  try {
    const result = await pool.query(
      'UPDATE rates SET rate = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [rate, id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rate not found' })
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error('Update rate error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
}

// TOGGLE active/inactive (for admin)
const toggleRate = async (req, res) => {
  const { id } = req.params
  try {
    const result = await pool.query(
      'UPDATE rates SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    )
    res.json(result.rows[0])
  } catch (err) {
    console.error('Toggle rate error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
}

module.exports = { getRates, getRateById, updateRate, toggleRate, getMarketSummary }