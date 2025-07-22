import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { json, urlencoded } from "body-parser";
import mongoose from "mongoose";
import cors from "cors";
import Event from './models/event';
import * as fs from 'fs';
import path from 'path';

// Import authentication components
import { configureSession } from './config/session';
import { seedInitialAdmin } from './utils/seedAdmin';
import { requireAuth } from './middleware/auth';
import { scheduleCleanup } from './utils/cleanup';

// Import routes
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import exportRoutes from './routes/export';
import downloadRoutes from './routes/download';

const port = process.env.PORT ?? 4242;
const mongoUri = process.env.MONGO_URI ?? null;
const app = express();

// Middleware setup
app.set('trust proxy', true); // Enable proper IP extraction behind proxies
app.use(cors({ 
  allowedHeaders: "Content-Type,Authorization",
  credentials: true 
}));
app.use(json());
app.use(urlencoded({ extended: true }));

// View engine setup
app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'views'));

// Static files
const storageRoot = process.env.STORAGE_ROOT || '.';
app.use('/reports', express.static(path.join(storageRoot, 'reports')));
app.use(express.static(path.join(__dirname, 'public')));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500);
  res.json({ message: "Internal server error" });
});

// Connect Database
if (mongoUri) {
  mongoose.connect(mongoUri).then(async () => {
    console.log('Connected to MongoDB');
    
    // Seed initial admin after database connection
    await seedInitialAdmin();
  }).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
} else {
  throw new Error("MONGO_URI must be set");
}

// Session configuration (must be after database connection is established)
app.use(configureSession(mongoUri));

// Authentication routes (public)
app.use('/auth', authRoutes);

// Admin login page (public)
app.get('/admin/login', (req, res) => {
  res.render('admin/login', { 
    productName: process.env.PRODUCT_NAME || 'MobyLog' 
  });
});

// Root route - Welcome dashboard (protected)
app.get('/', requireAuth, (req, res) => {
  res.render('admin/dashboard', { 
    admin: req.admin, 
    productName: process.env.PRODUCT_NAME || 'MobyLog' 
  });
});

// Protected routes
app.use('/export', requireAuth, exportRoutes);
app.use('/admin/admins', requireAuth, adminRoutes);

// Public download routes (token-based security)
app.use('/download', downloadRoutes);

// Admin management page
app.get('/admin/manage', requireAuth, (req, res) => {
  res.render('admin/admins', { 
    admin: req.admin, 
    productName: process.env.PRODUCT_NAME || 'MobyLog' 
  });
});

// Activity logs page
app.get('/admin/activity', requireAuth, async (req, res) => {
  res.render('admin/activity', { admin: req.admin });
});

// API Routes

// Events API endpoint (protected)
app.post("/events", express.json(), async (req, res) => {
  const event = {
    userId: null,
    eventType: null,
    name: null,
    info: null,
    data: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  Object.assign(event, req.body);

  if (event.userId === null || event.eventType === null || event.name === null) {
    return res.status(400).json({ message: 'bad request' });
  }

  await Event.create(event);

  res.status(201).end();
});

// Get events (protected)
app.get("/events", requireAuth, async (req, res) => {
  const userId = req.query.userId?.toString();
  const eventType = req.query.eventType?.toString();
  const name = req.query.name?.toString();
  const query: any = {};

  if (userId === undefined) {
    res.status(400);
    res.json({ error: 'must include userId query parameter' });
    return;
  }

  if (userId !== undefined) query['userId'] = userId;
  if (eventType !== undefined) query['eventType'] = eventType;
  if (name !== undefined) query['name'] = name;

  Event.find(query).exec().then((docs) => {
    res.json(docs);
  }).catch(err => {
    console.log(err);
    res.status(500);
    res.json({ error: err.toString() });
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Listen
app.listen(port, () => {
  console.log(`server is listening on port ${port}`);
  scheduleCleanup(); // Start the cleanup scheduler
});
