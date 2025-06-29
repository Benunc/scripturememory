import { Env } from '../types';
import { getDB, getUserId } from './db';

// Check if user is super admin
export async function isSuperAdmin(userId: number, env: Env): Promise<boolean> {
  const db = getDB(env);
  
  const superAdmin = await db.prepare(`
    SELECT 1 FROM super_admins 
    WHERE user_id = ? AND is_active = TRUE
  `).bind(userId).first();
  
  return !!superAdmin;
}

// Check if user has specific permission
export async function hasPermission(userId: number, permissionType: string, env: Env): Promise<boolean> {
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
export async function requireAdmin(request: Request, env: Env): Promise<{ userId: number; isSuperAdmin: boolean }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = authHeader.split(' ')[1];
  const userId = await getUserId(token, env);
  
  if (!userId) {
    throw new Error('Invalid or expired session');
  }

  const superAdminStatus = await isSuperAdmin(userId, env);
  const hasAdminPermission = await hasPermission(userId, 'manage_users', env);

  if (!superAdminStatus && !hasAdminPermission) {
    throw new Error('Insufficient permissions');
  }

  return { userId, isSuperAdmin: superAdminStatus };
}

// Middleware for super admin only endpoints
export async function requireSuperAdmin(request: Request, env: Env): Promise<number> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = authHeader.split(' ')[1];
  const userId = await getUserId(token, env);
  
  if (!userId) {
    throw new Error('Invalid or expired session');
  }

  const superAdminStatus = await isSuperAdmin(userId, env);
  if (!superAdminStatus) {
    throw new Error('Super admin access required');
  }

  return userId;
}

// Enhanced session validation for admin actions
export async function validateAdminSession(token: string, env: Env): Promise<number> {
  const userId = await getUserId(token, env);
  
  if (!userId) {
    throw new Error('Invalid session');
  }
  
  const db = getDB(env);
  
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
  const sessionCreatedAt = session.created_at as number;
  if (sessionCreatedAt < oneHourAgo) {
    throw new Error('Admin session too old, please re-authenticate');
  }
  
  return userId;
}

// Every admin action must be logged
export async function logAdminAction(
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

// Get user permissions
export async function getUserPermissions(userId: number, env: Env): Promise<any[]> {
  const db = getDB(env);
  
  const permissions = await db.prepare(`
    SELECT 
      up.permission_type,
      up.granted_at,
      up.expires_at,
      up.is_active,
      u.email as granted_by_email
    FROM user_permissions up
    JOIN users u ON up.granted_by = u.id
    WHERE up.user_id = ? AND up.is_active = TRUE
    AND (up.expires_at IS NULL OR up.expires_at > ?)
    ORDER BY up.granted_at DESC
  `).bind(userId, Date.now()).all();
  
  return permissions.results;
}

// Check if user can create groups (permission OR gamification requirements)
export async function canCreateGroups(userId: number, env: Env): Promise<boolean> {
  // Check permission first
  const hasCreatePermission = await hasPermission(userId, 'create_groups', env);
  if (hasCreatePermission) {
    return true;
  }
  
  // Fallback to gamification requirements (for backward compatibility during transition)
  const db = getDB(env);
  const stats = await db.prepare(`
    SELECT total_points, verses_mastered FROM user_stats WHERE user_id = ?
  `).bind(userId).first();
  
  if (!stats) {
    return false;
  }
  
  const totalPoints = stats.total_points as number;
  const versesMastered = stats.verses_mastered as number;
  
  const hasEnoughPoints = totalPoints >= 5000;
  const hasEnoughVerses = versesMastered >= 5;
  
  return hasEnoughPoints || hasEnoughVerses;
} 