import express from 'express';
import { setupMiddleware } from './internal/bootstrap/middleware';
import { registerRoutes } from './internal/bootstrap/routes';

// TODO: Configure the Express application and bootstrap core middleware and routes.
const app = express();

setupMiddleware(app);
registerRoutes(app);

export default app;
