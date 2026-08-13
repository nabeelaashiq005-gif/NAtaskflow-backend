import nodemailer from "nodemailer";
import { env } from "../config/env.js";

// Email service.
//
// Real emails are sent with Nodemailer using SMTP. When SMTP credentials
// are not configured (local development), no email is actually sent —
// instead the message is printed to the backend terminal so you can test
// the flow end-to-end.
//
// To enable real emails, fill these in your .env file:
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=465            (or 587 for STARTTLS)
//   SMTP_USER=you@gmail.com
//   SMTP_PASS=your-app-password
//   EMAIL_FROM=NATaskFlow <you@gmail.com>
//
// For Gmail you must create an "App Password" (Google Account →
// Security → 2-Step Verification → App passwords) — your normal Gmail
// password will not work for SMTP.

const transporter =
  env.smtpHost && env.smtpUser && env.smtpPass
    ? nodemailer.createTransport({
        host: env.smtpHost,
        port: Number(env.smtpPort || 465),
        secure: Number(env.smtpPort || 465) === 465,
        auth: { user: env.smtpUser, pass: env.smtpPass },
      })
    : null;

async function sendMail({ to, subject, text }) {
  if (transporter) {
    await transporter.sendMail({
      from: env.emailFrom || `NATaskFlow <${env.smtpUser}>`,
      to,
      subject,
      text,
    });
    console.log(`📧 Email sent to ${to} — subject: "${subject}"`);
    return;
  }

  // Dev fallback: no SMTP configured, just print to the terminal.
  console.log("\n===============================================");
  console.log(`📧  EMAIL (dev mode — not actually sent)`);
  console.log(`   To: ${to}`);
  console.log(`   Subject: ${subject}`);
  console.log("   Body:");
  console.log(text);
  console.log("===============================================\n");
}

export async function sendEmailChangeVerification({ to, token }) {
  const verificationUrl = `${env.clientUrl}/verify-email-change/${token}`;

  await sendMail({
    to,
    subject: "Confirm your new email — NATaskFlow",
    text:
      `Confirm your new email for NATaskFlow.\n\n` +
      `Open this link within 1 hour to verify:\n${verificationUrl}\n`,
  });
}

export async function sendPasswordReset({ to, otp }) {
  await sendMail({
    to,
    subject: "Your NATaskFlow password reset code",
    text:
      `You requested to reset your NATaskFlow password.\n\n` +
      `Your 6-digit verification code is:\n\n${otp}\n\n` +
      `Enter this code on the password reset page. It expires in 1 hour.\n` +
      `If you didn't request this, you can safely ignore this email.\n`,
  });
}