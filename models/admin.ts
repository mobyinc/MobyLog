import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcrypt";

export interface IAdmin extends Document {
  email: string;
  password?: string; // Optional since new admins won't have password initially
  isActive: boolean;
  isLocked: boolean;
  loginAttempts: number;
  lockUntil?: Date;
  lastLogin?: Date;
  resetToken?: string;
  resetTokenExpiry?: Date;
  passwordSetupToken?: string;
  passwordSetupTokenExpiry?: Date;
  needsPasswordSetup: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  isAccountLocked(): boolean;
  incLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
  generatePasswordSetupToken(): string;
  clearPasswordSetupToken(): void;
  isPasswordSetupTokenValid(token: string): boolean;
}

const AdminSchema: Schema = new Schema(
  {
    email: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true,
      trim: true,
      index: true 
    },
    password: { 
      type: String, 
      required: false // Not required initially for new admins
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    isLocked: { 
      type: Boolean, 
      default: false 
    },
    loginAttempts: { 
      type: Number, 
      default: 0 
    },
    lockUntil: { 
      type: Date 
    },
    lastLogin: { 
      type: Date 
    },
    resetToken: { 
      type: String 
    },
    resetTokenExpiry: { 
      type: Date 
    },
    passwordSetupToken: {
      type: String
    },
    passwordSetupTokenExpiry: {
      type: Date
    },
    needsPasswordSetup: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
  }
);

// Virtual for checking if account is currently locked
AdminSchema.virtual('isCurrentlyLocked').get(function(this: IAdmin) {
  return !!(this.lockUntil && this.lockUntil > new Date());
});

// Pre-save hook to hash password
AdminSchema.pre('save', async function(next) {
  const admin = this as IAdmin;
  
  // Only hash the password if it has been modified (or is new) and exists
  if (!admin.isModified('password') || !admin.password) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(admin.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare password
AdminSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    if (!this.password) return false; // No password set yet
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

// Method to check if account is locked
AdminSchema.methods.isAccountLocked = function(): boolean {
  // Check if lockUntil is set and hasn't expired
  return !!(this.lockUntil && this.lockUntil > new Date());
};

// Method to increment login attempts
AdminSchema.methods.incLoginAttempts = async function(): Promise<void> {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < new Date()) {
    this.loginAttempts = 1;
    this.lockUntil = undefined;
  } else {
    // Otherwise we're incrementing
    this.loginAttempts += 1;
  }
  
  // Lock the account after 3 attempts for 2 hours
  if (this.loginAttempts >= 3 && !this.isAccountLocked()) {
    this.lockUntil = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
    this.isLocked = true;
  }
  
  await this.save();
};

// Method to reset login attempts
AdminSchema.methods.resetLoginAttempts = async function(): Promise<void> {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  this.isLocked = false;
  this.lastLogin = new Date();
  await this.save();
};

// Method to generate password setup token
AdminSchema.methods.generatePasswordSetupToken = function(): string {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  this.passwordSetupToken = token;
  this.passwordSetupTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  this.needsPasswordSetup = true;
  return token;
};

// Method to clear password setup token
AdminSchema.methods.clearPasswordSetupToken = function(): void {
  this.passwordSetupToken = undefined;
  this.passwordSetupTokenExpiry = undefined;
  this.needsPasswordSetup = false;
};

// Method to validate password setup token
AdminSchema.methods.isPasswordSetupTokenValid = function(token: string): boolean {
  return !!(this.passwordSetupToken && 
           this.passwordSetupToken === token && 
           this.passwordSetupTokenExpiry && 
           this.passwordSetupTokenExpiry > new Date());
};

export default mongoose.model<IAdmin>("Admin", AdminSchema);