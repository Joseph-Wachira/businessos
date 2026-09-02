import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import { logger } from './logger.js';

const transport =
  config.NODE_ENV === 'test'
    ? { jsonTransport: true }
    : { host: config.SMTP_HOST, port: config.SMTP_PORT, secure: false };

const transporter = nodemailer.createTransport(transport);

export async function sendMail({ to, subject, html }) {
  if (config.NODE_ENV === 'test') {
    logger.debug({ to, subject }, 'mailer: skipped send in test env');
    return;
  }
  await transporter.sendMail({ from: config.SMTP_FROM, to, subject, html });
}
