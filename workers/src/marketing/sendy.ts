import { Env } from '../types';
import { getDB } from '../utils/db';

// Sendy API integration
export const syncWithSendy = async (userId: number, marketingOptIn: boolean, env: Env): Promise<void> => {
  if (env.MARKETING_ENABLED !== 'true') {
    console.log('Marketing is not enabled, skipping Sendy sync');
    return;
  }

  try {
    const db = getDB(env);
    
    // Get user details
    const user = await db.prepare(`
      SELECT email, marketing_opt_in, marketing_opt_in_date
      FROM users 
      WHERE id = ?
    `).bind(userId).first();

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const { email, marketing_opt_in } = user as {
      email: string;
      marketing_opt_in: boolean;
      marketing_opt_in_date: number | null;
    };

    // Prepare Sendy API request
    const sendyUrl = env.SENDY_URL;
    const apiKey = env.SENDY_API_KEY;
    const listId = env.SENDY_LIST_ID;

    if (!sendyUrl || !apiKey || !listId) {
      console.error('Sendy configuration missing');
      return;
    }

    // Add user to Sendy list if they opted in
    if (marketingOptIn) {
      // Create form data for Sendy API - Add Subscriber
      const formData = new FormData();
      formData.append('api_key', apiKey);
      formData.append('list', listId);
      formData.append('email', email);
      formData.append('name', email.split('@')[0]); // Use email prefix as name
      formData.append('boolean', 'true'); // Always true for opt-in

      console.log(`Sending to Sendy: ${sendyUrl}/subscribe`);
      console.log(`API Key: ${apiKey}`);
      console.log(`List ID: ${listId}`);
      console.log(`Email: ${email}`);

      const response = await fetch(`${sendyUrl}/subscribe`, {
        method: 'POST',
        body: formData
      });

      console.log(`Sendy response status: ${response.status}`);
      const result = await response.text();
      console.log(`Sendy response body: ${result}`);

      if (!response.ok) {
        throw new Error(`Sendy API error: ${response.status} - ${result}`);
      }

      // Record marketing event
      await db.prepare(`
        INSERT INTO marketing_events (user_id, event_type, email_list, metadata, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        userId,
        'opt_in',
        'updates',
        JSON.stringify({ 
          sendy_response: result,
          list_id: listId 
        }),
        Date.now()
      ).run();
    } else {
      // Remove user from Sendy list if they opted out
      const unsubscribeFormData = new FormData();
      unsubscribeFormData.append('api_key', apiKey);
      unsubscribeFormData.append('list', listId);
      unsubscribeFormData.append('email', email);

      console.log(`Unsubscribing from Sendy: ${sendyUrl}/unsubscribe`);
      console.log(`Email: ${email}`);

      const response = await fetch(`${sendyUrl}/unsubscribe`, {
        method: 'POST',
        body: unsubscribeFormData
      });

      console.log(`Sendy unsubscribe response status: ${response.status}`);
      const result = await response.text();
      console.log(`Sendy unsubscribe response body: ${result}`);

      if (!response.ok) {
        console.error(`Sendy unsubscribe error: ${response.status} - ${result}`);
      }

      // Record marketing event
      await db.prepare(`
        INSERT INTO marketing_events (user_id, event_type, email_list, metadata, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        userId,
        'opt_out',
        'updates',
        JSON.stringify({ 
          sendy_response: result,
          list_id: listId 
        }),
        Date.now()
      ).run();
    }
  } catch (error) {
    console.error('Error syncing with Sendy:', error);
    throw error;
  }
};

// Batch sync function for admin use
export const batchSyncWithSendy = async (env: Env): Promise<{ success: number; errors: number }> => {
  if (env.MARKETING_ENABLED !== 'true') {
    console.log('Marketing is not enabled, skipping batch Sendy sync');
    return { success: 0, errors: 0 };
  }

  try {
    const db = getDB(env);
    
    // Get all users with marketing preferences
    const users = await db.prepare(`
      SELECT id, email, marketing_opt_in, marketing_opt_in_date
      FROM users 
      WHERE marketing_opt_in IS NOT NULL
    `).all();

    let successCount = 0;
    let errorCount = 0;

    for (const user of users.results || []) {
      try {
        await syncWithSendy(user.id as number, user.marketing_opt_in as boolean, env);
        successCount++;
      } catch (error) {
        console.error(`Failed to sync user ${user.id}:`, error);
        errorCount++;
      }
    }

    return { success: successCount, errors: errorCount };
  } catch (error) {
    console.error('Error in batch Sendy sync:', error);
    throw error;
  }
}; 