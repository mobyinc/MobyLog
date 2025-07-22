import ActivityLog, { IActivityLog } from '../models/activityLog';
import { Request } from 'express';
import mongoose from 'mongoose';

interface LogOptions {
  adminId: mongoose.Types.ObjectId | null;
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
  // With trust proxy enabled, req.ip handles proxy headers automatically
  return req.ip || 'unknown';
}