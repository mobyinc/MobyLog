import Admin from '../models/admin';
import { generateRandomPassword } from './auth';
import { sendWelcomeEmail, sendPasswordSetupEmail } from './email';

export async function seedInitialAdmin() {
  try {
    // Check if any admin exists
    const adminCount = await Admin.countDocuments();
    
    if (adminCount > 0) {
      console.log('Admin users already exist, skipping seed');
      return;
    }

    // Get initial admin email from environment or use default
    const initialEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@mobyinc.com';
    
    // Create the initial admin without password (will be set via setup link)
    const admin = new Admin({
      email: initialEmail.toLowerCase(),
      needsPasswordSetup: true,
      isActive: true
    });
    
    // Generate password setup token
    const setupToken = admin.generatePasswordSetupToken();
    await admin.save();
    
    console.log(`Initial admin created: ${initialEmail}`);
    
    // Send password setup email
    try {
      await sendPasswordSetupEmail(admin.email, setupToken, true);
      console.log('Password setup email sent successfully');
      console.log(`\n===== IMPORTANT =====`);
      console.log(`Initial admin setup:`);
      console.log(`Email: ${admin.email}`);
      console.log(`A password setup link has been sent to the admin email.`);
      console.log(`The admin must complete password setup before first login.`);
      console.log(`=====================\n`);
    } catch (emailError) {
      console.error('Failed to send password setup email:', emailError);
      console.log(`\n===== IMPORTANT =====`);
      console.log(`Initial admin created but email failed:`);
      console.log(`Email: ${admin.email}`);
      console.log(`Setup Token: ${setupToken}`);
      console.log(`Manual setup URL: ${process.env.PUBLIC_URL || 'http://localhost:4242'}/auth/setup-password/${setupToken}`);
      console.log(`Please provide this setup link to the admin securely!`);
      console.log(`=====================\n`);
    }
  } catch (error) {
    console.error('Error seeding initial admin:', error);
    throw error;
  }
}