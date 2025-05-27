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
      const { email, isRegistration, turnstileToken } = await request.json() as { 
        email: string; 
        isRegistration: boolean;
        turnstileToken: string;
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
        'INSERT INTO magic_links (token, email, expires_at) VALUES (?, ?, ?)'
      ).bind(token, email, expiresAt.toISOString()).run();

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