# Super Admin Role System Plan

## Overview

This plan outlines the implementation of a super admin role system that allows for granular permission management and administrative actions like group deletion. The system will be centered around the email `ben@wpsteward.com` as the primary super admin.

## Current Issues to Address

1. **No group deletion functionality** - Groups cannot be removed from the system
2. **Gamification-based group creation** - Group creation is restricted by points/verses mastered instead of proper permissions
3. **Frontend-only permission checks** - Group creation restrictions are only enforced in the UI
4. **No administrative controls** - No way to manage users or override permissions
5. **No audit trail** - No logging of administrative actions

## Proposed Solution

### 1. Database Schema Changes

#### New Tables

```sql
-- User permissions table
CREATE TABLE user_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  permission_type TEXT NOT NULL CHECK (permission_type IN ('create_groups', 'delete_groups', 'manage_users', 'view_all_groups')),
  granted_by INTEGER NOT NULL,
  granted_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  expires_at INTEGER, -- NULL for permanent permissions
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, permission_type)
);

-- Admin action audit log
CREATE TABLE admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL, -- 'user', 'group', 'permission'
  target_id INTEGER,
  action_details TEXT, -- JSON string with additional details
  performed_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Super admin configuration
CREATE TABLE super_admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  added_by INTEGER NOT NULL,
  added_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id)
);
```

#### Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_type ON user_permissions(permission_type);
CREATE INDEX IF NOT EXISTS idx_user_permissions_active ON user_permissions(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_time ON admin_audit_log(performed_at);
CREATE INDEX IF NOT EXISTS idx_super_admins_email ON super_admins(email);
```

### 2. Permission System Design

#### Permission Types

1. **`create_groups`** - Allow user to create groups (bypasses gamification requirements)
2. **`delete_groups`** - Allow user to delete groups they own or have admin access to
3. **`manage_users`** - Allow user to grant/revoke permissions for other users
4. **`view_all_groups`** - Allow user to see all groups in the system (not just their own)

#### Permission Hierarchy

```
Super Admin (ben@wpsteward.com)
├── All permissions by default
├── Can grant/revoke any permission
├── Can delete any group
└── Can view all system data

Admin Users (with specific permissions)
├── Limited permissions based on grants
├── Can only perform actions they have permission for
└── Actions are logged for audit

Regular Users
├── No special permissions
├── Cannot create groups (requires explicit permission grant)
└── Can only manage groups they have access to
```

### 3. API Endpoints to Implement

#### Super Admin Endpoints

```typescript
// Permission management
POST /admin/permissions/grant
POST /admin/permissions/revoke
GET /admin/permissions/user/:userId
GET /admin/permissions/all

// Group management
DELETE /groups/:id
GET /admin/groups/all

// User management
GET /admin/users/all
POST /admin/users/:userId/delete

// Audit log
GET /admin/audit-log
```

#### Enhanced Group Endpoints

```typescript
// Modified existing endpoints
POST /groups/create (now checks permissions)
DELETE /groups/:id (new endpoint)
```

### 4. Implementation Plan

#### Phase 1: Database Migration

1. Create migration file for new tables
2. Insert initial super admin record for `ben@wpsteward.com`
3. Test migration in development

#### Phase 2: Permission System Core

1. Create permission checking utilities
2. Implement super admin detection
3. Add permission validation middleware
4. Create audit logging system

#### Phase 3: Group Deletion

1. Implement `DELETE /groups/:id` endpoint
2. Add permission checks to group creation
3. Update frontend to show delete buttons for authorized users
4. Add confirmation dialogs

#### Phase 3.5: Remove Gamification Requirements

1. Remove gamification checks from frontend group creation logic
2. Update frontend to only show "Create Group" button for users with `create_groups` permission
3. Remove gamification-related UI elements and messaging
4. Update error messages to reference permission requirements instead of gamification

#### Phase 4: Admin Interface

1. Create admin dashboard component
2. Implement permission management UI
3. Add group management interface
4. Create audit log viewer

#### Phase 5: Testing & Security

1. Comprehensive test coverage
2. Security review
3. Permission validation testing
4. Audit trail verification

### 5. Permission Checking Logic

#### Backend Permission Check Function

```typescript
async function checkPermission(
  userId: number, 
  permissionType: string, 
  env: Env
): Promise<boolean> {
  const db = getDB(env);
  
  // Check if user is super admin
  const isSuperAdmin = await db.prepare(`
    SELECT 1 FROM super_admins 
    WHERE user_id = ? AND is_active = TRUE
  `).bind(userId).first();
  
  if (isSuperAdmin) return true;
  
  // Check specific permission
  const permission = await db.prepare(`
    SELECT 1 FROM user_permissions 
    WHERE user_id = ? AND permission_type = ? AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > ?)
  `).bind(userId, permissionType, Date.now()).first();
  
  return !!permission;
}
```

#### Enhanced Group Creation Logic

```typescript
// In createGroup function
const canCreateGroups = await checkPermission(userId, 'create_groups', env);

if (!canCreateGroups) {
  return new Response(JSON.stringify({ 
    error: 'You do not have permission to create groups. Contact an administrator.' 
  }), { 
    status: 403,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### 6. Security Considerations

#### Authentication & Authorization

1. **Super admin status** should be verified on every admin action
2. **Permission checks** should happen before any protected operation
3. **Audit logging** should be comprehensive and tamper-proof
4. **Rate limiting** should be stricter for admin endpoints

#### Data Protection

1. **Permission grants** should be logged with admin details
2. **Group deletions** should be logged with reason and admin
3. **User deletions** should be soft deletes with audit trail
4. **Sensitive operations** should require confirmation

### 6.5. Admin/Super-Admin Validation Implementation

#### Middleware Functions

```typescript
// Check if user is super admin
async function isSuperAdmin(userId: number, env: Env): Promise<boolean> {
  const db = getDB(env);
  
  const superAdmin = await db.prepare(`
    SELECT 1 FROM super_admins 
    WHERE user_id = ? AND is_active = TRUE
  `).bind(userId).first();
  
  return !!superAdmin;
}

// Check if user has specific permission
async function hasPermission(userId: number, permissionType: string, env: Env): Promise<boolean> {
  // Super admins have all permissions
  if (await isSuperAdmin(userId, env)) {
    return true;
  }
  
  const db = getDB(env);
  
  const permission = await db.prepare(`
    SELECT 1 FROM user_permissions 
    WHERE user_id = ? AND permission_type = ? AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > ?)
  `).bind(userId, permissionType, Date.now()).first();
  
  return !!permission;
}

// Middleware for admin endpoints
async function requireAdmin(request: Request, env: Env): Promise<{ userId: number; isSuperAdmin: boolean }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = authHeader.split(' ')[1];
  const userId = await getUserId(token, env);
  
  if (!userId) {
    throw new Error('Invalid or expired session');
  }

  const isSuperAdmin = await isSuperAdmin(userId, env);
  const hasAdminPermission = await hasPermission(userId, 'manage_users', env);

  if (!isSuperAdmin && !hasAdminPermission) {
    throw new Error('Insufficient permissions');
  }

  return { userId, isSuperAdmin };
}

// Middleware for super admin only endpoints
async function requireSuperAdmin(request: Request, env: Env): Promise<number> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = authHeader.split(' ')[1];
  const userId = await getUserId(token, env);
  
  if (!userId) {
    throw new Error('Invalid or expired session');
  }

  const isSuperAdmin = await isSuperAdmin(userId, env);
  if (!isSuperAdmin) {
    throw new Error('Super admin access required');
  }

  return userId;
}
```

#### Practical Implementation in Endpoints

```typescript
// Example: Grant permission endpoint
grantPermission: async (request: Request, env: Env): Promise<Response> => {
  try {
    // Require admin access
    const { userId, isSuperAdmin } = await requireAdmin(request, env);
    
    const { targetUserId, permissionType, expiresAt } = await request.json();
    
    // Validate permission type
    const validPermissions = ['create_groups', 'delete_groups', 'manage_users', 'view_all_groups'];
    if (!validPermissions.includes(permissionType)) {
      return new Response(JSON.stringify({ error: 'Invalid permission type' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = getDB(env);
    
    // Check if target user exists
    const targetUser = await db.prepare(`
      SELECT id, email FROM users WHERE id = ?
    `).bind(targetUserId).first();
    
    if (!targetUser) {
      return new Response(JSON.stringify({ error: 'Target user not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Grant permission
    await db.prepare(`
      INSERT OR REPLACE INTO user_permissions 
      (user_id, permission_type, granted_by, granted_at, expires_at, is_active)
      VALUES (?, ?, ?, ?, ?, TRUE)
    `).bind(targetUserId, permissionType, userId, Date.now(), expiresAt || null).run();

    // Log the action
    await db.prepare(`
      INSERT INTO admin_audit_log 
      (admin_user_id, action_type, target_type, target_id, action_details)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      userId, 
      'grant_permission', 
      'user', 
      targetUserId, 
      JSON.stringify({ permissionType, expiresAt })
    ).run();

    return new Response(JSON.stringify({ 
      success: true,
      message: `Permission ${permissionType} granted to ${targetUser.email}`
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (error.message === 'Insufficient permissions') {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.error('Error granting permission:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Example: Delete group endpoint (super admin or group creator with delete permission)
deleteGroup: async (request: Request, env: Env): Promise<Response> => {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.split(' ')[1];
    const userId = await getUserId(token, env);
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const groupId = url.pathname.split('/')[2];

    const db = getDB(env);
    
    // Check if user is super admin
    const isSuperAdmin = await isSuperAdmin(userId, env);
    
    // Check if user is group creator
    const isCreator = await db.prepare(`
      SELECT 1 FROM group_members 
      WHERE group_id = ? AND user_id = ? AND role = 'creator'
    `).bind(groupId, userId).first();
    
    // Check if user has delete permission
    const hasDeletePermission = await hasPermission(userId, 'delete_groups', env);
    
    // Allow if super admin, creator with delete permission, or any user with delete permission
    if (!isSuperAdmin && !isCreator && !hasDeletePermission) {
      return new Response(JSON.stringify({ error: 'You do not have permission to delete this group' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get group info for audit log
    const group = await db.prepare(`
      SELECT name FROM groups WHERE id = ?
    `).bind(groupId).first();
    
    if (!group) {
      return new Response(JSON.stringify({ error: 'Group not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Soft delete the group
    await db.prepare(`
      UPDATE groups SET is_active = FALSE WHERE id = ?
    `).bind(groupId).run();

    // Deactivate all memberships
    await db.prepare(`
      UPDATE group_members SET is_active = FALSE WHERE group_id = ?
    `).bind(groupId).run();

    // Log the action
    await db.prepare(`
      INSERT INTO admin_audit_log 
      (admin_user_id, action_type, target_type, target_id, action_details)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      userId, 
      'delete_group', 
      'group', 
      groupId, 
      JSON.stringify({ 
        groupName: group.name, 
        reason: 'Admin deletion',
        isSuperAdmin,
        isCreator,
        hasDeletePermission
      })
    ).run();

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Group deleted successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting group:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

#### Security Measures

**1. Rate Limiting for Admin Endpoints**
```typescript
// Stricter rate limiting for admin actions
const adminRateLimiter = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many admin requests, please try again later'
};
```

**2. Session Validation**
```typescript
// Enhanced session validation for admin actions
async function validateAdminSession(token: string, env: Env): Promise<number> {
  const userId = await getUserId(token, env);
  
  if (!userId) {
    throw new Error('Invalid session');
  }
  
  // Check if session is recent (within last hour for admin actions)
  const session = await db.prepare(`
    SELECT created_at FROM sessions 
    WHERE token = ? AND expires_at > ?
  `).bind(token, Date.now()).first();
  
  if (!session) {
    throw new Error('Session expired');
  }
  
  // Require recent session for admin actions
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  if (session.created_at < oneHourAgo) {
    throw new Error('Admin session too old, please re-authenticate');
  }
  
  return userId;
}
```

**3. Audit Trail Requirements**
```typescript
// Every admin action must be logged
async function logAdminAction(
  adminUserId: number, 
  actionType: string, 
  targetType: string, 
  targetId: number, 
  details: any, 
  env: Env
): Promise<void> {
  const db = getDB(env);
  
  await db.prepare(`
    INSERT INTO admin_audit_log 
    (admin_user_id, action_type, target_type, target_id, action_details, performed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    adminUserId, 
    actionType, 
    targetType, 
    targetId, 
    JSON.stringify(details), 
    Date.now()
  ).run();
}
```

#### Frontend Permission Checking

```typescript
// Frontend permission checking
const checkUserPermissions = async (): Promise<Permission[]> => {
  const response = await fetch(`${getApiUrl()}/admin/permissions/user/${userId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) {
    if (response.status === 403) {
      // User is not an admin
      return [];
    }
    throw new Error('Failed to check permissions');
  }
  
  return response.json();
};

// Check if user is super admin
const checkSuperAdminStatus = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${getApiUrl()}/admin/super-admin/check`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    return response.ok;
  } catch {
    return false;
  }
};
```

### 7. Frontend Changes

#### Remove Gamification Requirements

**Current Frontend Logic (to be removed):**
```typescript
// OLD: Gamification-based group creation
const checkCreatePermission = async () => {
  const stats = await response.json();
  const hasEnoughPoints = stats.total_points >= 5000;
  const hasEnoughVerses = stats.verses_mastered >= 5;
  setCanCreateGroup(hasEnoughPoints || hasEnoughVerses);
};
```

**New Frontend Logic:**
```typescript
// NEW: Permission-based group creation
const checkCreatePermission = async () => {
  const permissions = await fetch(`${getApiUrl()}/admin/permissions/user/${userId}`);
  const hasPermission = permissions.some(p => p.permission_type === 'create_groups');
  setCanCreateGroup(hasPermission);
};
```

**UI Changes:**
- Remove gamification requirement messaging
- Remove "You've proven your commitment!" text
- Update to show "Contact administrator for group creation permissions"
- Simplify group creation flow

#### Admin Dashboard

```typescript
// New admin dashboard component
interface AdminDashboard {
  permissions: Permission[];
  users: User[];
  groups: Group[];
  auditLog: AuditEntry[];
}
```

#### Enhanced Group Management

```typescript
// Modified group creation logic - purely permission-based
const canCreateGroup = await checkUserPermissions('create_groups');
const showCreateButton = canCreateGroup; // No gamification requirements

// New group deletion functionality
const canDeleteGroup = await checkUserPermissions('delete_groups') || isGroupCreator;
```

### 8. Testing Strategy

#### Unit Tests

1. Permission checking logic
2. Super admin detection
3. Audit logging
4. Group deletion validation

#### Integration Tests

1. End-to-end permission granting
2. Group creation with/without permissions
3. Group deletion workflows
4. Admin dashboard functionality

#### Security Tests

1. Permission bypass attempts
2. Unauthorized admin actions
3. Audit log integrity
4. Super admin privilege escalation

### 9. Migration Strategy

#### Development Phase

1. Create new tables alongside existing ones
2. Implement permission system in parallel
3. Test thoroughly before production

#### Production Deployment

1. Deploy database migration
2. Insert super admin record
3. Deploy new API endpoints
4. Update frontend gradually
5. Monitor for issues

### 10. Future Enhancements

#### Advanced Features

1. **Permission expiration** - Time-limited permissions
2. **Role-based permissions** - Predefined permission sets
3. **Bulk operations** - Grant permissions to multiple users
4. **Permission templates** - Standard permission sets for common roles

#### Monitoring & Analytics

1. **Permission usage tracking** - See which permissions are used most
2. **Admin action analytics** - Monitor admin activity patterns
3. **Permission effectiveness** - Track how permissions affect user behavior

## Implementation Priority

1. **High Priority**: Database migration and super admin setup
2. **High Priority**: Group deletion endpoint with permissions
3. **Medium Priority**: Enhanced group creation with API-level permissions
4. **Medium Priority**: Basic admin dashboard
5. **Low Priority**: Advanced admin features and analytics

## Success Metrics

- ✅ Super admin can perform all administrative actions
- ✅ Group deletion works with proper permissions
- ✅ Group creation is purely permission-based (no gamification requirements)
- ✅ All admin actions are properly logged
- ✅ No unauthorized access to admin functions
- ✅ System maintains backward compatibility for regular users
- ✅ Frontend no longer shows group creation for users without permissions 