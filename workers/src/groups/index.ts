import { Env } from '../types';
import { getDB, getUserId } from '../utils/db';

interface CreateGroupRequest {
  name: string;
  description?: string;
}

interface AssignLeaderRequest {
  email: string;
}

interface InviteMemberRequest {
  email: string;
}

interface JoinGroupRequest {
  invitationId: number;
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
      await db.prepare(`
        INSERT INTO group_members (group_id, user_id, role, joined_at)
        VALUES (?, ?, 'creator', ?)
      `).bind(groupId, userId, Date.now()).run();

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
    } catch (error) {
      console.error('Error creating group:', error);
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
    } catch (error) {
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

      // Check if current user can assign leaders
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
        return new Response(JSON.stringify({ error: 'User is already a leader' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Add leader
      await db.prepare(`
        INSERT INTO group_members (group_id, user_id, role, joined_at)
        VALUES (?, ?, 'leader', ?)
      `).bind(groupId, targetUser.id, Date.now()).run();

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Leader assigned successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error assigning leader:', error);
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

      // Check if user is already a member
      const existingMember = await db.prepare(`
        SELECT 1 FROM group_members WHERE group_id = ? AND user_id = (
          SELECT id FROM users WHERE email = ?
        )
      `).bind(groupId, email.trim()).first();

      if (existingMember) {
        return new Response(JSON.stringify({ error: 'User is already a member of this group' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
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
      await db.prepare(`
        INSERT INTO group_invitations (group_id, email, invited_by, expires_at)
        VALUES (?, ?, ?, ?)
      `).bind(groupId, email.trim(), userId, expiresAt).run();

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Invitation sent successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
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
      await db.prepare(`
        INSERT INTO group_members (group_id, user_id, role, joined_at)
        VALUES (?, ?, 'member', ?)
      `).bind(groupId, userId, Date.now()).run();

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
    } catch (error) {
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

      // Get all members with their roles
      const members = await db.prepare(`
        SELECT 
          gm.user_id,
          gm.role,
          gm.joined_at,
          u.email as member_email
        FROM group_members gm
        JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = ? AND gm.is_active = TRUE
        ORDER BY gm.joined_at ASC
      `).bind(groupId).all();

      return new Response(JSON.stringify({ 
        success: true, 
        members: members.results
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error getting members:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}; 