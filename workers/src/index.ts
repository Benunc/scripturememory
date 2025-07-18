import { Router } from 'itty-router';
import { Env } from './types';
import { handleAuth } from './auth';
import { handleVerses } from './verses';
import { handleProgress } from './progress';
import { handleGamification } from './gamification';
import { handleGroups } from './groups';
import { handleAdmin } from './admin';

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
router.post('/auth/sign-out', handleAuth.signOut);
router.delete('/auth/delete', handleAuth.deleteUser);
router.post('/auth/add-verses', handleAuth.addVerseSet);


// Verse routes
router.get('/verses', handleVerses.getVerses);
router.post('/verses', handleVerses.addVerse);
router.put('/verses/:id', handleVerses.updateVerse);
router.delete('/verses/:id', handleVerses.deleteVerse);
router.post('/verses/assign-set', handleVerses.assignVerseSet);
router.post('/verses/assign-set-to-all-members', handleVerses.assignVerseSetToAllMembers);

// Progress routes
router.post('/progress/word', handleProgress.recordWordProgress);
router.post('/progress/verse', handleProgress.recordVerseAttempt);
router.post('/progress/reset-streak', handleProgress.resetVerseStreak);
router.get('/progress/mastery/:reference', handleProgress.getMasteryProgress);

// Gamification routes
router.post('/gamification/points', handleGamification.recordPointEvent);
router.get('/gamification/stats', handleGamification.getUserStats);
router.get('/gamification/time-based-stats', handleGamification.getTimeBasedStats);
router.get('/gamification/leaderboard/:groupId', handleGamification.getTimeBasedLeaderboard);

// Groups routes
router.post('/groups/create', handleGroups.createGroup);
router.get('/groups/can-create', handleGroups.canCreate);
router.post('/groups/:id/add-user', handleGroups.addUserToGroup);
router.get('/groups/:id/leaders', handleGroups.getLeaders);
router.post('/groups/:id/leaders', handleGroups.assignLeader);
router.post('/groups/:id/leaders/demote', handleGroups.demoteLeader);
router.post('/groups/:id/invite', handleGroups.inviteMember);
router.post('/groups/:id/join', handleGroups.joinGroup);
router.post('/groups/:id/join/:code', handleGroups.joinGroupByCode);
router.get('/groups/:id/members', handleGroups.getMembers);
router.put('/groups/:id/members/:userId/display-name', handleGroups.updateDisplayName);
router.get('/groups/:id/members/:userId/profile', handleGroups.getMemberProfile);
router.put('/groups/:id/members/:userId/privacy', handleGroups.updatePrivacy);
router.get('/groups/:id/leaderboard', handleGroups.getLeaderboard);
router.get('/groups/:id/stats', handleGroups.getGroupStats);
router.get('/groups/:id/members/:userId/ranking', handleGroups.getMemberRanking);

// Add new endpoint for listing all groups the user is a member of
router.get('/groups/mine', handleGroups.listUserGroups);

// Add new invitation details by code endpoint (more specific route first)
router.get('/groups/invitations/code/:code', handleGroups.getInvitationDetailsByCode);

// Add new invitation details endpoint (more general route second)
router.get('/groups/invitations/:id', handleGroups.getInvitationDetails);

// Add new existing invitation endpoint
router.post('/groups/:id/invitations/existing', handleGroups.getExistingInvitation);

// Add new group lookup by code endpoint
router.get('/groups/info/:code', handleGroups.getGroupByCode);

// Admin routes
router.get('/admin/users', handleAdmin.getAllUsers);
router.get('/admin/groups', handleAdmin.getAllGroups);
router.get('/admin/permissions', handleAdmin.getAllPermissions);
router.get('/admin/permissions/user/:userId', handleAdmin.getUserPermissions);
router.get('/admin/audit-log', handleAdmin.getAuditLog);
router.post('/admin/permissions/grant', handleAdmin.grantPermission);
router.post('/admin/permissions/revoke', handleAdmin.revokePermission);
router.get('/admin/check-super-admin', handleAdmin.checkSuperAdmin);
router.delete('/admin/groups/:id/delete', handleAdmin.deleteGroup);
router.delete('/admin/groups/:id/members/:memberId/remove', handleAdmin.removeMember);
router.get('/admin/users/:id/verses', handleAdmin.getUserVerses);

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
      
      // Check if response exists (route was found)
      if (!response) {
        return new Response(JSON.stringify({ error: 'Not Found' }), { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
      
      // Create new response with original headers plus CORS
      const headers = new Headers(response.headers);
      
      // Ensure Content-Type is preserved
      const contentType = response.headers.get('Content-Type');
      if (contentType) {
        headers.set('Content-Type', contentType);
      }
      
      // Add CORS headers
      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (error) {
      console.error('Error handling request:', error);
      const headers = new Headers({
        'Content-Type': 'application/json',
        ...corsHeaders
      });
      return new Response(JSON.stringify({ error: 'Not Found' }), { 
        status: 404,
        headers
      });
    }
  }
};