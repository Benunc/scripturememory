import { Router } from 'itty-router';
import { Env } from './types';
import { handleAuth } from './auth/index';
import { handleVerses } from './verses/index';

// Create a new router
const router = Router();

// Add CORS headers to all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Helper to add CORS headers to a response
const addCorsHeaders = (response: Response): Response => {
  // Create new headers object with all existing headers
  const newHeaders = new Headers();
  
  // Copy all existing headers
  response.headers.forEach((value, key) => {
    newHeaders.set(key, value);
  });
  
  // Add CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
};

// Handle CORS preflight requests
router.options('*', () => {
  return new Response(null, {
    headers: corsHeaders
  });
});

// Auth routes
router.post('/auth/magic-link', handleAuth.sendMagicLink);
router.get('/auth/verify', handleAuth.verifyMagicLink);

// Verse routes
router.get('/verses', handleVerses.getVerses);
router.post('/verses', handleVerses.addVerse);
router.put('/verses/:reference', handleVerses.updateVerse);
router.delete('/verses/:reference', handleVerses.deleteVerse);

// Export the fetch handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders
      });
    }

    try {
      // Handle the request
      const response = await router.handle(request, env, ctx);
      
      // Add CORS headers to the response
      return addCorsHeaders(response);
    } catch (error) {
      console.error('Error handling request:', error);
      return addCorsHeaders(new Response('Not Found', { status: 404 }));
    }
  }
}; 