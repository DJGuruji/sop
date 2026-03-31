import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const from = process.env.SMTP_FROM;

if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !from) {
  console.warn("SMTP not configured: forgot-password email will not be sent");
}

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: { user: smtpUser, pass: smtpPass },
});

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !from) {
    throw new Error("SMTP not configured");
  }

  const info = await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  return info;
}
