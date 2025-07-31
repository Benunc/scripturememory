import { Env } from '../types';
import { getDB, getUserId } from '../utils/db';
import { syncWithSendy } from './sendy';
import { notifyMarketingError } from '../utils/notifications';

// Helper to get the correct database binding
const getDb = (env: Env) => {
  return getDB(env);
};

export const handleMarketing = {
  // Get user's marketing preferences
  getPreferences: async (request: Request, env: Env): Promise<Response> => {
    try {
      const token = request.headers.get('Authorization')?.replace('Bearer ', '');
      if (!token) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      const userId = await getUserId(token, env);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), { 
          status: 401, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      const db = getDb(env);
      const preferences = await db.prepare(`
        SELECT marketing_opt_in, marketing_opt_in_date, marketing_opt_out_date
        FROM users 
        WHERE id = ?
      `).bind(userId).first();

      if (!preferences) {
        return new Response(JSON.stringify({ error: 'User not found' }), { 
          status: 404, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      return new Response(JSON.stringify({
        marketing_opt_in: preferences.marketing_opt_in,
        marketing_opt_in_date: preferences.marketing_opt_in_date,
        marketing_opt_out_date: preferences.marketing_opt_out_date
      }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      });
    } catch (error) {
      console.error('Error getting marketing preferences:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
  },

  // Update user's marketing preferences
  updatePreferences: async (request: Request, env: Env): Promise<Response> => {
    try {
      const token = request.headers.get('Authorization')?.replace('Bearer ', '');
      if (!token) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      const userId = await getUserId(token, env);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), { 
          status: 401, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      const { marketing_opt_in } = await request.json() as { marketing_opt_in: boolean };
      
      if (typeof marketing_opt_in !== 'boolean') {
        return new Response(JSON.stringify({ error: 'Invalid marketing_opt_in value' }), { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      const db = getDb(env);
      const now = Date.now();

      // Update user preferences
      if (marketing_opt_in) {
        await db.prepare(`
          UPDATE users 
          SET marketing_opt_in = ?, marketing_opt_in_date = ?, marketing_opt_out_date = NULL
          WHERE id = ?
        `).bind(true, now, userId).run();
      } else {
        await db.prepare(`
          UPDATE users 
          SET marketing_opt_in = ?, marketing_opt_out_date = ?
          WHERE id = ?
        `).bind(false, now, userId).run();
      }

      // Record marketing event
      await db.prepare(`
        INSERT INTO marketing_events (user_id, event_type, metadata, created_at)
        VALUES (?, ?, ?, ?)
      `).bind(
        userId, 
        marketing_opt_in ? 'opt_in' : 'opt_out',
        JSON.stringify({ source: 'user_preferences' }),
        now
      ).run();

      // Sync with Sendy if marketing is enabled
      if (env.MARKETING_ENABLED === 'true') {
        try {
          await syncWithSendy(userId, marketing_opt_in, env);
          console.log(`Sendy sync completed for user ${userId}, marketing_opt_in: ${marketing_opt_in}`);
        } catch (syncError) {
          console.error('Sendy sync error:', syncError);
          
          // Send notification about the marketing error
          await notifyMarketingError(env, Number(userId), 'user@example.com', 'Sendy sync failed');
          
          // Don't fail the request if Sendy sync fails
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        marketing_opt_in 
      }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      });
    } catch (error) {
      console.error('Error updating marketing preferences:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
  },

  // Get marketing events for a user (admin only)
  getEvents: async (request: Request, env: Env): Promise<Response> => {
    try {
      const token = request.headers.get('Authorization')?.replace('Bearer ', '');
      if (!token) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      const adminUserId = await getUserId(token, env);
      if (!adminUserId) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), { 
          status: 401, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      // Check if user is super admin
      const db = getDb(env);
      const superAdmin = await db.prepare(`
        SELECT 1 FROM super_admins WHERE user_id = ?
      `).bind(adminUserId).first();

      if (!superAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { 
          status: 403, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      // Extract userId from URL path
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const userId = parseInt(pathParts[pathParts.length - 1] || '0');
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Invalid user ID' }), { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      const events = await db.prepare(`
        SELECT event_type, email_list, metadata, created_at
        FROM marketing_events 
        WHERE user_id = ?
        ORDER BY created_at DESC
      `).bind(userId).all();

      return new Response(JSON.stringify({ events }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      });
    } catch (error) {
      console.error('Error getting marketing events:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
  },

  // Manual sync with Sendy (admin only) - placeholder for now
  syncSendy: async (request: Request, env: Env): Promise<Response> => {
    try {
      const token = request.headers.get('Authorization')?.replace('Bearer ', '');
      if (!token) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      const adminUserId = await getUserId(token, env);
      if (!adminUserId) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), { 
          status: 401, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      // Check if user is super admin
      const db = getDb(env);
      const superAdmin = await db.prepare(`
        SELECT 1 FROM super_admins WHERE user_id = ?
      `).bind(adminUserId).first();

      if (!superAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { 
          status: 403, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      if (env.MARKETING_ENABLED !== 'true') {
        return new Response(JSON.stringify({ error: 'Marketing is not enabled' }), { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      // Get all users with marketing preferences
      const users = await db.prepare(`
        SELECT id, email, marketing_opt_in, marketing_opt_in_date
        FROM users 
        WHERE marketing_opt_in IS NOT NULL
      `).all();

      return new Response(JSON.stringify({ 
        success: true,
        message: `Found ${users.results?.length || 0} users with marketing preferences`,
        user_count: users.results?.length || 0
      }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      });
    } catch (error) {
      console.error('Error syncing with Sendy:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
  }
}; 