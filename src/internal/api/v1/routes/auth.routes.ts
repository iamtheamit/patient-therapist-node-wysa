import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateToken } from '../../../middleware/authMiddleware';

export const authRouter = Router();
const controller = new AuthController();

authRouter.post('/register', controller.register.bind(controller));
authRouter.post('/login', controller.login.bind(controller));
authRouter.post('/refresh', controller.refresh.bind(controller));
authRouter.post('/logout', authenticateToken, controller.logout.bind(controller));
authRouter.get('/me', authenticateToken, controller.me.bind(controller));
