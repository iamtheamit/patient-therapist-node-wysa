import winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  isProduction
    ? winston.format.json()
    : winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        const logMessage = stack || message;
        return `[${timestamp}] [${level.toUpperCase()}]: ${logMessage} ${metaString}`;
      })
);

export const logger = winston.createLogger({
  level: logLevel,
  defaultMeta: { service: 'healthcare-backend' },
  format: customFormat,
  transports: [
    new winston.transports.Console({
      format: isProduction
        ? winston.format.json()
        : winston.format.combine(winston.format.colorize({ all: true }), customFormat),
    }),
  ],
});

export default logger;
