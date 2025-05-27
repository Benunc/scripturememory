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
  const newHeaders = new Headers(response.headers);
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

// Serve static files from the frontend
router.get('*', async (request: Request, env: Env) => {
  const url = new URL(request.url);
  let path = url.pathname;
  
  // If the path is '/', serve index.html
  if (path === '/') {
    path = '/index.html';
  }
  
  // Try to fetch the static file from the frontend
  try {
    const response = await env.ASSETS.fetch(request);
    if (response.status === 404) {
      // If the file is not found, serve index.html for client-side routing
      return env.ASSETS.fetch(new Request(`${url.origin}/index.html`));
    }
    return response;
  } catch (error) {
    console.error('Error serving static file:', error);
    return new Response('Not Found', { status: 404 });
  }
});

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
      return addCorsHeaders(new Response('Internal Server Error', { status: 500 }));
    }
  }
}; 