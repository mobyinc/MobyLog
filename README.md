# MobyLog

A secure event logging and exporting system with comprehensive admin management.

## Features

- **Secure Admin Authentication**
  - JWT-based authentication with session management
  - Strong password requirements
  - Account lockout after 3 failed login attempts
  - Password reset functionality

- **Admin Management**
  - Invite new admins via email
  - Remove/deactivate admin accounts
  - Reset passwords for other admins
  - Comprehensive activity logging

- **Event Logging**
  - RESTful API for logging events
  - Flexible event structure with custom data
  - Query events by userId, eventType, and name

- **Data Export**
  - Export all event data as CSV
  - Compressed ZIP delivery via email
  - Secure access control

- **Activity Monitoring**
  - Track all admin actions
  - View login attempts and security events
  - Filter and paginate activity logs

## Setup

1. Copy `.env.example` to `.env` and configure:
   ```bash
   cp .env.example .env
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Ensure MongoDB is running

4. Start the server:
   ```bash
   npm run dev
   ```

## Initial Admin

On first startup, an initial admin account will be created:
- Email: Set via `INITIAL_ADMIN_EMAIL` env var (defaults to admin@mobyinc.com)
- Password: Randomly generated and sent via email (or displayed in console if email fails)

## API Endpoints

### Public Endpoints
- `POST /auth/login` - Admin login
- `POST /events` - Log an event (public endpoint)

### Protected Endpoints (require authentication)
- `GET /` - Admin dashboard
- `GET /events` - Query events
- `POST /export` - Request data export
- `GET /admin/manage` - Admin management interface
- `POST /admin/admins/invite` - Invite new admin
- `DELETE /admin/admins/:id` - Remove admin
- `POST /admin/admins/:id/reset-password` - Reset admin password
- `GET /admin/activity` - View activity logs

## Security

- All passwords are hashed using bcrypt
- JWT tokens expire after 24 hours
- Sessions are stored in MongoDB
- Account lockout after 3 failed login attempts (2 hour lockout)
- All admin actions are logged
- HTTPS required in production

## Environment Variables

See `.env.example` for all required environment variables.
