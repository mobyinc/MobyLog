import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import AdmZip from 'adm-zip';
import Event from '../models/event';
import DownloadLink from '../models/downloadLink';
import { requireAuth } from '../middleware/auth';
import { sendExportEmail } from '../utils/email';
import { logActivity } from '../utils/logger';

const router = Router();

const EXPORT_RANGES = ['last_hour', 'today', 'this_week', 'this_month', 'last_month', 'all'] as const;
type ExportRange = typeof EXPORT_RANGES[number];

const getRangeDetails = (range: ExportRange) => {
  const now = new Date();

  switch (range) {
    case 'last_hour': {
      const start = new Date(now.getTime() - 60 * 60 * 1000);
      return { label: 'last hour', query: { createdAt: { $gte: start, $lt: now } } };
    }
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { label: 'today', query: { createdAt: { $gte: start, $lt: now } } };
    }
    case 'this_week': {
      const start = new Date(now);
      const day = start.getDay();
      const diff = (day === 0 ? -6 : 1) - day;
      start.setDate(start.getDate() + diff);
      start.setHours(0, 0, 0, 0);
      return { label: 'this week', query: { createdAt: { $gte: start, $lt: now } } };
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { label: 'this month', query: { createdAt: { $gte: start, $lt: now } } };
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 1);
      return { label: 'last month', query: { createdAt: { $gte: start, $lt: end } } };
    }
    case 'all':
    default:
      return { label: 'all time', query: {} };
  }
};

const getSafeRange = (range?: string): ExportRange => {
  if (range && (EXPORT_RANGES as readonly string[]).includes(range)) {
    return range as ExportRange;
  }
  return 'all';
};

// Render export page
router.get('/', requireAuth, async (req: Request, res: Response) => {
  res.render('admin/export', {
    message: '',
    range: 'all',
    admin: req.admin
  });
});

// Handle export request
router.post('/', requireAuth, [
  body('email').isEmail().normalizeEmail(),
  body('range').optional().isIn(EXPORT_RANGES)
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    const range = getSafeRange(req.body.range);
    if (!errors.isEmpty()) {
      return res.render('admin/export', {
        message: 'Please provide a valid email address and date range',
        range,
        admin: req.admin
      });
    }

    const { email } = req.body;
    const admin = req.admin!;
    const { label: rangeLabel } = getRangeDetails(range);

    // Log export request
    await logActivity({
      adminId: admin._id,
      adminEmail: admin.email,
      action: 'EXPORT_REQUESTED',
      details: `Export (${rangeLabel}) requested to be sent to: ${email}`,
      success: true,
      req
    });

    // Start export generation in background
    generateReport(email, admin.email, admin._id, admin.email, range);

    res.render('admin/export', {
      message: `The ${rangeLabel} report will be sent to ${email} in the next few minutes.`,
      range,
      admin: req.admin
    });
  } catch (error) {
    console.error('Export error:', error);
    res.render('admin/export', {
      message: 'An error occurred while processing your request',
      range: 'all',
      admin: req.admin
    });
  }
});

// Generate Report
const generateReport = async (recipientEmail: string, adminEmail: string, adminId: string, requestingAdminEmail: string, range: ExportRange) => {
  try {
    if (!fs.existsSync('tmp')){
      fs.mkdirSync('tmp');
    }

    const storageRoot = process.env.STORAGE_ROOT ?? '.';
    const timestamp = new Date().getTime();
    const filename = `report-${timestamp}.csv`;
    const zipFilename = `report-${timestamp}.zip`;
    const path = `${storageRoot}/tmp/${filename}`;
    const ws = fs.createWriteStream(path);
    
    const { query } = getRangeDetails(range);
    const stream = (Event as any).findAndStreamCsv(query);
    
    stream.pipe(ws).on('finish', () => {
      sendReport(path, storageRoot, zipFilename, recipientEmail, adminId, requestingAdminEmail);
    });
  } catch (error) {
    console.error('Generate report error:', error);
  }
};

const sendReport = async (path: string, storageRoot: string, zipFilename: string, recipientEmail: string, adminId: string, adminEmail: string) => {
  try {
    await new Promise(resolve => setTimeout(resolve, 3000)); // wait a little bit for file to exist

    var zipFile = new AdmZip();
    zipFile.addLocalFile(path);
    const zipPath = `${storageRoot}/reports/${zipFilename}`;
    zipFile.writeZip(zipPath);

    console.log('Zip file created:', zipPath);

    // Get file stats for metadata
    const fileStats = fs.statSync(zipPath);
    
    // Clean up temporary CSV file
    fs.rmSync(path);

    // Generate secure download token
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours from now

    // Create database entry for download tracking
    const downloadLink = new DownloadLink({
      token,
      filename: zipFilename,
      filePath: zipPath,
      requestedByAdminId: adminId,
      requestedByAdminEmail: adminEmail,
      sentToEmail: recipientEmail,
      expiresAt,
      isActive: true,
      downloadCount: 0,
      metadata: {
        fileSize: fileStats.size,
        exportType: 'csv'
      }
    });

    await downloadLink.save();

    // Create secure download URL using token
    const secureUrl = `${process.env.PUBLIC_URL}/download/${token}`;

    await sendExportEmail(recipientEmail, secureUrl);

    console.log('Export sent successfully to:', recipientEmail, 'with token:', token);
  } catch (error) {
    console.error('Send report error:', error);
  }
};

export default router;