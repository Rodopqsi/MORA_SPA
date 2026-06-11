import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import routes from './routes';
import { errorHandler } from './core';

dotenv.config();

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
    credentials: true
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Local uploads (best-effort, ignored from git)
const uploadsRoot = path.resolve(process.cwd(), 'uploads');
if (fs.existsSync(uploadsRoot)) {
  app.use('/uploads', express.static(uploadsRoot, { fallthrough: true, maxAge: '1d' }));
}

app.use('/api', routes);
app.use(errorHandler);

export default app;
