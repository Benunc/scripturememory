import { Router } from 'itty-router';
import { Env, MagicLink } from '../types';
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

export const handleAuth = {
  // Send magic link
  sendMagicLink: async (request: Request, env: Env): Promise<Response> => {
    try {
      const { email } = await request.json();
      
      if (!email) {
        return new Response('Email is required', { status: 400 });
      }

      if (isRateLimited(email)) {
        return new Response('Too many requests. Please try again later.', { status: 429 });
      }

      recordRequest(email);

      // Generate magic link token
      const token = await generateToken();
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

      // Store token in D1
      await env.DB.prepare(
        'INSERT INTO magic_links (token, email, expires_at) VALUES (?, ?, ?)'
      ).bind(token, email, expiresAt).run();

      // In production, you would send an email here
      // For development, we'll just return the token
      return new Response(JSON.stringify({ token }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error sending magic link:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  // Verify magic link
  verifyMagicLink: async (request: Request, env: Env): Promise<Response> => {
    try {
      console.log('=== Starting token verification ===');
      const url = new URL(request.url);
      const token = url.searchParams.get('token');
      console.log('Received token:', token);
      console.log('Current timestamp:', Date.now());

      if (!token) {
        console.log('No token provided');
        return new Response('Token is required', { status: 400 });
      }

      // Verify token in D1
      console.log('Querying database for token...');
      const result = await env.DB.prepare(
        'SELECT * FROM magic_links WHERE token = ? AND expires_at > ?'
      ).bind(token, Date.now()).first();
      
      console.log('Database query result:', result);

      if (!result) {
        console.log('Token not found or expired');
        return new Response('Invalid or expired token', { status: 401 });
      }

      console.log('Token found, generating session...');
      // Delete used token
      await env.DB.prepare(
        'DELETE FROM magic_links WHERE token = ?'
      ).bind(token).run();

      // Generate session token
      const sessionToken = await generateToken();
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      // Store session in D1
      await env.DB.prepare(
        'INSERT INTO sessions (token, email, expires_at) VALUES (?, ?, ?)'
      ).bind(sessionToken, result.email, expiresAt).run();

      console.log('Session created successfully');
      return new Response(JSON.stringify({ 
        token: sessionToken,
        email: result.email
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error in verifyMagicLink:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
}; 