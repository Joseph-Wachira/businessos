import { config } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';
import { prisma } from './db/prisma.js';

const app = createApp();

const server = app.listen(config.PORT, () => {
  logger.info(`BusinessOS API listening on port ${config.PORT} (${config.NODE_ENV})`);
});

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
