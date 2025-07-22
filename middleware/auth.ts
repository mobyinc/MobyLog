import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Admin, { IAdmin } from '../models/admin';

// Extend Express Request to include admin
declare global {
  namespace Express {
    interface Request {
      admin?: IAdmin;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable must be set');
}

export interface JwtPayload {
  adminId: string;
  email: string;
}

export function generateToken(admin: IAdmin): string {
  const payload: JwtPayload = {
    adminId: admin._id.toString(),
    email: admin.email
  };
  
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: '24h' });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Helper function to determine if this is a browser request
    const isBrowserRequest = (req: Request): boolean => {
      const accept = req.headers.accept || '';
      return accept.includes('text/html');
    };

    // Helper function to handle auth failures
    const handleAuthFailure = (statusCode: number, message: string) => {
      if (isBrowserRequest(req)) {
        return res.redirect('/admin/login');
      } else {
        return res.status(statusCode).json({ error: message });
      }
    };

    // Check for token in session or Authorization header
    let token = req.session?.token;
    
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return handleAuthFailure(401, 'No authentication token provided');
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET!) as JwtPayload;
    
    // Get admin from database
    const admin = await Admin.findById(decoded.adminId);
    
    if (!admin) {
      return handleAuthFailure(401, 'Invalid authentication token');
    }

    if (!admin.isActive) {
      return handleAuthFailure(403, 'Account is deactivated');
    }

    if (admin.isAccountLocked()) {
      return handleAuthFailure(403, 'Account is locked due to too many failed login attempts');
    }

    // Attach admin to request
    req.admin = admin;
    next();
  } catch (error) {
    const isBrowser = req.headers.accept?.includes('text/html');
    
    if (error instanceof jwt.TokenExpiredError) {
      if (isBrowser) {
        return res.redirect('/admin/login');
      } else {
        return res.status(401).json({ error: 'Token expired' });
      }
    }
    if (error instanceof jwt.JsonWebTokenError) {
      if (isBrowser) {
        return res.redirect('/admin/login');
      } else {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }
    
    console.error('Auth middleware error:', error);
    if (isBrowser) {
      return res.redirect('/admin/login');
    } else {
      return res.status(500).json({ error: 'Authentication error' });
    }
  }
}