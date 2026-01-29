import * as fs from 'fs';
import * as path from 'path';
import DownloadLink from '../models/downloadLink';
import { logActivity } from './logger';

interface CleanupStats {
  linksDeactivated: number;
  filesDeleted: number;
  errors: string[];
}

/**
 * Clean up expired download links and associated files
 */
export async function cleanupExpiredDownloads(): Promise<CleanupStats> {
  const stats: CleanupStats = {
    linksDeactivated: 0,
    filesDeleted: 0,
    errors: []
  };

  try {
    console.log('Starting cleanup of expired downloads...');

    // Find all expired or inactive download links
    const expiredLinks = await DownloadLink.find({
      $or: [
        { expiresAt: { $lt: new Date() } },
        { isActive: false }
      ]
    });

    console.log(`Found ${expiredLinks.length} expired download links`);

    for (const link of expiredLinks) {
      try {
        // Mark link as inactive if not already
        if (link.isActive) {
          link.isActive = false;
          await link.save();
          stats.linksDeactivated++;
        }

        // Check if file exists and delete it
        if (link.filePath && fs.existsSync(link.filePath)) {
          fs.unlinkSync(link.filePath);
          stats.filesDeleted++;
          console.log(`Deleted file: ${link.filePath}`);
        }

        // Log cleanup activity
        await logActivity({
          adminId: null,
          adminEmail: 'system',
          action: 'CLEANUP_EXPIRED_DOWNLOAD',
          details: `Cleaned up expired download: ${link.filename} (token: ${link.token})`,
          success: true
        });

      } catch (error) {
        const errorMsg = `Error cleaning up download ${link.token}: ${(error as Error).message}`;
        stats.errors.push(errorMsg);
        console.error(errorMsg);
        
        await logActivity({
          adminId: null,
          adminEmail: 'system',
          action: 'CLEANUP_ERROR',
          details: errorMsg,
          success: false
        });
      }
    }

    // Additional cleanup: remove orphaned files in reports directory
    await cleanupOrphanedFiles(stats);

    console.log('Cleanup completed:', stats);
    return stats;

  } catch (error) {
    const errorMsg = `Cleanup process failed: ${(error as Error).message}`;
    stats.errors.push(errorMsg);
    console.error(errorMsg);
    
    await logActivity({
      adminId: null,
      adminEmail: 'system',
      action: 'CLEANUP_FAILED',
      details: errorMsg,
      success: false
    });

    return stats;
  }
}

/**
 * Clean up orphaned files that don't have corresponding database entries
 */
async function cleanupOrphanedFiles(stats: CleanupStats): Promise<void> {
  try {
    const storageRoot = process.env.STORAGE_ROOT || '.';
    const reportsDir = path.join(storageRoot, 'reports');

    if (!fs.existsSync(reportsDir)) {
      return;
    }

    const files = fs.readdirSync(reportsDir);
    
    for (const file of files) {
      const filePath = path.join(reportsDir, file);
      
      // Only process .zip files that look like reports
      if (!file.endsWith('.zip') || !file.startsWith('report-')) {
        continue;
      }

      try {
        // Check if this file has a corresponding database entry
        const correspondingLink = await DownloadLink.findOne({
          filename: file,
          filePath: filePath
        });

        if (!correspondingLink) {
          // This is an orphaned file - check if it's old enough to delete
          const fileStats = fs.statSync(filePath);
          const fileAge = Date.now() - fileStats.mtime.getTime();
          const maxAge = 48 * 60 * 60 * 1000; // 48 hours

          if (fileAge > maxAge) {
            fs.unlinkSync(filePath);
            stats.filesDeleted++;
            console.log(`Deleted orphaned file: ${filePath}`);

            await logActivity({
              adminId: null,
              adminEmail: 'system',
              action: 'CLEANUP_ORPHANED_FILE',
              details: `Deleted orphaned file: ${file}`,
              success: true
            });
          }
        }
      } catch (error) {
        const errorMsg = `Error processing file ${file}: ${(error as Error).message}`;
        stats.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
  } catch (error) {
    const errorMsg = `Error during orphaned files cleanup: ${(error as Error).message}`;
    stats.errors.push(errorMsg);
    console.error(errorMsg);
  }
}

/**
 * Schedule automatic cleanup to run periodically
 */
export function scheduleCleanup(): void {
  const cleanupInterval = 48 * 60 * 60 * 1000; // Run every 48 hours

  setInterval(async () => {
    try {
      console.log('Running scheduled cleanup...');
      await cleanupExpiredDownloads();
    } catch (error) {
      console.error('Scheduled cleanup failed:', error);
    }
  }, cleanupInterval);

  console.log('Cleanup scheduler started - will run every 48 hours');
}

/**
 * Get cleanup statistics without performing cleanup
 */
export async function getCleanupStats(): Promise<{
  totalLinks: number;
  activeLinks: number;
  expiredLinks: number;
  totalFiles: number;
}> {
  const totalLinks = await DownloadLink.countDocuments();
  const activeLinks = await DownloadLink.countDocuments({
    isActive: true,
    expiresAt: { $gt: new Date() }
  });
  const expiredLinks = await DownloadLink.countDocuments({
    $or: [
      { isActive: false },
      { expiresAt: { $lt: new Date() } }
    ]
  });

  // Count files in reports directory
  let totalFiles = 0;
  try {
    const storageRoot = process.env.STORAGE_ROOT || '.';
    const reportsDir = path.join(storageRoot, 'reports');
    if (fs.existsSync(reportsDir)) {
      const files = fs.readdirSync(reportsDir);
      totalFiles = files.filter(f => f.endsWith('.zip')).length;
    }
  } catch (error) {
    console.error('Error counting files:', error);
  }

  return {
    totalLinks,
    activeLinks,
    expiredLinks,
    totalFiles
  };
} 