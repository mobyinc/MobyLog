import session from 'express-session';
import MongoStore from 'connect-mongo';

// Extend session data to include our custom fields
declare module 'express-session' {
  interface SessionData {
    token?: string;
    adminId?: string;
  }
}

export function configureSession(mongoUri: string) {
  return session({
    secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: mongoUri,
      touchAfter: 24 * 3600 // lazy session update
    }),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // require HTTPS in production
      sameSite: 'strict'
    }
  });
}