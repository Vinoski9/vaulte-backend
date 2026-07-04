const express = require('express')
const cors = require('cors')
require('dotenv').config()

const app = express()

// CORS - Allow frontend with credentials
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

app.use(express.json())

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Vaulte API is running 🔐' })
})

// Routes
app.use('/api/auth', require('./routes/auth'))
app.use('/api/transactions', require('./routes/transactions'))
app.use('/api/rates', require('./routes/rates'))
app.use('/api/admin', require('./routes/admin'))
app.use('/api/referrals', require('./routes/referrals'))

// TEST ROUTE
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test route works!' })
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Vaulte backend running on port ${PORT}`)
})