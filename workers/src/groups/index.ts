import { Env } from '../types';
import { getDB, getUserId } from '../utils/db';
import { canCreateGroups } from '../utils/admin';
import { getRandomSillyName } from '../utils/sillyNames';

interface CreateGroupRequest {
  name: string;
  description?: string;
}

interface AssignLeaderRequest {
  email: string;
}

interface DemoteLeaderRequest {
  email: string;
}

interface InviteMemberRequest {
  email: string;
}

interface JoinGroupRequest {
  invitationId: number;
}

interface UpdateDisplayNameRequest {
  displayName: string;
}

interface UpdatePrivacyRequest {
  isPublic: boolean;
}

interface LeaderboardQuery {
  metric?: 'points' | 'verses_mastered' | 'current_streak' | 'longest_streak';
  timeframe?: 'all' | 'week' | 'month' | 'year';
}

interface LeaderboardEntry {
  rank: number;
  user_id: number;
  display_name: string;
  points: number;
  verses_mastered: number;
  current_streak: number;
  longest_streak: number;
  is_public: boolean;
}

interface GroupStats {
  total_members: number;
  active_members: number;
  total_points: number;
  total_verses_mastered: number;
  average_points_per_member: number;
  top_performer: {
    user_id: number;
    display_name: string;
    points: number;
  };
  recent_activity: {
    new_members_this_week: number;
    verses_mastered_this_week: number;
    points_earned_this_week: number;
  };
}

interface MemberRanking {
  user_id: number;
  display_name: string;
  rank: number;
  total_members: number;
  percentile: number;
  metrics: {
    points: number;
    verses_mastered: number;
    current_streak: number;
    longest_streak: number;
  };
  next_rank?: {
    rank: number;
    points_needed: number;
  };
}

// Generate a secure random invitation code
function generateInvitationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const handleGroups = {
  // Create a new group
  createGroup: async (request: Request, env: Env): Promise<Response> => {
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

      // Check if user can create groups (permission OR gamification requirements)
      const canCreate = await canCreateGroups(userId, env);
      if (!canCreate) {
        return new Response(JSON.stringify({ 
          error: 'You need permission to create groups. Contact an administrator or earn 5,000+ points or master 5+ verses.'
        }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { name, description } = await request.json() as CreateGroupRequest;
      
      // Validation
      if (!name || name.trim().length === 0) {
        return new Response(JSON.stringify({ error: 'Group name is required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const trimmedName = name.trim();
      if (trimmedName.length < 2 || trimmedName.length > 50) {
        return new Response(JSON.stringify({ error: 'Group name must be between 2 and 50 characters' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const db = getDB(env);

      // Check for duplicate group names (case-insensitive)
      const existingGroup = await db.prepare(`
        SELECT 1 FROM groups WHERE LOWER(name) = LOWER(?) AND is_active = 1
      `).bind(trimmedName).first();

      if (existingGroup) {
        return new Response(JSON.stringify({ error: 'A group with this name already exists' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Create group
      const result = await db.prepare(`
        INSERT INTO groups (name, description, created_by, created_at)
        VALUES (?, ?, ?, ?)
      `).bind(trimmedName, description || null, userId, Date.now()).run();

      const groupId = result.meta.last_row_id;

      // Add creator as a member with 'creator' role
      const sillyName = await getRandomSillyName(db);
      await db.prepare(`
        INSERT INTO group_members (group_id, user_id, role, joined_at, display_name)
        VALUES (?, ?, 'creator', ?, ?)
      `).bind(groupId, userId, Date.now(), sillyName).run();

      // Get the created group with creator info
      const group = await db.prepare(`
        SELECT 
          g.id, g.name, g.description, g.created_by, g.created_at,
          u.email as creator_email
        FROM groups g
        JOIN users u ON g.created_by = u.id
        WHERE g.id = ?
      `).bind(groupId).first();

      return new Response(JSON.stringify({ 
        success: true, 
        group: group,
        message: 'Group created successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error creating group:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Check if user can create groups
  canCreate: async (request: Request, env: Env): Promise<Response> => {
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

      // Check if user can create groups (permission OR gamification requirements)
      const canCreate = await canCreateGroups(userId, env);

      return new Response(JSON.stringify({ 
        success: true,
        canCreate: canCreate
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error checking create permission:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Get group leaders
  getLeaders: async (request: Request, env: Env): Promise<Response> => {
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

      // Get all leaders with their roles
      const leaders = await db.prepare(`
        SELECT 
          gm.user_id,
          gm.role,
          gm.joined_at as assigned_at,
          u.email as leader_email
        FROM group_members gm
        JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = ? AND gm.role IN ('leader', 'creator')
        ORDER BY gm.joined_at ASC
      `).bind(groupId).all();

      return new Response(JSON.stringify({ 
        success: true, 
        leaders: leaders.results
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error getting leaders:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Assign a new leader
  assignLeader: async (request: Request, env: Env): Promise<Response> => {
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

      const { email } = await request.json() as AssignLeaderRequest;

      if (!email || email.trim().length === 0) {
        return new Response(JSON.stringify({ error: 'Email is required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const db = getDB(env);

      // Check if user is super admin
      const isSuperAdmin = await db.prepare(`
        SELECT 1 FROM super_admins 
        WHERE user_id = ? AND is_active = TRUE
      `).bind(userId).first();

      // If not super admin, check if user can assign leaders
      if (!isSuperAdmin) {
        const canAssign = await db.prepare(`
          SELECT role FROM group_members 
          WHERE group_id = ? AND user_id = ? AND role IN ('leader', 'creator')
        `).bind(groupId, userId).first();

        if (!canAssign) {
          return new Response(JSON.stringify({ error: 'You do not have permission to assign leaders' }), { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Find user by email
      const targetUser = await db.prepare(`
        SELECT id FROM users WHERE email = ?
      `).bind(email.trim()).first();

      if (!targetUser) {
        return new Response(JSON.stringify({ error: 'User not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if user is already a leader or creator
      const existingLeader = await db.prepare(`
        SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? AND role IN ('leader', 'creator')
      `).bind(groupId, targetUser.id).first();

      if (existingLeader) {
        return new Response(JSON.stringify({ error: 'User is already a leader or creator' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if user is a member of the group
      const existingMember = await db.prepare(`
        SELECT 1, is_active FROM group_members WHERE group_id = ? AND user_id = ?
      `).bind(groupId, targetUser.id).first();

      if (existingMember) {
        if (existingMember.is_active) {
          // Update existing member to leader
          await db.prepare(`
            UPDATE group_members SET role = 'leader' WHERE group_id = ? AND user_id = ?
          `).bind(groupId, targetUser.id).run();
        } else {
          // Reactivate soft-deleted member as leader
          await db.prepare(`
            UPDATE group_members SET is_active = 1, role = 'leader', joined_at = ? 
            WHERE group_id = ? AND user_id = ?
          `).bind(Date.now(), groupId, targetUser.id).run();
        }
      } else {
        // Add new member as leader
        const sillyName = await getRandomSillyName(db);
        await db.prepare(`
          INSERT INTO group_members (group_id, user_id, role, joined_at, display_name)
          VALUES (?, ?, 'leader', ?, ?)
        `).bind(groupId, targetUser.id, Date.now(), sillyName).run();
      }

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Leader assigned successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error assigning leader:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Demote a leader to regular member
  demoteLeader: async (request: Request, env: Env): Promise<Response> => {
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

      const { email } = await request.json() as DemoteLeaderRequest;

      if (!email || email.trim().length === 0) {
        return new Response(JSON.stringify({ error: 'Email is required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const db = getDB(env);

      // Check if user is super admin
      const isSuperAdmin = await db.prepare(`
        SELECT 1 FROM super_admins 
        WHERE user_id = ? AND is_active = TRUE
      `).bind(userId).first();

      // If not super admin, check if user can demote leaders
      if (!isSuperAdmin) {
        const canDemote = await db.prepare(`
          SELECT role FROM group_members 
          WHERE group_id = ? AND user_id = ? AND role IN ('leader', 'creator')
        `).bind(groupId, userId).first();

        if (!canDemote) {
          return new Response(JSON.stringify({ error: 'You do not have permission to demote leaders' }), { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Find user by email
      const targetUser = await db.prepare(`
        SELECT id FROM users WHERE email = ?
      `).bind(email.trim()).first();

      if (!targetUser) {
        return new Response(JSON.stringify({ error: 'User not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if user is a leader (not creator)
      const existingLeader = await db.prepare(`
        SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND role = 'leader'
      `).bind(groupId, targetUser.id).first();

      if (!existingLeader) {
        return new Response(JSON.stringify({ error: 'User is not a leader or is a creator (creators cannot be demoted)' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Demote leader to member
      await db.prepare(`
        UPDATE group_members SET role = 'member' WHERE group_id = ? AND user_id = ?
      `).bind(groupId, targetUser.id).run();

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Leader demoted to member successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error demoting leader:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Invite user to group
  inviteMember: async (request: Request, env: Env): Promise<Response> => {
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

      const { email } = await request.json() as InviteMemberRequest;

      if (!email || email.trim().length === 0) {
        return new Response(JSON.stringify({ error: 'Email is required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const db = getDB(env);

      // Check if current user can invite (leaders and creators)
      const canInvite = await db.prepare(`
        SELECT role FROM group_members 
        WHERE group_id = ? AND user_id = ? AND role IN ('leader', 'creator')
      `).bind(groupId, userId).first();

      if (!canInvite) {
        return new Response(JSON.stringify({ error: 'You do not have permission to invite members' }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if the email belongs to an existing user
      const existingUser = await db.prepare(`
        SELECT id FROM users WHERE email = ?
      `).bind(email.trim()).first();

      if (!existingUser) {
        return new Response(JSON.stringify({ error: 'User with this email address does not exist in the system' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if user is already a member (including soft-deleted records)
      const existingMember = await db.prepare(`
        SELECT 1, is_active FROM group_members WHERE group_id = ? AND user_id = ?
      `).bind(groupId, existingUser.id).first();

      if (existingMember) {
        if (existingMember.is_active) {
          return new Response(JSON.stringify({ error: 'User is already a member of this group' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          // Reactivate the soft-deleted member
          await db.prepare(`
            UPDATE group_members SET is_active = 1, role = 'member', joined_at = ? 
            WHERE group_id = ? AND user_id = ?
          `).bind(Date.now(), groupId, existingUser.id).run();

          return new Response(JSON.stringify({ 
            success: true,
            message: `User ${existingUser.email} has been reactivated in group ${groupId}`
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Check if invitation already exists
      const existingInvitation = await db.prepare(`
        SELECT 1 FROM group_invitations 
        WHERE group_id = ? AND email = ? AND is_accepted = FALSE AND expires_at > ?
      `).bind(groupId, email.trim(), Date.now()).first();

      if (existingInvitation) {
        return new Response(JSON.stringify({ error: 'Invitation already exists for this user' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Create invitation (expires in 7 days)
      const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
      const invitationCode = generateInvitationCode();
      
      const result = await db.prepare(`
        INSERT INTO group_invitations (group_id, email, invited_by, expires_at, invitation_code)
        VALUES (?, ?, ?, ?, ?)
      `).bind(groupId, email.trim(), userId, expiresAt, invitationCode).run();

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Invitation sent successfully',
        invitation: {
          id: result.meta?.last_row_id || 0,
          code: invitationCode
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error inviting member:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Accept invitation and join group
  joinGroup: async (request: Request, env: Env): Promise<Response> => {
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

      const { invitationId } = await request.json() as JoinGroupRequest;

      if (!invitationId) {
        return new Response(JSON.stringify({ error: 'Invitation ID is required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const db = getDB(env);

      // Get user email
      const user = await db.prepare(`
        SELECT email FROM users WHERE id = ?
      `).bind(userId).first();

      if (!user) {
        return new Response(JSON.stringify({ error: 'User not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Verify invitation exists and is valid
      const invitation = await db.prepare(`
        SELECT * FROM group_invitations 
        WHERE id = ? AND group_id = ? AND email = ? AND is_accepted = FALSE AND expires_at > ?
      `).bind(invitationId, groupId, user.email, Date.now()).first();

      if (!invitation) {
        return new Response(JSON.stringify({ error: 'Invalid or expired invitation' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Add user to group as member
      const sillyName = await getRandomSillyName(db);
      await db.prepare(`
        INSERT INTO group_members (group_id, user_id, role, joined_at, display_name)
        VALUES (?, ?, 'member', ?, ?)
      `).bind(groupId, userId, Date.now(), sillyName).run();

      // Mark invitation as accepted
      await db.prepare(`
        UPDATE group_invitations SET is_accepted = TRUE WHERE id = ?
      `).bind(invitationId).run();

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Successfully joined group'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error joining group:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Accept invitation and join group by invitation code
  joinGroupByCode: async (request: Request, env: Env): Promise<Response> => {
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
      const invitationCode = url.pathname.split('/')[4]; // /groups/invitations/code/:code

      if (!invitationCode) {
        return new Response(JSON.stringify({ error: 'Invitation code is required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const db = getDB(env);

      // Get user email
      const user = await db.prepare(`
        SELECT email FROM users WHERE id = ?
      `).bind(userId).first();

      if (!user) {
        return new Response(JSON.stringify({ error: 'User not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Verify invitation exists and is valid
      const invitation = await db.prepare(`
        SELECT * FROM group_invitations 
        WHERE invitation_code = ? AND group_id = ? AND email = ? AND is_accepted = FALSE AND expires_at > ?
      `).bind(invitationCode, groupId, user.email, Date.now()).first();

      if (!invitation) {
        return new Response(JSON.stringify({ error: 'Invalid or expired invitation' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Add user to group as member
      const sillyName = await getRandomSillyName(db);
      await db.prepare(`
        INSERT INTO group_members (group_id, user_id, role, joined_at, display_name)
        VALUES (?, ?, 'member', ?, ?)
      `).bind(groupId, userId, Date.now(), sillyName).run();

      // Mark invitation as accepted
      await db.prepare(`
        UPDATE group_invitations SET is_accepted = TRUE WHERE id = ?
      `).bind(invitation.id).run();

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Successfully joined group'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error joining group:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // List group members
  getMembers: async (request: Request, env: Env): Promise<Response> => {
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

      // Check if requesting user is an admin (leader/creator) or super admin
      const userRole = await db.prepare(`
        SELECT role FROM group_members 
        WHERE group_id = ? AND user_id = ? AND is_active = TRUE
      `).bind(groupId, userId).first();

      const isSuperAdmin = await db.prepare(`
        SELECT 1 FROM super_admins 
        WHERE user_id = ? AND is_active = TRUE
      `).bind(userId).first();

      const isAdmin = userRole && ['leader', 'creator'].includes(userRole.role);
      const hasAdminPrivileges = isAdmin || isSuperAdmin;

      // Get all members with their roles
      const members = await db.prepare(`
        SELECT 
          gm.user_id,
          gm.role,
          gm.joined_at,
          gm.display_name,
          gm.is_public,
          u.email as member_email
        FROM group_members gm
        JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = ? AND gm.is_active = TRUE
        ORDER BY gm.joined_at ASC
      `).bind(groupId).all();

      // Process members to handle privacy settings
      const processedMembers = members.results.map((member: any) => ({
        user_id: member.user_id,
        role: member.role,
        joined_at: member.joined_at,
        member_email: hasAdminPrivileges ? member.member_email : (member.is_public ? member.member_email : 'Anonymous'),
        display_name: hasAdminPrivileges ? member.member_email : (member.is_public ? ((member.display_name && member.display_name !== 'null') ? member.display_name : 'Anonymous') : 'Anonymous')
      }));

      return new Response(JSON.stringify({ 
        success: true, 
        members: processedMembers
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error getting members:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Update member display name
  updateDisplayName: async (request: Request, env: Env): Promise<Response> => {
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
      const pathParts = url.pathname.split('/');
      const groupId = pathParts[2];
      const targetUserId = pathParts[4];

      const { displayName } = await request.json() as UpdateDisplayNameRequest;

      // Validate display name
      if (!displayName || displayName.trim().length < 2 || displayName.trim().length > 30) {
        return new Response(JSON.stringify({ error: 'Display name must be between 2 and 30 characters' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Validate display name format (alphanumeric, spaces, hyphens, underscores only)
      const nameRegex = /^[a-zA-Z0-9\s\-_]+$/;
      if (!nameRegex.test(displayName.trim())) {
        return new Response(JSON.stringify({ error: 'Display name can only contain letters, numbers, spaces, hyphens, and underscores' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check for consecutive spaces
      if (displayName.includes('  ')) {
        return new Response(JSON.stringify({ error: 'Display name cannot contain consecutive spaces' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const db = getDB(env);

      // Check if user has permission to update this display name
      const canUpdate = await db.prepare(`
        SELECT role FROM group_members 
        WHERE group_id = ? AND user_id = ? AND role IN ('leader', 'creator')
      `).bind(groupId, userId).first();

      const isOwnProfile = userId === parseInt(targetUserId);

      if (!canUpdate && !isOwnProfile) {
        return new Response(JSON.stringify({ error: 'You do not have permission to update this display name' }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if display name is already taken in this group
      const existingName = await db.prepare(`
        SELECT 1 FROM group_members 
        WHERE group_id = ? AND display_name = ? AND user_id != ?
      `).bind(groupId, displayName.trim(), targetUserId).first();

      if (existingName) {
        return new Response(JSON.stringify({ error: 'Display name is already taken in this group' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Update display name
      await db.prepare(`
        UPDATE group_members 
        SET display_name = ? 
        WHERE group_id = ? AND user_id = ?
      `).bind(displayName.trim(), groupId, targetUserId).run();

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Display name updated successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error updating display name:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Get member profile
  getMemberProfile: async (request: Request, env: Env): Promise<Response> => {
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
      const pathParts = url.pathname.split('/');
      const groupId = pathParts[2];
      const targetUserId = pathParts[4];

      const db = getDB(env);

      // Check if requesting user is a leader (leaders can see all profiles)
      const isLeader = await db.prepare(`
        SELECT role FROM group_members 
        WHERE group_id = ? AND user_id = ? AND role IN ('leader', 'creator')
      `).bind(groupId, userId).first();

      // Get target member profile
      const profile = await db.prepare(`
        SELECT 
          gm.user_id,
          gm.display_name,
          gm.role,
          gm.joined_at,
          gm.is_public,
          u.email
        FROM group_members gm
        JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = ? AND gm.user_id = ? AND gm.is_active = TRUE
      `).bind(groupId, targetUserId).first();

      if (!profile) {
        return new Response(JSON.stringify({ error: 'Member not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check privacy settings (leaders can always see, others need is_public = true)
      if (!isLeader && !profile.is_public && userId !== parseInt(targetUserId)) {
        return new Response(JSON.stringify({ error: 'Profile is private' }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ 
        success: true,
        profile: {
          user_id: profile.user_id,
          display_name: profile.display_name,
          email: profile.email,
          role: profile.role,
          joined_at: profile.joined_at,
          is_public: profile.is_public
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error getting member profile:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Update privacy settings
  updatePrivacy: async (request: Request, env: Env): Promise<Response> => {
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
      const pathParts = url.pathname.split('/');
      const groupId = pathParts[2];
      const targetUserId = pathParts[4];

      const { isPublic } = await request.json() as UpdatePrivacyRequest;

      if (typeof isPublic !== 'boolean') {
        return new Response(JSON.stringify({ error: 'isPublic must be a boolean value' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const db = getDB(env);

      // Check if user has permission to update this privacy setting
      const canUpdate = await db.prepare(`
        SELECT role FROM group_members 
        WHERE group_id = ? AND user_id = ? AND role IN ('leader', 'creator')
      `).bind(groupId, userId).first();

      const isOwnProfile = userId === parseInt(targetUserId);

      if (!canUpdate && !isOwnProfile) {
        return new Response(JSON.stringify({ error: 'You do not have permission to update this privacy setting' }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Update privacy setting
      await db.prepare(`
        UPDATE group_members 
        SET is_public = ? 
        WHERE group_id = ? AND user_id = ?
      `).bind(isPublic, groupId, targetUserId).run();

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Privacy settings updated successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error updating privacy settings:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Get group leaderboard
  getLeaderboard: async (request: Request, env: Env): Promise<Response> => {
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
      const metric = url.searchParams.get('metric') || 'points';
      const timeframe = url.searchParams.get('timeframe') || 'all';

      // Validate parameters
      const validMetrics = ['points', 'verses_mastered', 'current_streak', 'longest_streak'];
      const validTimeframes = ['all', 'week', 'month', 'year'];
      
      if (!validMetrics.includes(metric)) {
        return new Response(JSON.stringify({ error: 'Invalid metric parameter' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!validTimeframes.includes(timeframe)) {
        return new Response(JSON.stringify({ error: 'Invalid timeframe parameter' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const db = getDB(env);

      // Check if user is a member of the group
      const isMember = await db.prepare(`
        SELECT 1 FROM group_members 
        WHERE group_id = ? AND user_id = ? AND is_active = TRUE
      `).bind(groupId, userId).first();

      // Check if user is super admin
      const isSuperAdmin = await db.prepare(`
        SELECT 1 FROM super_admins 
        WHERE user_id = ? AND is_active = TRUE
      `).bind(userId).first();

      if (!isMember && !isSuperAdmin) {
        return new Response(JSON.stringify({ error: 'You must be a member of this group to view the leaderboard' }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if user is an admin (leader/creator) of this group
      const userRole = await db.prepare(`
        SELECT role FROM group_members 
        WHERE group_id = ? AND user_id = ? AND is_active = TRUE
      `).bind(groupId, userId).first();

      const isAdmin = userRole && ['leader', 'creator'].includes(userRole.role);
      const hasAdminPrivileges = isAdmin || isSuperAdmin;

      // Build the leaderboard query based on metric and timeframe
      let orderBy = '';

      switch (metric) {
        case 'points':
          orderBy = 'us.total_points DESC';
          break;
        case 'verses_mastered':
          orderBy = 'us.verses_mastered DESC';
          break;
        case 'current_streak':
          orderBy = 'us.current_streak DESC';
          break;
        case 'longest_streak':
          orderBy = 'us.longest_streak DESC';
          break;
      }

      // Add timeframe filtering if needed
      let timeframeFilter = '';
      if (timeframe !== 'all') {
        const now = Date.now();
        let cutoffTime = 0;
        
        switch (timeframe) {
          case 'week':
            cutoffTime = now - (7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            cutoffTime = now - (30 * 24 * 60 * 60 * 1000);
            break;
          case 'year':
            cutoffTime = now - (365 * 24 * 60 * 60 * 1000);
            break;
        }
        
        if (cutoffTime > 0) {
          timeframeFilter = `AND us.last_activity_date >= ${cutoffTime}`;
        }
      }

      const leaderboardQuery = `
        SELECT 
          gm.user_id,
          gm.display_name,
          gm.is_public,
          u.email as member_email,
          us.total_points,
          us.verses_mastered,
          us.current_streak,
          us.longest_streak
        FROM group_members gm
        LEFT JOIN users u ON gm.user_id = u.id
        LEFT JOIN user_stats us ON gm.user_id = us.user_id
        WHERE gm.group_id = ? AND gm.is_active = TRUE ${timeframeFilter}
        ORDER BY ${orderBy}
      `;

      const leaderboard = await db.prepare(leaderboardQuery).bind(groupId).all();

      // Process results and add rankings
      const processedLeaderboard: LeaderboardEntry[] = [];
      let currentRank = 1;
      let lastValue = -1;

      for (const entry of leaderboard.results) {
        let currentValue = 0;
        switch (metric) {
          case 'points':
            currentValue = entry.total_points || 0;
            break;
          case 'verses_mastered':
            currentValue = entry.verses_mastered || 0;
            break;
          case 'current_streak':
            currentValue = entry.current_streak || 0;
            break;
          case 'longest_streak':
            currentValue = entry.longest_streak || 0;
            break;
        }

        // Handle ties (same rank for same values)
        if (Number(currentValue) !== Number(lastValue)) {
          currentRank = processedLeaderboard.length + 1;
        }

        processedLeaderboard.push({
          rank: Number(currentRank) || 0,
          user_id: Number(entry.user_id) || 0,
          display_name: hasAdminPrivileges ? (entry.member_email || 'Anonymous') : (entry.is_public ? (typeof entry.display_name === 'string' && entry.display_name !== 'null' ? entry.display_name : 'Anonymous') : 'Anonymous'),
          points: Number(entry.total_points) || 0,
          verses_mastered: Number(entry.verses_mastered) || 0,
          current_streak: Number(entry.current_streak) || 0,
          longest_streak: Number(entry.longest_streak) || 0,
          is_public: !!entry.is_public
        });

        lastValue = Number(currentValue);
      }

      // Get metadata
      const totalMembers = await db.prepare(`
        SELECT COUNT(*) as count FROM group_members 
        WHERE group_id = ? AND is_active = TRUE
      `).bind(groupId).first();

      const participatingMembers = processedLeaderboard.length;

      return new Response(JSON.stringify({ 
        success: true,
        leaderboard: processedLeaderboard,
        metadata: {
          total_members: totalMembers?.count || 0,
          participating_members: participatingMembers,
          metric,
          timeframe
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error getting leaderboard:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Get group statistics
  getGroupStats: async (request: Request, env: Env): Promise<Response> => {
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

      // Check if user is a member of the group
      const isMember = await db.prepare(`
        SELECT 1 FROM group_members 
        WHERE group_id = ? AND user_id = ? AND is_active = TRUE
      `).bind(groupId, userId).first();

      // Check if user is super admin
      const isSuperAdmin = await db.prepare(`
        SELECT 1 FROM super_admins 
        WHERE user_id = ? AND is_active = TRUE
      `).bind(userId).first();

      if (!isMember && !isSuperAdmin) {
        return new Response(JSON.stringify({ error: 'You must be a member of this group to view group stats' }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get total members
      const totalMembers = await db.prepare(`
        SELECT COUNT(*) as count FROM group_members 
        WHERE group_id = ? AND is_active = TRUE
      `).bind(groupId).first();

      // Get active members (have stats)
      const activeMembers = await db.prepare(`
        SELECT COUNT(*) as count FROM group_members gm
        JOIN user_stats us ON gm.user_id = us.user_id
        WHERE gm.group_id = ? AND gm.is_active = TRUE
      `).bind(groupId).first();

      // Get total points and verses mastered
      const totals = await db.prepare(`
        SELECT 
          SUM(us.total_points) as total_points,
          SUM(us.verses_mastered) as total_verses_mastered
        FROM group_members gm
        JOIN user_stats us ON gm.user_id = us.user_id
        WHERE gm.group_id = ? AND gm.is_active = TRUE
      `).bind(groupId).first();

      // Get top performer
      const topPerformer = await db.prepare(`
        SELECT 
          gm.user_id,
          gm.display_name,
          gm.is_public,
          us.total_points
        FROM group_members gm
        JOIN user_stats us ON gm.user_id = us.user_id
        WHERE gm.group_id = ? AND gm.is_active = TRUE
        ORDER BY us.total_points DESC
        LIMIT 1
      `).bind(groupId).first();

      // Get recent activity (this week)
      const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      const newMembersThisWeek = await db.prepare(`
        SELECT COUNT(*) as count FROM group_members 
        WHERE group_id = ? AND joined_at >= ?
      `).bind(groupId, weekAgo).first();

      const versesMasteredThisWeek = await db.prepare(`
        SELECT COUNT(*) as count FROM verses v
        JOIN group_members gm ON v.user_id = gm.user_id
        WHERE gm.group_id = ? AND v.status = 'mastered' AND v.created_at >= ?
      `).bind(groupId, weekAgo).first();

      const pointsEarnedThisWeek = await db.prepare(`
        SELECT SUM(pe.points) as total FROM point_events pe
        JOIN group_members gm ON pe.user_id = gm.user_id
        WHERE gm.group_id = ? AND pe.created_at >= ?
      `).bind(groupId, weekAgo).first();

      const stats: GroupStats = {
        total_members: totalMembers?.count ? Number(totalMembers.count) : 0,
        active_members: activeMembers?.count ? Number(activeMembers.count) : 0,
        total_points: totals?.total_points ? Number(totals.total_points) : 0,
        total_verses_mastered: totals?.total_verses_mastered ? Number(totals.total_verses_mastered) : 0,
        average_points_per_member: activeMembers?.count && totals?.total_points ? Math.round(Number(totals.total_points) / Number(activeMembers.count)) : 0,
        top_performer: topPerformer ? {
          user_id: Number(topPerformer.user_id) || 0,
          display_name: topPerformer.is_public ? ((topPerformer.display_name && topPerformer.display_name !== 'null') ? String(topPerformer.display_name) : 'Anonymous') : 'Anonymous',
          points: Number(topPerformer.total_points) || 0
        } : {
          user_id: 0,
          display_name: 'None',
          points: 0
        },
        recent_activity: {
          new_members_this_week: newMembersThisWeek?.count ? Number(newMembersThisWeek.count) : 0,
          verses_mastered_this_week: versesMasteredThisWeek?.count ? Number(versesMasteredThisWeek.count) : 0,
          points_earned_this_week: pointsEarnedThisWeek?.total ? Number(pointsEarnedThisWeek.total) : 0
        }
      };

      return new Response(JSON.stringify({ 
        success: true,
        stats
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error getting group stats:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Get member's group ranking
  getMemberRanking: async (request: Request, env: Env): Promise<Response> => {
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
      const pathParts = url.pathname.split('/');
      const groupId = pathParts[2];
      const targetUserId = pathParts[4];

      const db = getDB(env);

      // Check if requesting user is a member of the group
      const isMember = await db.prepare(`
        SELECT 1 FROM group_members 
        WHERE group_id = ? AND user_id = ? AND is_active = TRUE
      `).bind(groupId, userId).first();

      if (!isMember) {
        return new Response(JSON.stringify({ error: 'You must be a member of this group to view rankings' }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if target user is a member and public (unless requesting own ranking)
      const targetMember = await db.prepare(`
        SELECT is_public FROM group_members 
        WHERE group_id = ? AND user_id = ? AND is_active = TRUE
      `).bind(groupId, targetUserId).first();

      if (!targetMember) {
        return new Response(JSON.stringify({ error: 'Member not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!targetMember.is_public && userId !== parseInt(targetUserId)) {
        return new Response(JSON.stringify({ error: 'Member profile is private' }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get all member rankings by points
      const allRankings = await db.prepare(`
        SELECT 
          gm.user_id,
          gm.display_name,
          gm.is_public,
          us.total_points,
          us.verses_mastered,
          us.current_streak,
          us.longest_streak
        FROM group_members gm
        LEFT JOIN user_stats us ON gm.user_id = us.user_id
        WHERE gm.group_id = ? AND gm.is_active = TRUE AND gm.is_public = TRUE
        ORDER BY us.total_points DESC
      `).bind(groupId).all();

      // Find target user's rank
      let targetRank = 0;
      let targetData = null;
      const totalMembers = allRankings.results.length;

      for (let i = 0; i < allRankings.results.length; i++) {
        const entry = allRankings.results[i];
        if (entry.user_id === parseInt(targetUserId)) {
          targetRank = i + 1;
          targetData = entry;
          break;
        }
      }

      if (!targetData) {
        return new Response(JSON.stringify({ error: 'Member not found in rankings' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Calculate percentile
      const percentile = totalMembers > 1 ? Math.round(((totalMembers - targetRank + 1) / totalMembers) * 100) : 100;

      // Find next rank info
      let nextRank = null;
      if (targetRank > 1) {
        const nextRankEntry = allRankings.results[targetRank - 2]; // -2 because arrays are 0-indexed
        if (nextRankEntry) {
          const pointsNeeded = nextRankEntry.total_points - targetData.total_points;
          nextRank = {
            rank: targetRank - 1,
            points_needed: pointsNeeded
          };
        }
      }

      let nextRankPoints = nextRank && typeof (nextRank as any).points_needed !== 'undefined' ? Number((nextRank as any).points_needed) : 0;
      let targetPoints = targetData && typeof (targetData as any).total_points !== 'undefined' ? Number((targetData as any).total_points) : 0;
      let targetDisplayName = targetData && typeof (targetData as any).display_name !== 'undefined' ? String((targetData as any).display_name) : 'Anonymous';
      let targetVersesMastered = targetData && typeof (targetData as any).verses_mastered !== 'undefined' ? Number((targetData as any).verses_mastered) : 0;
      let targetCurrentStreak = targetData && typeof (targetData as any).current_streak !== 'undefined' ? Number((targetData as any).current_streak) : 0;
      let targetLongestStreak = targetData && typeof (targetData as any).longest_streak !== 'undefined' ? Number((targetData as any).longest_streak) : 0;

      const ranking: MemberRanking = {
        user_id: targetData.user_id,
        display_name: targetDisplayName,
        rank: targetRank,
        total_members: totalMembers,
        percentile,
        metrics: {
          points: targetPoints,
          verses_mastered: targetVersesMastered,
          current_streak: targetCurrentStreak,
          longest_streak: targetLongestStreak
        },
        next_rank: nextRank ? { rank: Number(nextRank.rank) || 0, points_needed: Number(nextRank.points_needed) || 0 } : undefined
      };

      return new Response(JSON.stringify({ 
        success: true,
        ranking
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error getting member ranking:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // List all groups the authenticated user is a member of
  listUserGroups: async (request: Request, env: Env): Promise<Response> => {
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
      const db = getDB(env);
      // Query all active groups for this user
      const groups = await db.prepare(`
        SELECT g.id, g.name, g.description, gm.role,
          (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND is_active = TRUE) as member_count
        FROM group_members gm
        JOIN groups g ON gm.group_id = g.id
        WHERE gm.user_id = ? AND gm.is_active = TRUE AND g.is_active = 1
        ORDER BY g.created_at DESC
      `).bind(userId).all();

      return new Response(JSON.stringify({ 
        success: true,
        groups: groups.results
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error getting user groups:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Add a user to a group (admin/leader/creator/super admin only)
  addUserToGroup: async (request: Request, env: Env): Promise<Response> => {
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
      const { targetUserId } = await request.json();
      if (!targetUserId) {
        return new Response(JSON.stringify({ error: 'targetUserId is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const db = getDB(env);
      // Check if user is super admin
      const isSuperAdmin = await db.prepare(`
        SELECT 1 FROM super_admins WHERE user_id = ? AND is_active = TRUE
      `).bind(userId).first();
      // If not super admin, check if user is a leader or creator of this group
      if (!isSuperAdmin) {
        const canAdd = await db.prepare(`
          SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND role IN ('leader', 'creator') AND is_active = 1
        `).bind(groupId, userId).first();
        if (!canAdd) {
          return new Response(JSON.stringify({ error: 'You do not have permission to add users to this group' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
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
      // Check if user is already a member (including soft-deleted)
      const existingMember = await db.prepare(`
        SELECT is_active FROM group_members WHERE group_id = ? AND user_id = ?
      `).bind(groupId, targetUserId).first();
      if (existingMember) {
        if (existingMember.is_active) {
          return new Response(JSON.stringify({ error: 'User is already a member of this group' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          // Reactivate soft-deleted member
          const sillyName = await getRandomSillyName(db);
          await db.prepare(`
            UPDATE group_members SET is_active = 1, role = 'member', joined_at = ?, display_name = ? WHERE group_id = ? AND user_id = ?
          `).bind(Date.now(), sillyName, groupId, targetUserId).run();
          return new Response(JSON.stringify({ success: true, message: `User ${targetUser.email} reactivated in group` }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      // Add as new member
      const sillyName = await getRandomSillyName(db);
      await db.prepare(`
        INSERT INTO group_members (group_id, user_id, role, joined_at, display_name)
        VALUES (?, ?, 'member', ?, ?)
      `).bind(groupId, targetUserId, Date.now(), sillyName).run();
      return new Response(JSON.stringify({ success: true, message: `User ${targetUser.email} added to group` }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error adding user to group:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },
}