import { Router } from 'itty-router';
import { Env, MagicLink, D1Result } from '../types';
import { generateToken, verifyToken } from './token';

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
  console.log('DB_DEV available:', !!env.DB_DEV);
  console.log('DB_PROD available:', !!env.DB_PROD);
  
  // In local development, always use DB_DEV
  if (env.ENVIRONMENT === 'development' || !env.ENVIRONMENT) {
    if (!env.DB_DEV) {
      console.error('DB_DEV is not available in development environment');
      throw new Error('DB_DEV is not available in development environment');
    }
    return env.DB_DEV;
  }
  
  // In production, use DB_PROD
  if (env.ENVIRONMENT === 'production') {
    if (!env.DB_PROD) {
      console.error('DB_PROD is not available in production environment');
      throw new Error('DB_PROD is not available in production environment');
    }
    return env.DB_PROD;
  }
  
  // Fallback to DB_DEV if available
  if (env.DB_DEV) {
    console.log('Using DB_DEV as fallback');
    return env.DB_DEV;
  }
  
  console.error('No database binding available');
  throw new Error('No database binding available');
};

// Helper to send magic link email
const sendMagicLinkEmail = async (email: string, magicLink: string, env: Env) => {
  // In development, just log the magic link
  if (env.ENVIRONMENT === 'development') {
    console.log('Development mode - Magic link:', magicLink);
    return;
  }

  // Send email using Cloudflare Email Workers
  const emailResponse = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email }],
        },
      ],
      from: {
        email: 'noreply@scripturememory.pages.dev',
        name: 'Scripture Memory',
      },
      subject: 'Your Magic Link for Scripture Memory',
      content: [
        {
          type: 'text/plain',
          value: `Click the link below to sign in to Scripture Memory:\n\n${magicLink}\n\nThis link will expire in 15 minutes.`,
        },
        {
          type: 'text/html',
          value: `
            <h1>Welcome to Scripture Memory</h1>
            <p>Click the link below to sign in:</p>
            <p><a href="${magicLink}">Sign in to Scripture Memory</a></p>
            <p>This link will expire in 15 minutes.</p>
            <p>If you didn't request this link, you can safely ignore this email.</p>
          `,
        },
      ],
    }),
  });

  if (!emailResponse.ok) {
    console.error('Email sending error:', await emailResponse.text());
    throw new Error('Failed to send magic link email');
  }
};

export const handleAuth = {
  // Send magic link for sign in
  sendMagicLink: async (request: Request, env: Env): Promise<Response> => {
    try {
      const { email, isRegistration } = await request.json() as { email: string; isRegistration: boolean };
      if (!email) {
        return new Response('Email is required', { status: 400 });
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
      const token = await generateToken();
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

      // Store in D1
      await db.prepare(
        'INSERT INTO magic_links (token, email, expires_at) VALUES (?, ?, ?)'
      ).bind(token, email, expiresAt).run();

      // Create magic link URL
      const magicLink = `${request.headers.get('origin')}/auth/verify?token=${token}`;

      // Send email
      await sendMagicLinkEmail(email, magicLink, env);

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
    } catch (error) {
      console.error('Error sending magic link:', error);
      return new Response('Internal Server Error', { status: 500 });
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
      const result = await db.prepare(`
        INSERT INTO users (
          email,
          created_at,
          last_login_at,
          has_donated,
          total_donations,
          donation_count,
          last_donation_date,
          last_donation_amount,
          preferred_translation
        ) VALUES (?, ?, ?, false, 0, 0, NULL, NULL, 'NIV')
      `).bind(
        magicLink.email,
        Date.now(),
        Date.now()
      ).run() as D1Result;

      // Get the last inserted row ID
      const lastRowId = result.meta.last_row_id;
      if (lastRowId === null || lastRowId === undefined) {
        throw new Error('Failed to get last inserted row ID');
      }
      const parsedId = Number(lastRowId);
      if (isNaN(parsedId)) {
        throw new Error('Invalid last inserted row ID');
      }
      userId = parsedId;
      
      // Initialize user's verses with sample verses
      const sampleVerses = [
        { reference: 'John 3:16', text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.' },
        { reference: 'Philippians 4:13', text: 'I can do all things through Christ who strengthens me.' },
        { reference: 'Jeremiah 29:11', text: 'For I know the plans I have for you," declares the LORD, "plans to prosper you and not to harm you, plans to give you hope and a future.' }
      ];

      for (const verse of sampleVerses) {
        await db.prepare(`
          INSERT INTO verses (
            user_id,
            reference,
            text,
            translation,
            created_at
          ) VALUES (?, ?, ?, 'NIV', ?)
        `).bind(
          userId,
          verse.reference,
          verse.text,
          Date.now()
        ).run();
      }
    } else {
      userId = Number(existingUser.id);
      // Update last login
      await db.prepare(
        'UPDATE users SET last_login_at = ? WHERE id = ?'
      ).bind(Date.now(), userId).run();
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
  }
}; 