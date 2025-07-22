import ActivityLog, { IActivityLog } from '../models/activityLog';
import { Request } from 'express';
import mongoose from 'mongoose';

interface LogOptions {
  adminId: mongoose.Types.ObjectId;
  adminEmail: string;
  action: string;
  details: string;
  targetAdminId?: mongoose.Types.ObjectId;
  targetAdminEmail?: string;
  success?: boolean;
  req?: Request;
}

export async function logActivity(options: LogOptions): Promise<IActivityLog> {
  const log = new ActivityLog({
    adminId: options.adminId,
    adminEmail: options.adminEmail,
    action: options.action,
    details: options.details,
    targetAdminId: options.targetAdminId,
    targetAdminEmail: options.targetAdminEmail,
    success: options.success !== undefined ? options.success : true,
    ipAddress: options.req ? getClientIp(options.req) : undefined,
    userAgent: options.req ? options.req.get('user-agent') : undefined,
  });

  return await log.save();
}

function getClientIp(req: Request): string {
  // Check for various headers that might contain the real IP
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for may contain multiple IPs, take the first one
    return (forwarded as string).split(',')[0].trim();
  }
  
  return req.headers['x-real-ip'] as string || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         '';
}