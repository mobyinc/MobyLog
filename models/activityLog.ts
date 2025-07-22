import mongoose, { Schema, Document } from "mongoose";

export interface IActivityLog extends Document {
  adminId: mongoose.Types.ObjectId;
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
      required: true,
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
        'ADMIN_REMOVED',
        'PASSWORD_RESET',
        'PASSWORD_CHANGED',
        'EXPORT_REQUESTED',
        'ACCOUNT_LOCKED',
        'ACCOUNT_UNLOCKED'
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