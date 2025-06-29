import { Env } from '../types';
import { getDB } from '../utils/db';
import { 
  requireAdmin, 
  requireSuperAdmin, 
  hasPermission, 
  logAdminAction, 
  getUserPermissions,
  isSuperAdmin 
} from '../utils/admin';

interface GrantPermissionRequest {
  targetUserId: number;
  permissionType: string;
  expiresAt?: number;
}

interface RevokePermissionRequest {
  targetUserId: number;
  permissionType: string;
}

export const handleAdmin = {
  // Grant permission to user
  grantPermission: async (request: Request, env: Env): Promise<Response> => {
    try {
      // Require admin access
      const { userId, isSuperAdmin } = await requireAdmin(request, env);
      
      const { targetUserId, permissionType, expiresAt } = await request.json() as GrantPermissionRequest;
      
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
      await logAdminAction(
        userId, 
        'grant_permission', 
        'user', 
        targetUserId, 
        { permissionType, expiresAt },
        env
      );

      return new Response(JSON.stringify({ 
        success: true,
        message: `Permission ${permissionType} granted to ${targetUser.email}`
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid or expired session') {
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
  },

  // Revoke permission from user
  revokePermission: async (request: Request, env: Env): Promise<Response> => {
    try {
      // Require admin access
      const { userId } = await requireAdmin(request, env);
      
      const { targetUserId, permissionType } = await request.json() as RevokePermissionRequest;
      
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

      // Revoke permission
      await db.prepare(`
        UPDATE user_permissions 
        SET is_active = FALSE 
        WHERE user_id = ? AND permission_type = ?
      `).bind(targetUserId, permissionType).run();

      // Log the action
      await logAdminAction(
        userId, 
        'revoke_permission', 
        'user', 
        targetUserId, 
        { permissionType },
        env
      );

      return new Response(JSON.stringify({ 
        success: true,
        message: `Permission ${permissionType} revoked from ${targetUser.email}`
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid or expired session') {
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
      
      console.error('Error revoking permission:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Get user permissions
  getUserPermissions: async (request: Request, env: Env): Promise<Response> => {
    try {
      // Require admin access
      const { userId } = await requireAdmin(request, env);
      
      const url = new URL(request.url);
      const targetUserId = parseInt(url.pathname.split('/')[3]);
      
      if (isNaN(targetUserId)) {
        return new Response(JSON.stringify({ error: 'Invalid user ID' }), { 
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
        return new Response(JSON.stringify({ error: 'User not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get permissions
      const permissions = await getUserPermissions(targetUserId, env);

      return new Response(JSON.stringify({ 
        success: true,
        user: targetUser,
        permissions
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid or expired session') {
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
      
      console.error('Error getting user permissions:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Get all permissions
  getAllPermissions: async (request: Request, env: Env): Promise<Response> => {
    try {
      // Require admin access
      const { userId } = await requireAdmin(request, env);
      
      const db = getDB(env);
      
      const permissions = await db.prepare(`
        SELECT 
          up.id,
          up.user_id,
          up.permission_type,
          up.granted_at,
          up.expires_at,
          up.is_active,
          u.email as user_email,
          g.email as granted_by_email
        FROM user_permissions up
        JOIN users u ON up.user_id = u.id
        JOIN users g ON up.granted_by = g.id
        WHERE up.is_active = TRUE
        AND (up.expires_at IS NULL OR up.expires_at > ?)
        ORDER BY up.granted_at DESC
      `).bind(Date.now()).all();

      return new Response(JSON.stringify({ 
        success: true,
        permissions: permissions.results
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid or expired session') {
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
      
      console.error('Error getting all permissions:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Get all groups (admin only)
  getAllGroups: async (request: Request, env: Env): Promise<Response> => {
    try {
      // Require admin access
      const { userId } = await requireAdmin(request, env);
      
      const db = getDB(env);
      
      const groups = await db.prepare(`
        SELECT 
          g.id,
          g.name,
          g.description,
          g.created_at,
          g.is_active,
          u.email as creator_email,
          (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND is_active = TRUE) as member_count
        FROM groups g
        JOIN users u ON g.created_by = u.id
        ORDER BY g.created_at DESC
      `).all();

      return new Response(JSON.stringify({ 
        success: true,
        groups: groups.results
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid or expired session') {
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
      
      console.error('Error getting all groups:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Get all users (admin only)
  getAllUsers: async (request: Request, env: Env): Promise<Response> => {
    try {
      // Require admin access
      const { userId } = await requireAdmin(request, env);
      
      const db = getDB(env);
      
      const users = await db.prepare(`
        SELECT 
          u.id,
          u.email,
          u.created_at,
          us.total_points,
          us.verses_mastered,
          us.current_streak,
          us.longest_streak,
          (SELECT COUNT(*) FROM group_members WHERE user_id = u.id AND is_active = TRUE) as group_count
        FROM users u
        LEFT JOIN user_stats us ON u.id = us.user_id
        ORDER BY u.created_at DESC
      `).all();

      return new Response(JSON.stringify({ 
        success: true,
        users: users.results
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid or expired session') {
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
      
      console.error('Error getting all users:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Get audit log
  getAuditLog: async (request: Request, env: Env): Promise<Response> => {
    try {
      // Require admin access
      const { userId } = await requireAdmin(request, env);
      
      const db = getDB(env);
      
      const auditLog = await db.prepare(`
        SELECT 
          al.id,
          al.action_type,
          al.target_type,
          al.target_id,
          al.action_details,
          al.performed_at,
          u.email as admin_email
        FROM admin_audit_log al
        JOIN users u ON al.admin_user_id = u.id
        ORDER BY al.performed_at DESC
        LIMIT 100
      `).all();

      return new Response(JSON.stringify({ 
        success: true,
        auditLog: auditLog.results
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid or expired session') {
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
      
      console.error('Error getting audit log:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Check super admin status
  checkSuperAdmin: async (request: Request, env: Env): Promise<Response> => {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.split(' ')[1];
      const { getUserId } = await import('../utils/db');
      const userId = await getUserId(token, env);
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const superAdminStatus = await isSuperAdmin(userId, env);

      return new Response(JSON.stringify({ 
        success: true,
        isSuperAdmin: superAdminStatus
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error checking super admin status:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Delete a group (super admin only)
  deleteGroup: async (request: Request, env: Env): Promise<Response> => {
    try {
      // Require super admin access
      const userId = await requireSuperAdmin(request, env);
      
      const url = new URL(request.url);
      const groupId = parseInt(url.pathname.split('/')[3]); // /admin/groups/:id/delete
      
      if (isNaN(groupId)) {
        return new Response(JSON.stringify({ error: 'Invalid group ID' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const db = getDB(env);

      // Check if group exists
      const group = await db.prepare(`
        SELECT id, name FROM groups WHERE id = ? AND is_active = 1
      `).bind(groupId).first();

      if (!group) {
        return new Response(JSON.stringify({ error: 'Group not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Soft delete the group and all related data
      await db.batch([
        // Deactivate group members
        db.prepare('UPDATE group_members SET is_active = FALSE WHERE group_id = ?').bind(groupId),
        
        // Deactivate group invitations
        db.prepare('UPDATE group_invitations SET is_accepted = TRUE WHERE group_id = ?').bind(groupId),
        
        // Soft delete the group
        db.prepare('UPDATE groups SET is_active = FALSE WHERE id = ?').bind(groupId)
      ]);

      // Log the action
      await logAdminAction(userId, 'delete_group', 'group', groupId, `Deleted group: ${group.name}`, env);

      return new Response(JSON.stringify({ 
        success: true,
        message: `Group "${group.name}" has been deleted`
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid or expired session') {
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
      
      console.error('Error deleting group:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Remove member from group (super admin or group leader/creator)
  removeMember: async (request: Request, env: Env): Promise<Response> => {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.split(' ')[1];
      const { getUserId } = await import('../utils/db');
      const userId = await getUserId(token, env);
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const url = new URL(request.url);
      const groupId = parseInt(url.pathname.split('/')[3]); // /admin/groups/:id/members/:memberId/remove
      const memberId = parseInt(url.pathname.split('/')[5]);
      
      if (isNaN(groupId) || isNaN(memberId)) {
        return new Response(JSON.stringify({ error: 'Invalid group ID or member ID' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const db = getDB(env);

      // Check if user is super admin
      const userIsSuperAdmin = await isSuperAdmin(userId, env);

      // If not super admin, check if user is a leader or creator of this group
      if (!userIsSuperAdmin) {
        const userRole = await db.prepare(`
          SELECT role FROM group_members 
          WHERE group_id = ? AND user_id = ? AND is_active = 1
        `).bind(groupId, userId).first();

        if (!userRole || !['leader', 'creator'].includes(userRole.role as string)) {
          return new Response(JSON.stringify({ error: 'You must be a leader or creator of this group, or a super admin, to remove members' }), { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Check if group exists
      const group = await db.prepare(`
        SELECT id, name FROM groups WHERE id = ? AND is_active = 1
      `).bind(groupId).first();

      if (!group) {
        return new Response(JSON.stringify({ error: 'Group not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if member exists in group
      const member = await db.prepare(`
        SELECT gm.user_id, gm.role, u.email
        FROM group_members gm
        JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = ? AND gm.user_id = ? AND gm.is_active = 1
      `).bind(groupId, memberId).first();

      if (!member) {
        return new Response(JSON.stringify({ error: 'Member not found in group' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Prevent leaders/creators from removing themselves (super admins can)
      if (!userIsSuperAdmin && userId === memberId) {
        return new Response(JSON.stringify({ error: 'You cannot remove yourself from the group' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Remove member from group (soft delete)
      await db.prepare(`
        UPDATE group_members SET is_active = FALSE WHERE group_id = ? AND user_id = ?
      `).bind(groupId, memberId).run();

      // Log the action
      await logAdminAction(userId, 'remove_member', 'group_member', memberId, 
        `Removed ${member.email} from group: ${group.name}`, env);

      return new Response(JSON.stringify({ 
        success: true,
        message: `${member.email} has been removed from group "${group.name}"`
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      if (error.message === 'Unauthorized' || error.message === 'Invalid or expired session') {
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
      
      console.error('Error removing member:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}; 