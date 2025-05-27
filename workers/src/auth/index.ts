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
  try {
    // In development, just log the magic link
    if (env.ENVIRONMENT === 'development' || !env.ENVIRONMENT) {
      console.log('=== Magic Link for Testing ===');
      console.log('Email:', email);
      console.log('Magic Link:', magicLink);
      console.log('=============================');
      return;
    }

    // Create SES client configuration
    const sesConfig = {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      region: env.AWS_REGION
    };

    // Prepare email content
    const emailParams = {
      Source: env.SES_FROM_EMAIL,
      Destination: {
        ToAddresses: [email]
      },
      Message: {
        Subject: {
          Data: 'Your Magic Link for Scripture Memory'
        },
        Body: {
          Html: {
            Data: `
              <h1>Welcome to Scripture Memory</h1>
              <p>Click the link below to sign in:</p>
              <p><a href="${magicLink}">Sign in to Scripture Memory</a></p>
              <p>This link will expire in 15 minutes.</p>
              <p>If you didn't request this link, you can safely ignore this email.</p>
            `
          },
          Text: {
            Data: `Click the link below to sign in to Scripture Memory:\n\n${magicLink}\n\nThis link will expire in 15 minutes.`
          }
        }
      }
    };

    // Send email using SES
    const response = await fetch(`https://email.${env.AWS_REGION}.amazonaws.com/v2/email/outbound-emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Amz-Date': new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''),
        'Authorization': `AWS4-HMAC-SHA256 Credential=${env.AWS_ACCESS_KEY_ID}/${new Date().toISOString().split('T')[0]}/${env.AWS_REGION}/ses/aws4_request`
      },
      body: JSON.stringify(emailParams)
    });

    if (!response.ok) {
      console.error('Email sending error:', await response.text());
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

// Helper to verify Turnstile token
const verifyTurnstileToken = async (token: string, env: Env, request: Request): Promise<boolean> => {
  const isLocalhost = request.headers.get('host')?.includes('localhost') || false;
  
  console.log('Verifying Turnstile token:', {
    token,
    environment: env.ENVIRONMENT,
    isDevelopment: env.ENVIRONMENT === 'development',
    isLocalhost,
    host: request.headers.get('host')
  });

  // Accept any token when running locally
  if (isLocalhost) {
    console.log('Local development: accepting any token');
    return true;
  }

  try {
    const formData = new FormData();
    formData.append('secret', env.TURNSTILE_SECRET_KEY);
    formData.append('response', token);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    });

    const result = await response.json() as { success: boolean };
    console.log('Turnstile verification result:', result);
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
      console.log('Received magic link request');
      const { email, isRegistration, turnstileToken } = await request.json() as { 
        email: string; 
        isRegistration: boolean;
        turnstileToken: string;
      };
      console.log('Request data:', { email, isRegistration, turnstileToken });

      if (!email) {
        console.log('Email is missing');
        return new Response('Email is required', { status: 400 });
      }

      if (!turnstileToken) {
        console.log('Turnstile token is missing');
        return new Response('Turnstile token is required', { status: 400 });
      }

      // Verify Turnstile token
      console.log('Verifying Turnstile token...');
      const isValidToken = await verifyTurnstileToken(turnstileToken, env, request);
      console.log('Turnstile token verification result:', isValidToken);
      
      if (!isValidToken) {
        console.log('Invalid Turnstile token');
        return new Response('Invalid Turnstile token', { status: 400 });
      }

      if (isRateLimited(email)) {
        console.log('Rate limit exceeded for email:', email);
        return new Response('Too many requests. Please try again later.', { status: 429 });
      }

      recordRequest(email);
      console.log('Getting database connection...');
      const db = getDB(env);
      console.log('Database connection established');

      // For sign in, check if user exists first
      if (!isRegistration) {
        console.log('Checking for existing user...');
        const existingUser = await db.prepare(
          'SELECT * FROM users WHERE LOWER(email) = LOWER(?)'
        ).bind(email).first();
        console.log('Existing user check result:', existingUser);

        // If user doesn't exist, return success but don't send email
        if (!existingUser) {
          console.log('No existing user found');
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
      console.log('Generating magic link...');
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

      // Store in D1
      console.log('Storing magic link in database...');
      await db.prepare(
        'INSERT INTO magic_links (token, email, expires_at) VALUES (?, ?, ?)'
      ).bind(token, email, expiresAt.toISOString()).run();
      console.log('Magic link stored successfully');

      // Send email
      console.log('Sending magic link email...');
      await sendMagicLinkEmail(email, `${request.headers.get('origin')}/auth/verify?token=${token}`, env);
      console.log('Magic link email sent');

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
      console.error('Error in sendMagicLink:', error);
      // Log the full error details
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
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