const nodemailer = require('nodemailer')

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

// Send verification email
const sendVerificationEmail = async (email, full_name, token) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`
  
  const mailOptions = {
    from: `"Vaulte" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Verify your Vaulte account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0A1628; color: #FFFFFF; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; background: #2A4AB5; padding: 10px 20px; border-radius: 10px;">
            <span style="font-size: 24px; font-weight: 700; color: white;">Vaulte</span>
          </div>
        </div>
        
        <h2 style="color: #FFFFFF; margin-bottom: 20px;">Welcome to Vaulte, ${full_name}! 🎉</h2>
        
        <p style="color: #7A90B8; line-height: 1.6; margin-bottom: 20px;">
          Thanks for signing up! Please verify your email address to start trading with the best rates in Nigeria.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="display: inline-block; background: #2A4AB5; color: white; padding: 14px 40px; 
                    border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Verify Email Address
          </a>
        </div>
        
        <p style="color: #4A5E80; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
          Or copy and paste this link into your browser:
          <br>
          <span style="color: #60A5FA; word-break: break-all;">${verificationUrl}</span>
        </p>
        
        <p style="color: #4A5E80; font-size: 13px; border-top: 1px solid rgba(96,165,250,0.1); padding-top: 20px;">
          This link will expire in 24 hours.<br>
          If you didn't create an account, you can safely ignore this email.
        </p>
      </div>
    `
  }

  try {
    await transporter.sendMail(mailOptions)
    console.log(`📧 Verification email sent to ${email}`)
    return true
  } catch (error) {
    console.error('❌ Email send error:', error.message)
    return false
  }
}

module.exports = { sendVerificationEmail }