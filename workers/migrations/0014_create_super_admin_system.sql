-- Create super admin system tables
-- Migration: 0014_create_super_admin_system.sql

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

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_type ON user_permissions(permission_type);
CREATE INDEX IF NOT EXISTS idx_user_permissions_active ON user_permissions(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_time ON admin_audit_log(performed_at);
CREATE INDEX IF NOT EXISTS idx_super_admins_email ON super_admins(email); 