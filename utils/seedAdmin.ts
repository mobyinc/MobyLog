import Admin from '../models/admin';
import { generateRandomPassword } from './auth';
import { sendWelcomeEmail } from './email';

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
    
    // Generate a strong random password
    const password = generateRandomPassword();
    
    // Create the initial admin
    const admin = new Admin({
      email: initialEmail.toLowerCase(),
      password
    });
    
    await admin.save();
    
    console.log(`Initial admin created: ${initialEmail}`);
    
    // Send welcome email with credentials
    try {
      await sendWelcomeEmail(admin.email, password);
      console.log('Welcome email sent successfully');
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      console.log(`\n===== IMPORTANT =====`);
      console.log(`Initial admin credentials:`);
      console.log(`Email: ${admin.email}`);
      console.log(`Password: ${password}`);
      console.log(`Please save these credentials securely!`);
      console.log(`=====================\n`);
    }
  } catch (error) {
    console.error('Error seeding initial admin:', error);
    throw error;
  }
}