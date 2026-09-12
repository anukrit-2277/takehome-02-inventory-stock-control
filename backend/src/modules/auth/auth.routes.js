import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import * as controller from './auth.controller.js';
import { loginSchema } from './auth.schemas.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';

// Login is the one unauthenticated endpoint that touches passwords, so it is
// the one worth rate limiting against guessing.
//
// Only failures count. Rate limiting is here to slow down someone trying
// passwords, and a successful sign-in is not an attempt at that — counting them
// would lock out a shared office IP, or anyone signing in on a few devices.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many failed sign-in attempts, try again later' } },
});

export const authRoutes = Router();

authRoutes.post('/login', loginLimiter, validate(loginSchema), controller.login);
authRoutes.post('/refresh', controller.refresh);
authRoutes.post('/logout', controller.logout);
authRoutes.get('/me', requireAuth, controller.me);
