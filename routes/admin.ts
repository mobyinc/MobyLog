import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Admin from '../models/admin';
import ActivityLog from '../models/activityLog';
import { requireAuth } from '../middleware/auth';
import { generateRandomPassword } from '../utils/auth';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../utils/email';
import { logActivity } from '../utils/logger';

const router = Router();

// List all admins
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const admins = await Admin.find({}, '-password').sort({ createdAt: -1 });
    res.json(admins);
  } catch (error) {
    console.error('List admins error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Invite new admin
router.post('/invite', requireAuth, [
  body('email').isEmail().normalizeEmail()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;
    const invitingAdmin = req.admin!;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin with this email already exists' });
    }

    // Generate random password
    const password = generateRandomPassword();

    // Create new admin
    const newAdmin = new Admin({
      email: email.toLowerCase(),
      password
    });

    await newAdmin.save();

    // Send welcome email
    try {
      await sendWelcomeEmail(newAdmin.email, password);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Continue anyway - admin can reset password
    }

    // Log activity
    await logActivity({
      adminId: invitingAdmin._id,
      adminEmail: invitingAdmin.email,
      action: 'ADMIN_INVITED',
      details: `Invited new admin: ${newAdmin.email}`,
      targetAdminId: newAdmin._id,
      targetAdminEmail: newAdmin.email,
      success: true,
      req
    });

    res.status(201).json({
      message: 'Admin invited successfully',
      admin: {
        id: newAdmin._id,
        email: newAdmin.email,
        createdAt: newAdmin.createdAt
      }
    });
  } catch (error) {
    console.error('Invite admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove admin
router.delete('/:adminId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { adminId } = req.params;
    const requestingAdmin = req.admin!;

    // Prevent self-deletion
    if (adminId === requestingAdmin._id.toString()) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Find admin to delete
    const adminToDelete = await Admin.findById(adminId);
    if (!adminToDelete) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Check if this is the last admin
    const adminCount = await Admin.countDocuments();
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last admin' });
    }

    // Soft delete by deactivating
    adminToDelete.isActive = false;
    await adminToDelete.save();

    // Log activity
    await logActivity({
      adminId: requestingAdmin._id,
      adminEmail: requestingAdmin.email,
      action: 'ADMIN_REMOVED',
      details: `Deactivated admin: ${adminToDelete.email}`,
      targetAdminId: adminToDelete._id,
      targetAdminEmail: adminToDelete.email,
      success: true,
      req
    });

    res.json({ message: 'Admin removed successfully' });
  } catch (error) {
    console.error('Remove admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset admin password
router.post('/:adminId/reset-password', requireAuth, async (req: Request, res: Response) => {
  try {
    const { adminId } = req.params;
    const requestingAdmin = req.admin!;

    // Find admin to reset
    const adminToReset = await Admin.findById(adminId);
    if (!adminToReset) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Generate new password
    const newPassword = generateRandomPassword();

    // Update password and unlock account
    adminToReset.password = newPassword;
    adminToReset.loginAttempts = 0;
    adminToReset.lockUntil = undefined;
    adminToReset.isLocked = false;
    await adminToReset.save();

    // Send password reset email
    try {
      await sendPasswordResetEmail(adminToReset.email, newPassword);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // Return password in response as fallback
      return res.json({
        message: 'Password reset successfully but email failed to send',
        temporaryPassword: newPassword
      });
    }

    // Log activity
    await logActivity({
      adminId: requestingAdmin._id,
      adminEmail: requestingAdmin.email,
      action: 'PASSWORD_RESET',
      details: `Reset password for admin: ${adminToReset.email}`,
      targetAdminId: adminToReset._id,
      targetAdminEmail: adminToReset.email,
      success: true,
      req
    });

    res.json({ message: 'Password reset successfully and sent via email' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unlock admin account
router.post('/:adminId/unlock', requireAuth, async (req: Request, res: Response) => {
  try {
    const { adminId } = req.params;
    const requestingAdmin = req.admin!;

    // Find admin to unlock
    const adminToUnlock = await Admin.findById(adminId);
    if (!adminToUnlock) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Unlock account
    adminToUnlock.loginAttempts = 0;
    adminToUnlock.lockUntil = undefined;
    adminToUnlock.isLocked = false;
    await adminToUnlock.save();

    // Log activity
    await logActivity({
      adminId: requestingAdmin._id,
      adminEmail: requestingAdmin.email,
      action: 'ACCOUNT_UNLOCKED',
      details: `Unlocked account for admin: ${adminToUnlock.email}`,
      targetAdminId: adminToUnlock._id,
      targetAdminEmail: adminToUnlock.email,
      success: true,
      req
    });

    res.json({ message: 'Account unlocked successfully' });
  } catch (error) {
    console.error('Unlock account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get activity logs
router.get('/activity-logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const { adminId, action, limit = 100, offset = 0 } = req.query;
    
    const query: any = {};
    if (adminId) query.adminId = adminId;
    if (action) query.action = action;

    const logs = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(offset))
      .populate('adminId', 'email')
      .populate('targetAdminId', 'email');

    const total = await ActivityLog.countDocuments(query);

    res.json({
      logs,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;