import nodemailer from 'nodemailer'

interface MailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail(options: MailOptions): Promise<void> {
  const smtpHost = process.env.SMTP_HOST
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS

  if (!smtpHost || !smtpUser || !smtpPass) {
    // Log to console if SMTP not configured
    console.log('=== EMAIL (SMTP not configured) ===')
    console.log('To:', options.to)
    console.log('Subject:', options.subject)
    console.log('Body:', options.html)
    console.log('===================================')
    return
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: parseInt(process.env.SMTP_PORT || '587') === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@smartpdfreader.com',
    to: options.to,
    subject: options.subject,
    html: options.html,
  })
}
