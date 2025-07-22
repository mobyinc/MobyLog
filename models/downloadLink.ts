import mongoose, { Schema, Document } from 'mongoose';

export interface IDownloadLink extends Document {
  token: string;
  filename: string;
  filePath: string;
  requestedByAdminId: string;
  requestedByAdminEmail: string;
  sentToEmail: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
  downloadCount: number;
  lastAccessedAt?: Date;
  accessLog: Array<{
    timestamp: Date;
    ipAddress: string;
    userAgent: string;
  }>;
  metadata?: {
    fileSize?: number;
    recordCount?: number;
    exportType?: string;
  };
}

const DownloadLinkSchema: Schema = new Schema(
  {
    token: { 
      type: String, 
      required: true, 
      unique: true, 
      index: true 
    },
    filename: { 
      type: String, 
      required: true 
    },
    filePath: { 
      type: String, 
      required: true 
    },
    requestedByAdminId: { 
      type: String, 
      required: true, 
      index: true 
    },
    requestedByAdminEmail: { 
      type: String, 
      required: true, 
      index: true 
    },
    sentToEmail: { 
      type: String, 
      required: true, 
      index: true 
    },
    expiresAt: { 
      type: Date, 
      required: true, 
      index: true 
    },
    isActive: { 
      type: Boolean, 
      default: true, 
      index: true 
    },
    downloadCount: { 
      type: Number, 
      default: 0 
    },
    lastAccessedAt: { 
      type: Date 
    },
    accessLog: [{
      timestamp: { type: Date, default: Date.now },
      ipAddress: { type: String },
      userAgent: { type: String }
    }],
    metadata: {
      fileSize: { type: Number },
      recordCount: { type: Number },
      exportType: { type: String, default: 'csv' }
    }
  },
  {
    timestamps: true,
  }
);

// Index for cleanup queries
DownloadLinkSchema.index({ expiresAt: 1, isActive: 1 });

// Method to check if link is expired
DownloadLinkSchema.methods.isExpired = function(): boolean {
  return new Date() > this.expiresAt || !this.isActive;
};

// Method to record access
DownloadLinkSchema.methods.recordAccess = function(ipAddress: string, userAgent: string) {
  this.downloadCount += 1;
  this.lastAccessedAt = new Date();
  this.accessLog.push({
    timestamp: new Date(),
    ipAddress,
    userAgent
  });
  
  // Keep only last 10 access logs to prevent excessive growth
  if (this.accessLog.length > 10) {
    this.accessLog = this.accessLog.slice(-10);
  }
  
  return this.save();
};

// Static method to find valid link by token
DownloadLinkSchema.statics.findValidLink = function(token: string) {
  return this.findOne({
    token,
    isActive: true,
    expiresAt: { $gt: new Date() }
  });
};

// Static method to cleanup expired links
DownloadLinkSchema.statics.cleanupExpired = function() {
  return this.updateMany(
    {
      $or: [
        { expiresAt: { $lt: new Date() } },
        { isActive: false }
      ]
    },
    { isActive: false }
  );
};

export default mongoose.model<IDownloadLink>('DownloadLink', DownloadLinkSchema); 