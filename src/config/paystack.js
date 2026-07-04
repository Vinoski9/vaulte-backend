const https = require('https')

const paystackTransfer = (amount, accountNumber, bankCode, accountName, reason) => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      source: 'balance',
      reason,
      amount: amount * 100, // Paystack uses kobo
      recipient: {
        type: 'nuban',
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: 'NGN'
      }
    })

    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: '/transfer',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
        'Content-Type': 'application/json'
      }
    }

    const req = https.request(options, res => {
      let responseData = ''
      res.on('data', chunk => responseData += chunk)
      res.on('end', () => resolve(JSON.parse(responseData)))
    })

    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

module.exports = paystackTransfer