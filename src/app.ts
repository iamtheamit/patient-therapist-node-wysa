import express from 'express';
import { setupPreRouteMiddleware, setupPostRouteMiddleware } from './internal/bootstrap/middleware';
import { registerRoutes } from './internal/bootstrap/routes';
import { setupSwagger } from './config/swagger';

const app = express();

setupPreRouteMiddleware(app);
setupSwagger(app);
registerRoutes(app);
setupPostRouteMiddleware(app);

export default app;
