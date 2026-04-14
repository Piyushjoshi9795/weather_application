// config/mailer.js
const nodemailer = require('nodemailer');

// Transporter = your email "sending engine"
// It holds the connection to Gmail's SMTP server
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS   // this is your App Password, not real password
  }
});

// Verify connection on startup
transporter.verify((error) => {
  if (error) console.error('Mailer error:', error);
  else console.log('Mailer ready to send emails');
});

// ── Email templates ───────────────────────────────────────
// Keeping templates here makes them easy to find and edit

const templates = {

  welcome: (username) => ({
    subject: '☁️ Welcome to Weather App!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 2rem; background: #f8fafc; border-radius: 12px;">
        <h1 style="color: #3b82f6;">☁️ Welcome, ${username}!</h1>
        <p style="color: #555; font-size: 1rem; line-height: 1.6;">
          Your account has been created successfully. You can now search 
          real-time weather for any city in the world.
        </p>
        <div style="background: #3b82f6; color: white; padding: 1rem; border-radius: 8px; text-align: center; margin: 1.5rem 0;">
          <strong>Start exploring the weather →</strong>
        </div>
        <p style="color: #999; font-size: 0.85rem;">
          You're receiving this because you signed up at Weather App.
        </p>
      </div>
    `
  }),

  loginAlert: (username, timestamp) => ({
    subject: '🔐 New login to your Weather App account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 2rem; background: #f8fafc; border-radius: 12px;">
        <h2 style="color: #1e293b;">New Login Detected</h2>
        <p style="color: #555;">Hi <strong>${username}</strong>,</p>
        <p style="color: #555; line-height: 1.6;">
          We detected a new login to your account at:
        </p>
        <div style="background: #fff; border: 1px solid #e2e8f0; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
          <strong style="color: #3b82f6;">🕐 ${timestamp}</strong>
        </div>
        <p style="color: #555; line-height: 1.6;">
          If this was you, no action needed. If you didn't log in, 
          please <strong>change your password immediately</strong>.
        </p>
        <p style="color: #999; font-size: 0.85rem;">Weather App Security Team</p>
      </div>
    `
  }),

  weatherDigest: (username, city, weatherData) => ({
    subject: `🌤️ Your morning weather for ${city} — ${new Date().toDateString()}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 2rem; background: linear-gradient(135deg, #667eea22, #764ba222); border-radius: 12px;">
        <h2 style="color: #1e293b;">Good Morning, ${username}! ☀️</h2>
        <p style="color: #555;">Here's your daily weather update for <strong>${city}</strong>:</p>
        <div style="background: white; border-radius: 12px; padding: 1.5rem; margin: 1rem 0; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
          <div style="font-size: 3rem; font-weight: 700; color: #3b82f6;">${Math.round(weatherData.temperature)}°C</div>
          <div style="color: #64748b; text-transform: capitalize; margin-bottom: 1rem;">${weatherData.description}</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; font-size: 0.85rem; color: #475569;">
            <div><div style="color:#94a3b8">Feels like</div><strong>${Math.round(weatherData.feelsLike)}°C</strong></div>
            <div><div style="color:#94a3b8">Humidity</div><strong>${weatherData.humidity}%</strong></div>
            <div><div style="color:#94a3b8">Wind</div><strong>${weatherData.windSpeed} m/s</strong></div>
          </div>
        </div>
        <p style="color: #999; font-size: 0.8rem; text-align: center;">
          Have a great day! • Unsubscribe from digests in your account settings
        </p>
      </div>
    `
  })

};

// Main send function
const sendEmail = async (to, templateName, ...args) => {
  try {
    const template = templates[templateName](...args);
    await transporter.sendMail({
      from: `"Weather App" <${process.env.EMAIL_USER}>`,
      to,
      subject: template.subject,
      html: template.html
    });
    console.log(`Email sent: ${templateName} → ${to}`);
  } catch (error) {
    // Never crash the app if email fails — just log it
    console.error(`Failed to send email (${templateName}):`, error.message);
  }
};

module.exports = { sendEmail };