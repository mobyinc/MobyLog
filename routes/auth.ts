import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Admin from '../models/admin';
import { generateToken, requireAuth } from '../middleware/auth';
import { validatePassword, generateRandomPassword } from '../utils/auth';
import { logActivity } from '../utils/logger';
import { sendPasswordResetEmail, sendPasswordSetupEmail } from '../utils/email';

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

    // Check if admin needs to set up password
    if (admin.needsPasswordSetup || !admin.password) {
      await logActivity({
        adminId: admin._id,
        adminEmail: admin.email,
        action: 'LOGIN_FAILED',
        details: 'Login attempt on account requiring password setup',
        success: false,
        req
      });
      return res.status(403).json({ 
        error: 'Account setup required. Please check your email for the password setup link.',
        needsPasswordSetup: true
      });
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
        action: 'PASSWORD_CHANGE_FAILED',
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

// Password setup page (GET)
router.get('/setup-password/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).render('error', {
        title: 'Invalid Link',
        message: 'Password setup token is required.',
        showNavbar: false
      });
    }

    // Find admin with valid setup token
    const admin = await Admin.findOne({
      passwordSetupToken: token,
      passwordSetupTokenExpiry: { $gt: new Date() }
    });

    if (!admin) {
      return res.status(404).render('error', {
        title: 'Invalid or Expired Link',
        message: 'This password setup link is invalid or has expired. Please request a new invitation or password reset.',
        showNavbar: false
      });
    }

    // Render password setup form
    res.render('admin/setup-password', {
      token,
      email: admin.email,
      title: 'Set Up Your Password - MobyLog Admin',
      showNavbar: false
    });
    
  } catch (error) {
    console.error('Password setup page error:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'An error occurred while loading the password setup page.',
      showNavbar: false
    });
  }
});

// Password setup submission (POST)
router.post('/setup-password/:token', [
  body('password').notEmpty().withMessage('Password is required'),
  body('confirmPassword').notEmpty().withMessage('Password confirmation is required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (!token) {
      return res.status(400).render('admin/setup-password', {
        token: '',
        email: '',
        error: 'Invalid setup token.',
        title: 'Set Up Your Password - MobyLog Admin',
        showNavbar: false
      });
    }

    // Find admin with valid setup token
    const admin = await Admin.findOne({
      passwordSetupToken: token,
      passwordSetupTokenExpiry: { $gt: new Date() }
    });

    if (!admin) {
      return res.status(404).render('error', {
        title: 'Invalid or Expired Link',
        message: 'This password setup link is invalid or has expired. Please request a new invitation or password reset.',
        showNavbar: false
      });
    }

    // Handle validation errors
    if (!errors.isEmpty()) {
      return res.status(400).render('admin/setup-password', {
        token,
        email: admin.email,
        error: errors.array().map(err => err.msg).join(', '),
        title: 'Set Up Your Password - MobyLog Admin',
        showNavbar: false
      });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).render('admin/setup-password', {
        token,
        email: admin.email,
        error: 'Passwords do not match.',
        title: 'Set Up Your Password - MobyLog Admin',
        showNavbar: false
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).render('admin/setup-password', {
        token,
        email: admin.email,
        error: passwordValidation.message,
        title: 'Set Up Your Password - MobyLog Admin',
        showNavbar: false
      });
    }

    // Set password and clear setup token
    admin.password = password;
    admin.clearPasswordSetupToken();
    
    // Unlock account in case it was locked
    admin.loginAttempts = 0;
    admin.lockUntil = undefined;
    admin.isLocked = false;
    
    await admin.save();

    // Log password setup activity
    await logActivity({
      adminId: admin._id,
      adminEmail: admin.email,
      action: 'PASSWORD_SETUP_COMPLETED',
      details: `Password successfully set up`,
      success: true,
      req
    });

    // Render success page with login link
    res.render('admin/setup-success', {
      email: admin.email,
      title: 'Password Set Up Successfully - MobyLog Admin',
      showNavbar: false
    });

  } catch (error) {
    console.error('Password setup error:', error);
    
    const { token } = req.params;
    let email = '';
    
    try {
      const admin = await Admin.findOne({ passwordSetupToken: token });
      email = admin?.email || '';
    } catch {}

    res.status(500).render('admin/setup-password', {
      token,
      email,
      error: 'An error occurred while setting up your password. Please try again.',
      title: 'Set Up Your Password - MobyLog Admin',
      showNavbar: false
    });
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