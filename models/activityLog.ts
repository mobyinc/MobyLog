import mongoose, { Schema, Document } from "mongoose";

export interface IActivityLog extends Document {
  adminId: mongoose.Types.ObjectId | null;
  adminEmail: string;
  action: string;
  details: string;
  ipAddress?: string;
  userAgent?: string;
  targetAdminId?: mongoose.Types.ObjectId;
  targetAdminEmail?: string;
  success: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ActivityLogSchema: Schema = new Schema(
  {
    adminId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Admin',
      required: false,
      index: true 
    },
    adminEmail: { 
      type: String, 
      required: true,
      index: true 
    },
    action: { 
      type: String, 
      required: true,
      index: true,
      enum: [
        'LOGIN',
        'LOGIN_FAILED',
        'LOGOUT',
        'ADMIN_INVITED',
        'ADMIN_INVITE_RESENT',
        'ADMIN_REMOVED',
        'PASSWORD_RESET',
        'PASSWORD_RESET_INITIATED',
        'PASSWORD_SETUP_COMPLETED',
        'PASSWORD_CHANGED',
        'PASSWORD_CHANGE_FAILED',
        'EXPORT_REQUESTED',
        'ACCOUNT_LOCKED',
        'ACCOUNT_UNLOCKED',
        'DOWNLOAD_ERROR',
        'DOWNLOAD_FAILED',
        'DOWNLOAD_SUCCESS',
        'CLEANUP_EXPIRED_DOWNLOAD',
        'CLEANUP_ERROR',
        'CLEANUP_FAILED',
        'CLEANUP_ORPHANED_FILE'
      ]
    },
    details: { 
      type: String, 
      required: true 
    },
    ipAddress: { 
      type: String 
    },
    userAgent: { 
      type: String 
    },
    targetAdminId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Admin' 
    },
    targetAdminEmail: { 
      type: String 
    },
    success: { 
      type: Boolean, 
      default: true 
    }
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying
ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ adminId: 1, createdAt: -1 });

export default mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema);