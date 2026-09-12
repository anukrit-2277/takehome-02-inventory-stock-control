import 'dotenv/config';

// Day and week boundaries have to mean the same thing in JavaScript as they do
// in MySQL, which defaults to UTC. Pinning the process here removes the whole
// class of off-by-one-day bugs that appear only when the server sits west of
// UTC. Override with TZ if a deployment genuinely needs local time.
process.env.TZ = process.env.TZ || 'UTC';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    accessTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
    refreshTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
  },
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};

export const isProduction = env.nodeEnv === 'production';
