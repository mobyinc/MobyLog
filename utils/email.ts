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