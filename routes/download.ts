import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import DownloadLink from '../models/downloadLink';
import { logActivity } from '../utils/logger';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Secure download endpoint with token validation
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({ error: 'Download token is required' });
    }

    // Find the download link in database
    const downloadLink = await (DownloadLink as any).findValidLink(token);
    
    if (!downloadLink) {
      // Log failed download attempt
      await logActivity({
        adminId: null,
        adminEmail: 'unknown',
        action: 'DOWNLOAD_FAILED',
        details: `Invalid or expired download token attempted: ${token}`,
        success: false,
        req
      });
      
      return res.status(404).render('error', {
        title: 'Download Not Found',
        message: 'This download link is invalid or has expired.',
        showNavbar: false
      });
    }

    // Check if link is expired (double-check)
    if (downloadLink.isExpired()) {
      downloadLink.isActive = false;
      await downloadLink.save();
      
      await logActivity({
        adminId: downloadLink.requestedByAdminId,
        adminEmail: downloadLink.requestedByAdminEmail,
        action: 'DOWNLOAD_EXPIRED',
        details: `Expired download attempted for token: ${token}`,
        success: false,
        req
      });
      
      return res.status(410).render('error', {
        title: 'Download Expired',
        message: 'This download link has expired. Please request a new export.',
        showNavbar: false
      });
    }

    // Check if file still exists on disk
    if (!fs.existsSync(downloadLink.filePath)) {
      downloadLink.isActive = false;
      await downloadLink.save();
      
      await logActivity({
        adminId: downloadLink.requestedByAdminId,
        adminEmail: downloadLink.requestedByAdminEmail,
        action: 'DOWNLOAD_FILE_MISSING',
        details: `File missing for download token: ${token}, path: ${downloadLink.filePath}`,
        success: false,
        req
      });
      
      return res.status(404).render('error', {
        title: 'File Not Found',
        message: 'The requested file is no longer available. Please request a new export.',
        showNavbar: false
      });
    }

    // Record the download access
    const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    
    await downloadLink.recordAccess(clientIP, userAgent);

    // Log successful download
    await logActivity({
      adminId: downloadLink.requestedByAdminId,
      adminEmail: downloadLink.requestedByAdminEmail,
      action: 'DOWNLOAD_SUCCESS',
      details: `File downloaded: ${downloadLink.filename}, download count: ${downloadLink.downloadCount}`,
      success: true,
      req
    });

    // Set appropriate headers for file download
    const filename = path.basename(downloadLink.filename);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/zip');
    
    // Stream the file to client
    const fileStream = fs.createReadStream(downloadLink.filePath);
    
    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error downloading file' });
      }
    });
    
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Download route error:', error);
    
    await logActivity({
      adminId: null,
      adminEmail: 'unknown',
      action: 'DOWNLOAD_ERROR',
      details: `Download error: ${(error as Error).message}`,
      success: false,
      req
    });
    
    if (!res.headersSent) {
      res.status(500).render('error', {
        title: 'Download Error',
        message: 'An error occurred while processing your download. Please try again.',
        showNavbar: false
      });
    }
  }
});

// Admin route to view download statistics
router.get('/admin/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const recentDownloads = await DownloadLink.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .select('token filename sentToEmail downloadCount createdAt expiresAt isActive lastAccessedAt requestedByAdminEmail');
    
    res.json({
      downloads: recentDownloads,
      stats: {
        total: await DownloadLink.countDocuments(),
        active: await DownloadLink.countDocuments({ isActive: true, expiresAt: { $gt: new Date() } }),
        expired: await DownloadLink.countDocuments({ $or: [{ isActive: false }, { expiresAt: { $lt: new Date() } }] })
      }
    });
  } catch (error) {
    console.error('Download stats error:', error);
    res.status(500).json({ error: 'Error fetching download statistics' });
  }
});

export default router; 