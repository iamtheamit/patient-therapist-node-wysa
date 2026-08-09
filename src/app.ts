import express from 'express';
import { setupPreRouteMiddleware, setupPostRouteMiddleware } from './internal/bootstrap/middlewarePipeline';
import { registerRoutes } from './internal/bootstrap/routes';
import { setupSwagger } from './config/swagger';

const app = express();

setupPreRouteMiddleware(app);
setupSwagger(app);
registerRoutes(app);

// Root health check — confirms the API is live
app.get('/', (_req, res) => {
  res.json({
    status: true,
    message: 'TherapySync API is healthy and running.',
    version: 'v1',
    docs: '/docs',
  });
});

setupPostRouteMiddleware(app);

export default app;
