import nodemailer from 'nodemailer';

export async function sendSmtpEmail(opts: { to: string; subject: string; text: string; html?: string }): Promise<void> {
  const url = process.env.SMTP_URL?.trim();
  if (!url) throw new Error('SMTP_URL is not set');
  const transporter = nodemailer.createTransport(url);
  const from = process.env.NOTIFICATION_FROM?.trim() || 'crescent@localhost';
  await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}
