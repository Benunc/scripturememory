# To Do list
[x] fix mobile issues with things like page shift
[x] revert content of the about us page. 
[x] increase contrast on the placeholder text for guesses
[x] fix the display of the donate page (headers and footers)
[ ] add a method for tracking folks who have visited the "Thank You" page and update their "donated" info in users.
[ ] test and verify points for word guesses stopping after a certain number of guesses
[ ] admin panel to view current users, activity, etc
[ ] explore breaking the verseList file into different but related components or something to make it easier for the AI to see what's going on.
[ ] make updates to the pointsStats page to make it more helpful
  [ ] break down how points were earned
  [ ] show a graph of points and points events per day over time
  [ ] remove last access (it's always today)
[ ] fix whatever happens at three hours of the session, as it's currently not actually logging out. not sure if I want it to, but right now it's definitely not. I can go back the next day and I'm still logged in.


# Admin Panel Implementation Plan

## Overview
The admin panel will provide real-time insights into the application's usage, user engagement, and system health. This plan outlines the implementation strategy, considering both simplicity and scalability.

## Admin Authentication System

### Overview
We will implement a separate authentication system specifically for admin users. This system will be completely isolated from the regular user authentication system, providing better security and clearer separation of concerns.

### Security Features

1. **Password Requirements**
   ```typescript
   interface PasswordPolicy {
     minLength: 16;              // Minimum 16 characters
     requireUppercase: true;     // Must include uppercase letters
     requireLowercase: true;     // Must include lowercase letters
     requireNumbers: true;       // Must include numbers
     requireSpecialChars: true;  // Must include special characters
     maxAge: 90 * 24 * 60 * 60 * 1000; // 90 days password age
   }
   ```

2. **Session Management**
   ```typescript
   interface SessionPolicy {
     maxDuration: 60 * 60 * 1000;     // 1 hour session duration
     maxConcurrentSessions: 1;        // Only one active session per admin
     inactivityTimeout: 15 * 60 * 1000; // 15 minutes inactivity timeout
     requireIpValidation: true;       // Validate IP address on each request
   }
   ```

3. **Access Control**
   ```typescript
   interface AccessPolicy {
     maxLoginAttempts: 5;            // Maximum failed login attempts
     lockoutDuration: 30 * 60 * 1000; // 30 minutes lockout after max attempts
     require2FA: true;               // Require two-factor authentication
     allowedIpRanges: string[];      // Whitelist of allowed IP ranges
   }
   ```

### Implementation Details

1. **Admin User Creation**
   ```typescript
   interface AdminUser {
     id: string;
     email: string;
     passwordHash: string;
     twoFactorSecret?: string;
     isActive: boolean;
     lastLogin?: number;
     failedAttempts: number;
     lockedUntil?: number;
     createdBy: string;  // ID of admin who created this account
     createdAt: number;
     updatedAt: number;
   }
   ```

2. **Session Management**
   ```typescript
   interface AdminSession {
     id: string;
     adminId: string;
     token: string;
     ipAddress: string;
     userAgent: string;
     createdAt: number;
     expiresAt: number;
     lastActivityAt: number;
     isActive: boolean;
   }
   ```

3. **Authentication Flow**
   ```typescript
   class AdminAuthService {
     // Login process
     async login(email: string, password: string, ipAddress: string): Promise<LoginResult> {
       // 1. Check if account is locked
       if (await this.isAccountLocked(email)) {
         throw new Error('Account is locked. Try again later.');
       }

       // 2. Validate credentials
       const admin = await this.validateCredentials(email, password);
       if (!admin) {
         await this.recordFailedAttempt(email);
         throw new Error('Invalid credentials');
       }

       // 3. Check 2FA if enabled
       if (admin.twoFactorSecret) {
         return { requires2FA: true, tempToken: await this.generateTempToken(admin) };
       }

       // 4. Create session
       return await this.createSession(admin, ipAddress);
     }

     // 2FA verification
     async verify2FA(tempToken: string, code: string): Promise<Session> {
       const admin = await this.validateTempToken(tempToken);
       if (!this.verify2FACode(admin.twoFactorSecret, code)) {
         throw new Error('Invalid 2FA code');
       }
       return await this.createSession(admin, ipAddress);
     }

     // Session validation
     async validateSession(token: string, ipAddress: string): Promise<boolean> {
       const session = await this.getSession(token);
       if (!session || !session.isActive) return false;
       
       // Check IP address
       if (session.ipAddress !== ipAddress) {
         await this.invalidateSession(token);
         return false;
       }

       // Check inactivity
       if (Date.now() - session.lastActivityAt > SessionPolicy.inactivityTimeout) {
         await this.invalidateSession(token);
         return false;
       }

       // Update last activity
       await this.updateSessionActivity(token);
       return true;
     }
   }
   ```

4. **Database Schema**
   ```sql
   -- Admin users table
   CREATE TABLE admin_users (
     id TEXT PRIMARY KEY,
     email TEXT UNIQUE NOT NULL,
     password_hash TEXT NOT NULL,
     two_factor_secret TEXT,
     is_active BOOLEAN DEFAULT true,
     last_login INTEGER,
     failed_attempts INTEGER DEFAULT 0,
     locked_until INTEGER,
     created_by TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     FOREIGN KEY (created_by) REFERENCES admin_users(id)
   );

   -- Admin sessions table
   CREATE TABLE admin_sessions (
     id TEXT PRIMARY KEY,
     admin_id TEXT NOT NULL,
     token TEXT UNIQUE NOT NULL,
     ip_address TEXT NOT NULL,
     user_agent TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     expires_at INTEGER NOT NULL,
     last_activity_at INTEGER NOT NULL,
     is_active BOOLEAN DEFAULT true,
     FOREIGN KEY (admin_id) REFERENCES admin_users(id)
   );

   -- Admin audit log
   CREATE TABLE admin_audit_log (
     id TEXT PRIMARY KEY,
     admin_id TEXT NOT NULL,
     action TEXT NOT NULL,
     details JSON,
     ip_address TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     FOREIGN KEY (admin_id) REFERENCES admin_users(id)
   );
   ```

5. **API Endpoints**
   ```typescript
   // Admin authentication endpoints
   router.post('/admin/auth/login', async (req, res) => {
     const { email, password } = req.body;
     const ipAddress = req.ip;
     
     try {
       const result = await adminAuth.login(email, password, ipAddress);
       if (result.requires2FA) {
         res.json({ requires2FA: true, tempToken: result.tempToken });
       } else {
         res.json({ token: result.token });
       }
     } catch (error) {
       res.status(401).json({ error: error.message });
     }
   });

   router.post('/admin/auth/verify-2fa', async (req, res) => {
     const { tempToken, code } = req.body;
     const ipAddress = req.ip;
     
     try {
       const session = await adminAuth.verify2FA(tempToken, code);
       res.json({ token: session.token });
     } catch (error) {
       res.status(401).json({ error: error.message });
     }
   });

   router.post('/admin/auth/logout', async (req, res) => {
     const token = req.headers.authorization?.split(' ')[1];
     if (token) {
       await adminAuth.invalidateSession(token);
     }
     res.status(204).send();
   });
   ```

6. **Middleware for Admin Routes**
   ```typescript
   const adminAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
     const token = req.headers.authorization?.split(' ')[1];
     const ipAddress = req.ip;
     
     if (!token) {
       return res.status(401).json({ error: 'No token provided' });
     }

     try {
       const isValid = await adminAuth.validateSession(token, ipAddress);
       if (!isValid) {
         return res.status(401).json({ error: 'Invalid or expired session' });
       }

       // Add admin info to request
       const session = await adminAuth.getSession(token);
       req.admin = await adminAuth.getAdminById(session.adminId);
       next();
     } catch (error) {
       res.status(401).json({ error: 'Authentication failed' });
     }
   };
   ```

### Security Measures

1. **Password Security**
   - Use Argon2id for password hashing
   - Enforce strong password requirements

2. **Session Security**
   - Use secure, HTTP-only cookies
   - Implement CSRF protection
   - Validate IP addresses
   - Track and limit concurrent sessions

3. **Access Control**
   - IP whitelisting
   - Rate limiting
   - Failed attempt tracking
   - Account lockout

4. **Audit Logging**
   - Log all admin actions
   - Track login attempts
   - Monitor session activity
   - Record IP addresses

### Deployment Strategy

1. **Initial Setup**
   ```bash
   # Create initial admin user
   wrangler d1 execute scripture-memory --file=./migrations/001_create_admin_tables.sql
   node scripts/create-admin.js --email admin@example.com
   ```

2. **Security Configuration**
   ```bash
   # Set up IP whitelist
   wrangler d1 execute scripture-memory --file=./migrations/002_configure_security.sql
   
   # Configure rate limiting
   wrangler d1 execute scripture-memory --file=./migrations/003_configure_rate_limits.sql
   ```

3. **Monitoring Setup**
   ```bash
   # Set up admin access monitoring
   wrangler analytics enable --name admin-access
   
   # Configure alerts
   wrangler alerts create --name admin-login-failure --condition "failed_logins > 3"
   ```

### Testing Strategy

1. **Security Testing**
   ```typescript
   describe('Admin Authentication', () => {
     it('should enforce password policy', async () => {
       const weakPassword = 'password123';
       await expect(adminAuth.createAdmin({
         email: 'test@example.com',
         password: weakPassword
       })).rejects.toThrow('Password does not meet requirements');
     });

     it('should handle failed login attempts', async () => {
       for (let i = 0; i < 5; i++) {
         await expect(adminAuth.login('test@example.com', 'wrongpass'))
           .rejects.toThrow('Invalid credentials');
       }
       await expect(adminAuth.login('test@example.com', 'wrongpass'))
         .rejects.toThrow('Account is locked');
     });
   });
   ```

2. **Session Testing**
   ```typescript
   describe('Admin Sessions', () => {
     it('should invalidate on IP change', async () => {
       const session = await adminAuth.login('test@example.com', 'password');
       const isValid = await adminAuth.validateSession(session.token, 'different-ip');
       expect(isValid).toBe(false);
     });

     it('should timeout on inactivity', async () => {
       const session = await adminAuth.login('test@example.com', 'password');
       // Simulate time passing
       jest.advanceTimersByTime(16 * 60 * 1000); // 16 minutes
       const isValid = await adminAuth.validateSession(session.token, 'original-ip');
       expect(isValid).toBe(false);
     });
   });
   ```

## API Endpoints

### Admin Authentication
1. `POST /admin/auth/login`
   - Authenticate admin users
   - Return session token

2. `POST /admin/auth/logout`
   - Invalidate admin session

### Analytics
1. `GET /admin/analytics/overview`
   - Return key metrics:
     - Total users
     - Active users (last 24h)
     - New users (last 24h)
     - Total points earned
     - Verses added/mastered

2. `GET /admin/analytics/users`
   - List users with pagination
   - Filter by activity, points, etc.

3. `GET /admin/analytics/points`
   - Points distribution
   - Points earned over time
   - Points by activity type

4. `GET /admin/analytics/verses`
   - Most popular verses
   - Mastery rates
   - Average attempts to mastery

## Frontend Implementation

### Components
1. `AdminLayout`
   - Secure wrapper for admin pages
   - Navigation sidebar
   - Header with admin info

2. `AdminLogin`
   - Login form
   - Error handling
   - Session management

3. `Dashboard`
   - Overview cards
   - Real-time metrics
   - Quick filters

4. `UserManagement`
   - User list with search/filter
   - User details view
   - Activity history

5. `Analytics`
   - Charts and graphs
   - Date range selection
   - Export functionality

### State Management
- Use React Context for admin auth state
- Implement admin session persistence
- Handle token refresh

## Security Considerations

1. Rate Limiting
   - Stricter limits for admin endpoints
   - IP-based blocking for failed attempts

2. Session Management
   - Short-lived admin sessions (1 hour)
   - Automatic logout on inactivity
   - Single session per admin

3. Data Access
   - Read-only by default
   - Audit logging for all admin actions
   - IP tracking for admin access

## Implementation Phases

### Phase 1: Foundation
1. Set up admin auth system
2. Create basic admin layout
3. Implement login/logout
4. Add basic user listing

### Phase 2: Analytics
1. Implement analytics events tracking
2. Create daily stats aggregation
3. Build basic dashboard
4. Add user activity views

### Phase 3: Advanced Features
1. Add detailed analytics
2. Implement export functionality
3. Add user management features
4. Create audit logging

## Testing Strategy

1. Unit Tests
   - Admin auth logic
   - Analytics calculations
   - Data transformations

2. Integration Tests
   - API endpoints
   - Database operations
   - Session management

3. E2E Tests
   - Admin login flow
   - Dashboard interactions
   - User management

## Monitoring

1. Admin Access Logging
   - Track all admin logins
   - Monitor failed attempts
   - Log all admin actions

2. Performance Monitoring
   - API response times
   - Database query performance
   - Frontend load times

## Deployment Strategy

1. Database Migrations
   - Create new tables
   - Add indexes
   - Set up triggers for stats

2. API Deployment
   - Deploy new endpoints
   - Update rate limiting
   - Configure CORS

3. Frontend Deployment
   - Add admin routes
   - Deploy new components
   - Update build process

## Future Considerations

1. Role-Based Access
   - Different admin levels
   - Feature permissions
   - Audit trails

2. Advanced Analytics
   - Machine learning insights
   - Predictive metrics
   - Custom reports

3. API Management
   - API key management
   - Usage tracking
   - Rate limiting

## Success Metrics

1. Security
   - Zero unauthorized access
   - No data breaches
   - Proper audit trails

2. Performance
   - < 200ms API response time
   - < 2s page load time
   - Efficient data aggregation

3. Usability
   - Intuitive navigation
   - Clear data presentation
   - Responsive design

