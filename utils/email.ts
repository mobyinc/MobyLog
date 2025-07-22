import sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY ?? '');

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const msg = {
    to: options.to,
    from: 'no-reply@mobyinc.com',
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  try {
    await sgMail.send(msg);
    console.log(`Email sent to ${options.to}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

export async function sendPasswordSetupEmail(email: string, setupToken: string, isInvite: boolean = false): Promise<void> {
  const baseUrl = process.env.PUBLIC_URL || 'http://localhost:4242';
  const setupUrl = `${baseUrl}/auth/setup-password/${setupToken}`;
  
  const subject = isInvite ? 'Welcome to MobyLog Admin - Set Up Your Password' : 'Reset Your MobyLog Admin Password';
  const action = isInvite ? 'set up your password' : 'reset your password';
  const welcomeText = isInvite ? 'Welcome to MobyLog Admin! Your admin account has been created.' : 'You have requested to reset your MobyLog admin password.';
  
  await sendEmail({
    to: email,
    subject,
    text: `${welcomeText}\n\nTo complete your account setup and ${action}, please click the secure link below:\n\n${setupUrl}\n\nThis link will expire in 24 hours for security purposes.\n\nIf you did not request this ${isInvite ? 'invitation' : 'password reset'}, please contact your system administrator immediately.`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">MobyLog Admin</h1>
        </div>
        
        <div style="padding: 30px; background-color: #f8f9fa;">
          <h2 style="color: #495057; margin-top: 0;">${isInvite ? 'Welcome!' : 'Password Reset Request'}</h2>
          <p style="font-size: 16px; margin-bottom: 25px;">${welcomeText}</p>
          
          <p style="font-size: 16px; margin-bottom: 25px;">
            To complete your account setup and ${action}, please click the secure button below:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${setupUrl}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
              ${isInvite ? 'Set Up Password' : 'Reset Password'}
            </a>
          </div>
          
          <div style="background-color: #e9ecef; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h4 style="color: #6c757d; margin-top: 0; margin-bottom: 15px;">
              <i style="color: #ffc107;">⚠️</i> Security Information:
            </h4>
            <ul style="color: #6c757d; margin-bottom: 0; padding-left: 20px;">
              <li>This secure link will expire in 24 hours</li>
              <li>You will be required to create a strong password</li>
              <li>Access is tracked for security purposes</li>
              <li>Do not share this link with others</li>
            </ul>
          </div>
          
          <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #dee2e6;">
            <p style="color: #6c757d; font-size: 14px; margin-bottom: 10px;">
              <strong>Password Requirements:</strong>
            </p>
            <ul style="color: #6c757d; font-size: 14px; margin-bottom: 20px; padding-left: 20px;">
              <li>At least 8 characters long</li>
              <li>Contains uppercase and lowercase letters</li>
              <li>Contains at least one number</li>
              <li>Contains at least one special character</li>
            </ul>
          </div>
          
          <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
            <em>If you did not request this ${isInvite ? 'invitation' : 'password reset'}, please contact your system administrator immediately.</em>
          </p>
        </div>
        
        <div style="background-color: #343a40; color: #adb5bd; padding: 20px; text-align: center; font-size: 14px;">
          <p style="margin: 0;">© 2024 MobyLog. All rights reserved.</p>
          <p style="margin: 5px 0 0 0;">This is an automated message, please do not reply.</p>
        </div>
      </div>
    `
  });
}

// Legacy functions - deprecated but kept for backwards compatibility
export async function sendWelcomeEmail(email: string, password: string): Promise<void> {
  const loginUrl = process.env.PUBLIC_URL || 'http://localhost:4242';
  
  await sendEmail({
    to: email,
    subject: 'Welcome to MobyLog Admin',
    text: `Welcome to MobyLog Admin!\n\nYour admin account has been created.\n\nEmail: ${email}\nPassword: ${password}\n\nPlease login at: ${loginUrl}/admin/login\n\nWe strongly recommend changing your password after your first login.`,
    html: `
      <h2>Welcome to MobyLog Admin!</h2>
      <p>Your admin account has been created.</p>
      <p><strong>Email:</strong> ${email}<br>
      <strong>Password:</strong> ${password}</p>
      <p>Please login at: <a href="${loginUrl}/admin/login">${loginUrl}/admin/login</a></p>
      <p><em>We strongly recommend changing your password after your first login.</em></p>
    `
  });
}

export async function sendPasswordResetEmail(email: string, newPassword: string): Promise<void> {
  const loginUrl = process.env.PUBLIC_URL || 'http://localhost:4242';
  
  await sendEmail({
    to: email,
    subject: 'Your MobyLog Password Has Been Reset',
    text: `Your password has been reset.\n\nEmail: ${email}\nNew Password: ${newPassword}\n\nPlease login at: ${loginUrl}/admin/login\n\nWe strongly recommend changing your password after login.`,
    html: `
      <h2>Password Reset</h2>
      <p>Your password has been reset.</p>
      <p><strong>Email:</strong> ${email}<br>
      <strong>New Password:</strong> ${newPassword}</p>
      <p>Please login at: <a href="${loginUrl}/admin/login">${loginUrl}/admin/login</a></p>
      <p><em>We strongly recommend changing your password after login.</em></p>
    `
  });
}

export async function sendExportEmail(email: string, downloadUrl: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: 'Your MobyLog Export is Ready',
    text: `Your MobyLog data export is ready.\n\nYou can download it here: ${downloadUrl}\n\nThis secure link will expire in 24 hours and access is tracked for security purposes.`,
    html: `
      <h2>Your Export is Ready</h2>
      <p>Your MobyLog data export has been generated and is ready for download.</p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="${downloadUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Download Export</a>
      </div>
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h4 style="color: #6c757d; margin-top: 0;">Security Information:</h4>
        <ul style="color: #6c757d; margin-bottom: 0;">
          <li>This secure link will expire in 24 hours</li>
          <li>Download access is tracked for security purposes</li>
          <li>Do not share this link with unauthorized users</li>
        </ul>
      </div>
      <p style="color: #6c757d; font-size: 0.9em;"><em>If you did not request this export, please contact your system administrator immediately.</em></p>
    `
  });
}