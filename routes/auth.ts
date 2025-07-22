import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Admin from '../models/admin';
import { generateToken, requireAuth } from '../middleware/auth';
import { validatePassword, generateRandomPassword } from '../utils/auth';
import { logActivity } from '../utils/logger';
import { sendPasswordResetEmail } from '../utils/email';

const router = Router();

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    
    // Find admin by email
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    
    if (!admin) {
      // Log failed attempt with unknown email
      await logActivity({
        adminId: null as any,
        adminEmail: email,
        action: 'LOGIN_FAILED',
        details: `Login attempt with unknown email: ${email}`,
        success: false,
        req
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if account is locked
    if (admin.isAccountLocked()) {
      await logActivity({
        adminId: admin._id,
        adminEmail: admin.email,
        action: 'LOGIN_FAILED',
        details: 'Login attempt on locked account',
        success: false,
        req
      });
      return res.status(403).json({ error: 'Account is locked due to too many failed login attempts. Please try again later.' });
    }

    // Verify password
    const isValidPassword = await admin.comparePassword(password);
    
    if (!isValidPassword) {
      // Increment login attempts
      await admin.incLoginAttempts();
      
      await logActivity({
        adminId: admin._id,
        adminEmail: admin.email,
        action: 'LOGIN_FAILED',
        details: `Invalid password attempt (${admin.loginAttempts}/3)`,
        success: false,
        req
      });

      // Check if account just got locked
      if (admin.isAccountLocked()) {
        await logActivity({
          adminId: admin._id,
          adminEmail: admin.email,
          action: 'ACCOUNT_LOCKED',
          details: 'Account locked after 3 failed login attempts',
          success: true,
          req
        });
        return res.status(403).json({ error: 'Account has been locked due to too many failed login attempts' });
      }

      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if account is active
    if (!admin.isActive) {
      await logActivity({
        adminId: admin._id,
        adminEmail: admin.email,
        action: 'LOGIN_FAILED',
        details: 'Login attempt on deactivated account',
        success: false,
        req
      });
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    // Reset login attempts on successful login
    await admin.resetLoginAttempts();

    // Generate token
    const token = generateToken(admin);

    // Store token in session
    if (req.session) {
      req.session.token = token;
      req.session.adminId = admin._id.toString();
    }

    // Log successful login
    await logActivity({
      adminId: admin._id,
      adminEmail: admin.email,
      action: 'LOGIN',
      details: 'Successful login',
      success: true,
      req
    });

    res.json({
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        lastLogin: admin.lastLogin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    // Log logout
    await logActivity({
      adminId: req.admin!._id,
      adminEmail: req.admin!.email,
      action: 'LOGOUT',
      details: 'Admin logged out',
      success: true,
      req
    });

    // Clear session
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destroy error:', err);
        }
      });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
router.post('/change-password', requireAuth, [
  body('currentPassword').notEmpty(),
  body('newPassword').notEmpty()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const admin = req.admin!;

    // Verify current password
    const isValidPassword = await admin.comparePassword(currentPassword);
    if (!isValidPassword) {
      await logActivity({
        adminId: admin._id,
        adminEmail: admin.email,
        action: 'PASSWORD_CHANGED',
        details: 'Failed to change password - incorrect current password',
        success: false,
        req
      });
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    // Update password
    admin.password = newPassword;
    await admin.save();

    // Log password change
    await logActivity({
      adminId: admin._id,
      adminEmail: admin.email,
      action: 'PASSWORD_CHANGED',
      details: 'Password changed successfully',
      success: true,
      req
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current admin info
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const admin = req.admin!;
    res.json({
      id: admin._id,
      email: admin.email,
      lastLogin: admin.lastLogin,
      createdAt: admin.createdAt
    });
  } catch (error) {
    console.error('Get current admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;