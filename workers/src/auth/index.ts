import { Router } from 'itty-router';
import { Env, MagicLink, D1Result } from '../types';
import { generateToken, verifyToken } from './token';
import { getUserId } from '../utils/db';
import { getVerseSet } from './sampleVerses';

// Rate limiting
const RATE_LIMIT = 5; // requests per minute
const rateLimits = new Map<string, number[]>();

const isRateLimited = (email: string): boolean => {
  const now = Date.now();
  const userRequests = rateLimits.get(email) || [];
  const recentRequests = userRequests.filter(time => now - time < 60000);
  rateLimits.set(email, recentRequests);
  return recentRequests.length >= RATE_LIMIT;
};

const recordRequest = (email: string) => {
  const now = Date.now();
  const userRequests = rateLimits.get(email) || [];
  userRequests.push(now);
  rateLimits.set(email, userRequests);
};

// Helper to get the correct database binding
const getDB = (env: Env) => {
  console.log('Environment:', env.ENVIRONMENT);
  
  // In production, use DB
  if (env.ENVIRONMENT === 'production') {
    if (!env.DB) {
      console.error('DB is not available in production environment');
      throw new Error('DB is not available in production environment');
    }
    return env.DB;
  }
  
  // In development, use DB
  if (env.ENVIRONMENT === 'development' || !env.ENVIRONMENT) {
    if (!env.DB) {
      console.error('DB is not available in development environment');
      throw new Error('DB is not available in development environment');
    }
    return env.DB;
  }
  
  console.error('No database binding available');
  throw new Error('No database binding available');
};

// Helper to calculate AWS signature
const calculateSignature = async (key: string | ArrayBuffer, msg: string): Promise<ArrayBuffer> => {
  const encoder = new TextEncoder();
  const keyData = typeof key === 'string' ? encoder.encode(key) : new Uint8Array(key);
  const msgData = encoder.encode(msg);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, msgData);
};

// Helper to convert ArrayBuffer to hex string
const arrayBufferToHex = (buffer: ArrayBuffer): string => {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

// Helper to convert ArrayBuffer to string for key derivation
const arrayBufferToString = (buffer: ArrayBuffer): string => {
  return arrayBufferToHex(buffer);
};

// Helper to send magic link email
const sendMagicLinkEmail = async (email: string, magicLink: string, env: Env) => {
  try {
    // In development, just log the magic link
    if (env.ENVIRONMENT === 'development' || !env.ENVIRONMENT) {
      console.log('=== Magic Link for Testing ===');
      console.log('Email:', email);
      console.log('Magic Link:', magicLink);
      console.log('=============================');
      return;
    }

    const date = new Date();
    // Format: YYYYMMDD
    const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, '');
    // Format: YYYYMMDDTHHMMSSZ
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const service = 'ses';
    const region = env.AWS_REGION;
    const algorithm = 'AWS4-HMAC-SHA256';
    const scope = `${dateStamp}/${region}/${service}/aws4_request`;

    // Prepare email content
    const payload = new URLSearchParams({
      Action: 'SendEmail',
      Version: '2010-12-01',
      'Source': env.SES_FROM_EMAIL,
      'Destination.ToAddresses.member.1': email,
      'Message.Subject.Data': 'Your Magic Link for Scripture Memory',
      'Message.Body.Html.Data': `
        <h1>Welcome to Scripture Memory</h1>
        <p>Click the link below to sign in:</p>
        <p><a href="${magicLink}">Sign in to Scripture Memory</a></p>
        <p>This link will expire in 15 minutes.</p>
        <p>If you didn't request this link, you can safely ignore this email.</p>
      `,
      'Message.Body.Text.Data': `Click the link below to sign in to Scripture Memory:\n\n${magicLink}\n\nThis link will expire in 15 minutes.`
    }).toString();

    // Create canonical request
    const canonicalUri = '/';
    const canonicalQuerystring = '';
    const canonicalHeaders = [
      'content-type:application/x-www-form-urlencoded',
      'host:email.' + region + '.amazonaws.com',
      'x-amz-date:' + amzDate,
      'x-amz-target:AmazonSES.SendEmail'
    ].join('\n') + '\n';
    const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';

    // Calculate payload hash
    const payloadHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
    const payloadHashHex = arrayBufferToHex(payloadHash);

    const canonicalRequest = [
      'POST',
      canonicalUri,
      canonicalQuerystring,
      canonicalHeaders,
      signedHeaders,
      payloadHashHex
    ].join('\n');

    // Calculate canonical request hash
    const canonicalRequestHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest));
    const canonicalRequestHashHex = arrayBufferToHex(canonicalRequestHash);

    // Create string to sign
    const stringToSign = [
      algorithm,
      amzDate,
      scope,
      canonicalRequestHashHex
    ].join('\n');

    // Calculate signing key
    const kDate = await calculateSignature('AWS4' + env.AWS_SECRET_ACCESS_KEY, dateStamp);
    const kRegion = await calculateSignature(kDate, region);
    const kService = await calculateSignature(kRegion, service);
    const kSigning = await calculateSignature(kService, 'aws4_request');
    const signature = await calculateSignature(kSigning, stringToSign);
    const signatureHex = arrayBufferToHex(signature);

    // Send email using SES
    const response = await fetch(`https://email.${region}.amazonaws.com`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Amz-Date': amzDate,
        'X-Amz-Target': 'AmazonSES.SendEmail',
        'Authorization': `${algorithm} Credential=${env.AWS_ACCESS_KEY_ID}/${scope},SignedHeaders=${signedHeaders},Signature=${signatureHex}`
      },
      body: payload
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Email sending error:', errorText);
      // Log the magic link for testing if email sending fails
      console.log('=== Magic Link for Testing (Email Failed) ===');
      console.log(magicLink);
      console.log('===========================================');
    }
  } catch (error) {
    console.error('Error sending email:', error);
    // Log the magic link for testing if email sending fails
    console.log('=== Magic Link for Testing (Email Error) ===');
    console.log(magicLink);
    console.log('===========================================');
  }
};

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

const verifyTurnstileToken = async (token: string, env: Env, request: Request): Promise<boolean> => {
  const isLocalhost = request.headers.get('host')?.includes('localhost') || false;
  
  // Accept any token when running locally
  if (isLocalhost) {
    return true;
  }

  try {
    console.log('Verifying Turnstile token...');
    const formData = new FormData();
    formData.append('secret', env.TURNSTILE_SECRET_KEY);
    formData.append('response', token);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    });

    const result = await response.json() as TurnstileResponse;
    console.log('Turnstile verification result:', result);
    
    if (!result.success) {
      console.error('Turnstile verification failed:', result['error-codes']);
    }
    
    return result.success === true;
  } catch (error) {
    console.error('Error verifying Turnstile token:', error);
    return false;
  }
};

export const handleAuth = {
  // Send magic link for sign in
  sendMagicLink: async (request: Request, env: Env): Promise<Response> => {
    try {
      const { email, isRegistration, turnstileToken, verseSet } = await request.json() as { 
        email: string; 
        isRegistration: boolean;
        turnstileToken: string;
        verseSet?: string;
      };

      if (!email) {
        return new Response('Email is required', { status: 400 });
      }

      if (!turnstileToken) {
        return new Response('Turnstile token is required', { status: 400 });
      }

      // Verify Turnstile token
      const isValidToken = await verifyTurnstileToken(turnstileToken, env, request);
      
      if (!isValidToken) {
        return new Response('Invalid Turnstile token', { status: 400 });
      }

      if (isRateLimited(email)) {
        return new Response('Too many requests. Please try again later.', { status: 429 });
      }

      recordRequest(email);
      const db = getDB(env);

      // For sign in, check if user exists first
      if (!isRegistration) {
        const existingUser = await db.prepare(
          'SELECT * FROM users WHERE LOWER(email) = LOWER(?)'
        ).bind(email).first();

        // If user doesn't exist, return success but don't send email
        if (!existingUser) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'If an account exists with this email, you will receive a magic link shortly. Check your spam folder if you don\'t see it.'
            }),
            {
              headers: { 'Content-Type': 'application/json' },
              status: 200
            }
          );
        }
      }

      // Generate token and create magic link
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

      // Store in D1
      await db.prepare(
        'INSERT INTO magic_links (token, email, expires_at, verse_set) VALUES (?, ?, ?, ?)'
      ).bind(token, email, expiresAt.toISOString(), verseSet || null).run();

      // Send email
      await sendMagicLinkEmail(email, `${request.headers.get('origin')}/auth/verify?token=${token}`, env);

      return new Response(
        JSON.stringify({
          success: true,
          message: `token=${token}`,
          email: email
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        }
      );
    } catch (error) {
      console.error('Error in sendMagicLink:', error);
      return new Response('Internal server error', { status: 500 });
    }
  },

  // Verify magic link
  verifyMagicLink: async (request: Request, env: Env): Promise<Response> => {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    
    if (!token) {
      return new Response('Missing token', { status: 400 });
    }

    const db = getDB(env);
    
    // Get the magic link
    console.log('Looking up magic link with token:', token);
    const magicLink = await db.prepare(
      'SELECT * FROM magic_links WHERE token = ? AND expires_at > ?'
    ).bind(token, Date.now()).first();
    console.log('Magic link lookup result:', magicLink);

    if (!magicLink) {
      console.log('No valid magic link found');
      return new Response('Invalid or expired token', { status: 400 });
    }

    // Delete the used magic link
    await db.prepare('DELETE FROM magic_links WHERE token = ?').bind(token).run();
    console.log('Deleted used magic link');

    // Check if user exists
    console.log('Checking for existing user with email:', magicLink.email);
    const existingUser = await db.prepare(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?)'
    ).bind(magicLink.email).first();
    console.log('Existing user query result:', existingUser);

    let userId: number;
    
    if (!existingUser) {
      console.log('No existing user found, creating new user');
      // Create new user
      const result = await db.prepare(
        'INSERT INTO users (email, created_at) VALUES (?, ?)'
      ).bind(magicLink.email, Date.now()).run();
      userId = Number(result.meta.last_row_id);
      
      // Initialize user stats with streak of 1
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
        ) VALUES (?, 0, 1, 1, 0, 0, ?, ?)
      `).bind(userId, Date.now(), Date.now()).run();

      // Add sample verses for new users only
      console.log('Starting to add sample verses for new user');
      const sampleVerses = getVerseSet(magicLink.verse_set as string);

      // Insert sample verses
      for (const verse of sampleVerses) {
        console.log('Inserting verse:', verse.reference);
        try {
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
            verse.reference,
            verse.text,
            'NIV',
            Date.now()
          ).run();
          console.log('Successfully inserted verse:', verse.reference);
        } catch (error) {
          console.error('Error inserting verse:', verse.reference, error);
          throw error;
        }
      }
      console.log('Finished adding sample verses');
    } else {
      userId = Number(existingUser.id);
      
      // Update last_login_at for existing user
      await db.prepare(
        'UPDATE users SET last_login_at = ? WHERE id = ?'
      ).bind(Date.now(), userId).run();

      // Get current stats
      const stats = await db.prepare(`
        SELECT last_activity_date, current_streak, longest_streak 
        FROM user_stats 
        WHERE user_id = ?
      `).bind(userId).first() as { last_activity_date: number, current_streak: number, longest_streak: number } | null;

      if (stats) {
        const lastActivity = new Date(stats.last_activity_date);
        const currentTime = new Date();
        const yesterday = new Date(currentTime);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);

        // If last activity was yesterday or earlier, increment streak
        if (lastActivity <= yesterday) {
          const newStreak = stats.current_streak + 1;
          const longestStreak = Math.max(newStreak, stats.longest_streak);

          await db.prepare(`
            UPDATE user_stats 
            SET current_streak = ?,
                longest_streak = ?,
                last_activity_date = ?
            WHERE user_id = ?
          `).bind(newStreak, longestStreak, Date.now(), userId).run();

          // Award points for maintaining streak if > 1 day
          if (newStreak > 1) {
            await db.prepare(`
              INSERT INTO point_events (
                user_id,
                event_type,
                points,
                metadata,
                created_at
              ) VALUES (?, 'daily_streak', ?, ?, ?)
            `).bind(
              userId,
              50, // DAILY_STREAK points
              JSON.stringify({ streak_days: newStreak }),
              Date.now()
            ).run();

            // Update total points
            await db.prepare(`
              UPDATE user_stats 
              SET total_points = total_points + ?
              WHERE user_id = ?
            `).bind(50, userId).run();
          }
        } else {
          // Ensure minimum streak of 1 and update last activity date
          await db.prepare(`
            UPDATE user_stats 
            SET current_streak = CASE 
                WHEN current_streak = 0 THEN 1 
                ELSE current_streak 
              END,
              last_activity_date = ?
            WHERE user_id = ?
          `).bind(Date.now(), userId).run();
        }
      } else {
        // Initialize stats if they don't exist
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
          ) VALUES (?, 0, 1, 1, 0, 0, ?, ?)
        `).bind(userId, Date.now(), Date.now()).run();
      }
    }

    // Create session
    const sessionToken = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO sessions (user_id, token, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `).bind(
      userId,
      sessionToken,
      Date.now(),
      Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
    ).run();

    // Set session cookie
    const headers = new Headers();
    headers.append('Set-Cookie', `session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);
    
    return new Response(JSON.stringify({ 
      success: true,
      token: sessionToken,
      email: magicLink.email
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(headers)
      }
    });
  },
  signOut: async (request: Request, env: Env): Promise<Response> => {
      try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response('Missing or invalid Authorization header', { status: 401 });
      }

      const sessionToken = authHeader.substring(7); // Remove "Bearer " prefix

      const db = getDB(env);
      const result = await db.prepare('DELETE FROM sessions WHERE token = ?')
        .bind(sessionToken)
        .run();

      if (result.meta.changes === 0) {
        // Optional: Let the client know the token was already invalid.
        // A 200 OK is also fine to not reveal token status.
        console.log(`Sign-out attempt with an invalid token: ${sessionToken}`);
      }

      return new Response(JSON.stringify({ success: true, message: 'Signed out successfully' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error) {
      console.error('Error in signOut:', error);
      return new Response(JSON.stringify({ error: 'Failed to sign out' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
  },

  // Anonymize user and preserve analytics data
  deleteUser: async (request: Request, env: Env): Promise<Response> => {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.split(' ')[1];
      const userId = await getUserId(token, env);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Invalid session' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
      if (!user) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Gather all user data for anonymization
      const userData = await env.DB.prepare(`
        SELECT 
          u.id,
          u.email,
          u.created_at,
          u.last_login_at,
          us.longest_streak,
          us.current_streak,
          us.verses_mastered,
          us.total_attempts,
          us.total_points
        FROM users u
        LEFT JOIN user_stats us ON u.id = us.user_id
        WHERE u.id = ?
      `).bind(user.id).first();

      // Get all verses the user has worked on
      const verses = await env.DB.prepare(`
        SELECT DISTINCT reference 
        FROM verses 
        WHERE user_id = ?
      `).bind(user.id).all();

      // Get mastery progress data
      const masteryProgress = await env.DB.prepare(`
        SELECT 
          verse_reference,
          current_streak,
          longest_streak,
          last_mastered_date,
          days_mastered
        FROM verse_mastery 
        WHERE user_id = ?
      `).bind(user.id).all();

      // Get metadata counts
      const pointEventsCount = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM point_events WHERE user_id = ?
      `).bind(user.id).first();

      const wordProgressCount = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM word_progress WHERE user_id = ?
      `).bind(user.id).first();

      const verseAttemptsCount = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM verse_attempts WHERE user_id = ?
      `).bind(user.id).first();

      const masteredVersesCount = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM mastered_verses WHERE user_id = ?
      `).bind(user.id).first();

      const verseMasteryCount = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM verse_mastery WHERE user_id = ?
      `).bind(user.id).first();

      // Insert anonymized data
      await env.DB.prepare(`
        INSERT INTO anonymized_users (
          original_user_id,
          created_at,
          last_login_at,
          longest_streak,
          current_streak,
          verses_mastered,
          total_attempts,
          total_points,
          verses,
          mastery_progress,
          total_point_events,
          total_word_progress,
          total_verse_attempts,
          total_mastered_verses,
          total_verse_mastery,
          deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        user.id,
        userData?.created_at,
        userData?.last_login_at,
        userData?.longest_streak || 0,
        userData?.current_streak || 0,
        userData?.verses_mastered || 0,
        userData?.total_attempts || 0,
        userData?.total_points || 0,
        JSON.stringify(verses.results?.map(v => v.reference) || []),
        JSON.stringify(masteryProgress.results || []),
        pointEventsCount?.count || 0,
        wordProgressCount?.count || 0,
        verseAttemptsCount?.count || 0,
        masteredVersesCount?.count || 0,
        verseMasteryCount?.count || 0,
        new Date().toISOString()
      ).run();

      // Delete user data in order
      const tables = [
        'point_events',
        'word_progress',
        'verse_attempts',
        'mastered_verses',
        'verse_mastery',
        'verses',
        'user_stats',
        'sessions',
        'magic_links',  // Delete magic links by email instead of user_id
        'users'
      ];

      for (const table of tables) {
        try {
          // Check if table exists
          const tableExists = await env.DB.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name=?
          `).bind(table).first();

          if (!tableExists) {
            continue;
          }

          if (table === 'magic_links') {
            // Delete magic links by email instead of user_id
            await env.DB.prepare(`DELETE FROM ${table} WHERE email = ?`).bind(user.email).run();
          } else if (table === 'users') {
            // Use 'id' instead of 'user_id' for users table
            await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(user.id).run();
          } else {
            await env.DB.prepare(`DELETE FROM ${table} WHERE user_id = ?`).bind(user.id).run();
          }
        } catch (error) {
          console.error(`Error deleting from ${table}:`, error);
          throw error;
        }
      }

      return new Response(JSON.stringify({ 
        message: 'User successfully anonymized and deleted',
        anonymized: {
          original_user_id: user.id,
          verses_mastered: userData?.verses_mastered || 0,
          total_attempts: userData?.total_attempts || 0,
          total_points: userData?.total_points || 0,
          total_point_events: pointEventsCount?.count || 0,
          total_word_progress: wordProgressCount?.count || 0,
          total_verse_attempts: verseAttemptsCount?.count || 0,
          total_mastered_verses: masteredVersesCount?.count || 0,
          total_verse_mastery: verseMasteryCount?.count || 0
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Error in deleteUser:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to delete user',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}; 