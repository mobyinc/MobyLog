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
    text: `Your MobyLog data export is ready.\n\nYou can download it here: ${downloadUrl}\n\nThis link will expire in 24 hours.`,
    html: `
      <h2>Your Export is Ready</h2>
      <p>Your MobyLog data export has been generated.</p>
      <p><a href="${downloadUrl}">Download Export</a></p>
      <p><em>This link will expire in 24 hours.</em></p>
    `
  });
}