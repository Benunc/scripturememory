import { Router } from 'itty-router';
import { Env, Verse, D1Result } from '../types';
import { getDB, getUserId } from '../utils/db';

// Points for different actions
const POINTS = {
  VERSE_ADDED: 10,         // Points for adding a new verse (limited to 3 per day)
  WORD_CORRECT: 1,         // Base points per correct word
  STREAK_MULTIPLIER: 1,    // 1x bonus per word in streak
  MASTERY_ACHIEVED: 500,   // Big bonus for mastering a verse
  DAILY_STREAK: 50,        // Bonus for maintaining daily streak
};

export const handleVerses = {
  // Get all verses for a user
  getVerses: async (request: Request, env: Env): Promise<Response> => {
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

      const verses = await getDB(env).prepare(
        `SELECT v.*, 
          CASE WHEN mv.verse_reference IS NOT NULL THEN 'mastered' ELSE v.status END as status
        FROM verses v
        LEFT JOIN mastered_verses mv ON v.reference = mv.verse_reference AND v.user_id = mv.user_id
        WHERE v.user_id = ? 
        ORDER BY v.created_at DESC`
      ).bind(userId).all();

      return new Response(JSON.stringify(verses.results), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error getting verses:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Add a new verse
  addVerse: async (request: Request, env: Env): Promise<Response> => {
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

      const { reference, text, translation, created_at } = await request.json() as Verse & { created_at?: number };
      
      if (!reference || !text || !translation) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const db = getDB(env);
      try {
        // Check if verse already exists
        const existingVerse = await db.prepare(`
          SELECT 1 FROM verses 
          WHERE user_id = ? AND reference = ?
        `).bind(userId, reference).first();

        if (existingVerse) {
          return new Response(JSON.stringify({ error: 'Verse already exists' }), { 
            status: 409,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Insert new verse
        await db.prepare(`
          INSERT INTO verses (
            user_id,
            reference,
            text,
            translation,
            created_at
          ) VALUES (?, ?, ?, ?, ?)
        `).bind(
          userId,
          reference,
          text,
          translation,
          created_at || Date.now()
        ).run();

        // Award points for adding a verse
        await db.prepare(`
          INSERT INTO point_events (
            user_id,
            event_type,
            points,
            metadata,
            created_at
          ) VALUES (?, 'verse_added', ?, ?, ?)
        `).bind(
          userId,
          POINTS.VERSE_ADDED,
          JSON.stringify({ verse_reference: reference }),
          created_at || Date.now()
        ).run();

        // First check if user stats exist
        const stats = await db.prepare(`
          SELECT 1 FROM user_stats WHERE user_id = ?
        `).bind(userId).first();

        if (!stats) {
          // Create initial stats if they don't exist
          await db.prepare(`
            INSERT INTO user_stats (
              user_id,
              total_points,
              current_streak,
              longest_streak,
              verses_mastered,
              total_attempts,
              last_activity_date,
              created_at
            ) VALUES (?, ?, 1, 1, 0, 0, ?, ?)
          `).bind(userId, POINTS.VERSE_ADDED, created_at || Date.now(), created_at || Date.now()).run();
        } else {
          // Update existing stats
          await db.prepare(`
            UPDATE user_stats 
            SET total_points = total_points + ?,
                last_activity_date = ?
            WHERE user_id = ?
          `).bind(POINTS.VERSE_ADDED, created_at || Date.now(), userId).run();
        }

        return new Response(JSON.stringify({ success: true, message: 'Verse added successfully' }), { 
          status: 201,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': JSON.stringify({ success: true, message: 'Verse added successfully' }).length.toString()
          }
        });
      } catch (error) {
        console.error('Error adding verse:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      console.error('Error adding verse:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Update a verse
  updateVerse: async (request: Request, env: Env): Promise<Response> => {
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
      const reference = decodeURIComponent(url.pathname.split('/').pop() || '');
      
      if (!reference) {
        return new Response(JSON.stringify({ error: 'Verse reference is required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const verse: Verse = await request.json();
      
      // Verify ownership
      const existing = await getDB(env).prepare(
        'SELECT * FROM verses WHERE reference = ? AND user_id = ?'
      ).bind(reference, userId).first();

      if (!existing) {
        return new Response(JSON.stringify({ error: 'Verse not found or unauthorized' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Only update fields that are provided
      const updates: string[] = [];
      const bindings: any[] = [];

      if (verse.text !== undefined) {
        updates.push('text = ?');
        bindings.push(verse.text);
      }

      if (verse.translation !== undefined) {
        updates.push('translation = ?');
        bindings.push(verse.translation);
      }

      if (verse.status !== undefined) {
        updates.push('status = ?');
        bindings.push(verse.status);
      }

      if (updates.length === 0) {
        return new Response(JSON.stringify({ error: 'No updates provided' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Add reference and user_id to bindings
      bindings.push(reference, userId);

      await getDB(env).prepare(
        `UPDATE verses SET ${updates.join(', ')} WHERE reference = ? AND user_id = ?`
      ).bind(...bindings).run();

      return new Response(null, { status: 204 });
    } catch (error) {
      console.error('Error updating verse:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Delete a verse
  deleteVerse: async (request: Request, env: Env): Promise<Response> => {
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

      // Get verse reference from URL
      const url = new URL(request.url);
      const reference = decodeURIComponent(url.pathname.split('/').pop() || '');
      
      if (!reference) {
        return new Response(JSON.stringify({ error: 'Missing verse reference' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const db = getDB(env);

      // Verify verse exists and belongs to user
      const verse = await db.prepare(
        'SELECT * FROM verses WHERE user_id = ? AND reference = ?'
      ).bind(userId, reference).first();

      if (!verse) {
        return new Response(JSON.stringify({ error: 'Verse not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Use D1's batch API for atomic operations
      await db.batch([
        // Delete mastery records
        db.prepare('DELETE FROM mastered_verses WHERE user_id = ? AND verse_reference = ?').bind(userId, reference),
        db.prepare('DELETE FROM verse_mastery WHERE user_id = ? AND verse_reference = ?').bind(userId, reference),

        // Delete progress records
        db.prepare('DELETE FROM word_progress WHERE user_id = ? AND verse_reference = ?').bind(userId, reference),
        db.prepare('DELETE FROM verse_attempts WHERE user_id = ? AND verse_reference = ?').bind(userId, reference),

        // Finally delete the verse
        db.prepare('DELETE FROM verses WHERE user_id = ? AND reference = ?').bind(userId, reference)
      ]);

      return new Response(null, { status: 204 });
    } catch (error) {
      console.error('Error deleting verse:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Assign verse set to user (admin function)
  assignVerseSet: async (request: Request, env: Env): Promise<Response> => {
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

      const { targetUserId, verseSet, groupId } = await request.json() as { 
        targetUserId: number; 
        verseSet: string; 
        groupId: number;
      };

      if (!groupId) {
        return new Response(JSON.stringify({ error: 'Group ID is required' }), { 
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

      // Check if current user is a leader or creator of this group
      const userRole = await db.prepare(`
        SELECT role FROM group_members 
        WHERE group_id = ? AND user_id = ? AND is_active = 1
      `).bind(groupId, userId).first();

      // Check if user is super admin
      const isSuperAdmin = await db.prepare(`
        SELECT 1 FROM super_admins 
        WHERE user_id = ? AND is_active = TRUE
      `).bind(userId).first();

      if ((!userRole || !['leader', 'creator'].includes(userRole.role)) && !isSuperAdmin) {
        return new Response(JSON.stringify({ error: 'You must be a leader or creator of this group, or a super admin, to assign verse sets' }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if target user exists and is a member of this group
      const targetUser = await db.prepare(`
        SELECT u.id, u.email 
        FROM users u
        JOIN group_members gm ON u.id = gm.user_id
        WHERE u.id = ? AND gm.group_id = ? AND gm.is_active = 1
      `).bind(targetUserId, groupId).first();

      if (!targetUser) {
        return new Response(JSON.stringify({ error: 'Target user not found or not a member of this group' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get verses from the specified verse set
      const { getVerseSet } = await import('../auth/sampleVerses');
      const verseSetData = getVerseSet(verseSet);
      
      if (!verseSetData) {
        return new Response(JSON.stringify({ error: 'Invalid verse set' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Add each verse from the set to the user
      let addedCount = 0;
      for (const verse of verseSetData) {
        try {
          // Check if verse already exists for this user
          const existingVerse = await db.prepare(`
            SELECT 1 FROM verses 
            WHERE user_id = ? AND reference = ?
          `).bind(targetUserId, verse.reference).first();

          if (!existingVerse) {
            // Insert the verse
            await db.prepare(`
              INSERT INTO verses (
                user_id,
                reference,
                text,
                translation,
                created_at
              ) VALUES (?, ?, ?, ?, ?)
            `).bind(
              targetUserId,
              verse.reference,
              verse.text,
              'NIV', // Default translation
              Date.now()
            ).run();
            addedCount++;
          }
        } catch (error) {
          console.error(`Error adding verse ${verse.reference}:`, error);
        }
      }

      return new Response(JSON.stringify({ 
        success: true,
        message: `Assigned ${verseSet} to ${targetUser.email} in group ${group.name}. ${addedCount} new verses added.`
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error assigning verse set:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Assign verse set to all group members (super admin function)
  assignVerseSetToAllMembers: async (request: Request, env: Env): Promise<Response> => {
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

      const { verseSet, groupId } = await request.json() as { 
        verseSet: string; 
        groupId: number;
      };

      if (!groupId) {
        return new Response(JSON.stringify({ error: 'Group ID is required' }), { 
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

      // If not super admin, check if user is a leader or creator of this group
      if (!isSuperAdmin) {
        const userRole = await db.prepare(`
          SELECT role FROM group_members 
          WHERE group_id = ? AND user_id = ? AND is_active = 1
        `).bind(groupId, userId).first();

        if (!userRole || !['leader', 'creator'].includes(userRole.role)) {
          return new Response(JSON.stringify({ error: 'You must be a leader or creator of this group, or a super admin, to assign verse sets to all members' }), { 
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

      // Get all active members of the group
      const groupMembers = await db.prepare(`
        SELECT u.id, u.email 
        FROM users u
        JOIN group_members gm ON u.id = gm.user_id
        WHERE gm.group_id = ? AND gm.is_active = 1
      `).bind(groupId).all();

      if (!groupMembers.results.length) {
        return new Response(JSON.stringify({ error: 'No active members found in this group' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get verses from the specified verse set
      const { getVerseSet } = await import('../auth/sampleVerses');
      const verseSetData = getVerseSet(verseSet);
      
      if (!verseSetData) {
        return new Response(JSON.stringify({ error: 'Invalid verse set' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Add verses to all group members
      let totalAddedCount = 0;
      let processedMembers = 0;
      const results: Array<{ userId: number; email: string; addedCount: number; errors: string[] }> = [];

      for (const member of groupMembers.results) {
        const memberId = member.id as number;
        const memberEmail = member.email as string;
        let memberAddedCount = 0;
        const memberErrors: string[] = [];

        for (const verse of verseSetData) {
          try {
            // Check if verse already exists for this user
            const existingVerse = await db.prepare(`
              SELECT 1 FROM verses 
              WHERE user_id = ? AND reference = ?
            `).bind(memberId, verse.reference).first();

            if (!existingVerse) {
              // Insert the verse
              await db.prepare(`
                INSERT INTO verses (
                  user_id,
                  reference,
                  text,
                  translation,
                  created_at
                ) VALUES (?, ?, ?, ?, ?)
              `).bind(
                memberId,
                verse.reference,
                verse.text,
                'NIV', // Default translation
                Date.now()
              ).run();
              memberAddedCount++;
              totalAddedCount++;
            }
          } catch (error) {
            const errorMsg = `Error adding verse ${verse.reference}: ${error}`;
            console.error(errorMsg);
            memberErrors.push(errorMsg);
          }
        }

        results.push({
          userId: memberId,
          email: memberEmail,
          addedCount: memberAddedCount,
          errors: memberErrors
        });
        processedMembers++;
      }

      return new Response(JSON.stringify({ 
        success: true,
        message: `Assigned ${verseSet} to all ${processedMembers} members of group ${group.name}. Total new verses added: ${totalAddedCount}`,
        details: {
          groupName: group.name,
          verseSet,
          totalMembers: processedMembers,
          totalVersesAdded: totalAddedCount,
          results
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('Error assigning verse set to all members:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}; 