# Migration Guide: HTTP Basic Auth to Admin Login System

This guide helps you migrate from the old HTTP Basic Authentication to the new comprehensive admin login system.

## What's Changed

### Old System
- Single hardcoded admin/password using HTTP Basic Auth
- No user management
- No activity logging
- Simple password stored in environment variable

### New System
- Multiple admin accounts with email/password authentication
- JWT-based authentication with sessions
- Complete admin management (invite, remove, reset)
- Comprehensive activity logging
- Strong password requirements
- Account lockout protection

## Migration Steps

### 1. Update Environment Variables

Add these new environment variables to your `.env` file:

```bash
# Initial admin email (defaults to admin@mobyinc.com)
INITIAL_ADMIN_EMAIL=your-admin@example.com

# JWT secret (CHANGE THIS IN PRODUCTION)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Session secret (CHANGE THIS IN PRODUCTION)
SESSION_SECRET=your-super-secret-session-key-change-this-in-production
```

Remove the old `EXPORT_PASSWORD` variable as it's no longer used.

### 2. Database Changes

The system will automatically create two new collections in MongoDB:
- `admins` - Stores admin user accounts
- `activitylogs` - Stores all admin actions

No manual database migration is required.

### 3. Initial Admin Creation

On first startup after migration:
1. The system will check if any admin accounts exist
2. If none exist, it will create an initial admin account
3. The email will be from `INITIAL_ADMIN_EMAIL` env var (or admin@mobyinc.com)
4. A random password will be generated and:
   - Sent via email if SendGrid is configured
   - Displayed in the console if email fails

### 4. API Changes

#### Authentication
- **Old**: HTTP Basic Auth header on protected endpoints
- **New**: Login via `POST /auth/login`, then use session cookie or JWT token

#### Protected Endpoints
All previously protected endpoints now require admin authentication:
- `GET /export` → Still available but requires admin login
- `GET /events` → Now requires admin authentication

### 5. New Routes

The following new routes are available:
- `/` - Admin dashboard (replaces simple "hello!" message)
- `/admin/login` - Login page
- `/admin/manage` - Admin management interface
- `/admin/activity` - Activity logs viewer

### 6. Client Integration Changes

If you have clients accessing the API:

#### Old Way:
```javascript
// Basic auth header
headers: {
  'Authorization': 'Basic ' + btoa('admin:password123!')
}
```

#### New Way:
```javascript
// 1. Login first
const loginResponse = await fetch('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'your-password'
  })
});
const { token } = await loginResponse.json();

// 2. Use token for subsequent requests
headers: {
  'Authorization': 'Bearer ' + token
}
```

### 7. Security Improvements

The new system includes:
- Password hashing with bcrypt
- Account lockout after 3 failed attempts
- Session management with MongoDB store
- Activity logging for audit trails
- Strong password requirements:
  - At least 8 characters
  - Must include uppercase, lowercase, number, and special character

## Rollback Plan

If you need to rollback:
1. Restore the old `server.ts` file
2. Re-add the `EXPORT_PASSWORD` environment variable
3. Remove the `admins` and `activitylogs` collections from MongoDB
4. Reinstall old dependencies: `npm install express-basic-auth`

## Getting Help

If you encounter issues during migration:
1. Check the server logs for any error messages
2. Ensure all new environment variables are set
3. Verify MongoDB connection is working
4. Check that SendGrid is configured if you want email notifications