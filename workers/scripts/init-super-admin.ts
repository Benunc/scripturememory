import { Env } from '../src/types';
import { getDB } from '../src/utils/db';

// Initialize super admin system
export async function initSuperAdmin(env: Env, superAdminEmail: string): Promise<void> {
  const db = getDB(env);
  
  console.log('Initializing super admin system...');
  
  // First, find the user by email
  const user = await db.prepare(`
    SELECT id, email FROM users WHERE email = ?
  `).bind(superAdminEmail).first();
  
  if (!user) {
    throw new Error(`User with email ${superAdminEmail} not found. Please create the user account first.`);
  }
  
  console.log(`Found user: ${user.email} (ID: ${user.id})`);
  
  // Check if super admin already exists
  const existingSuperAdmin = await db.prepare(`
    SELECT 1 FROM super_admins WHERE user_id = ?
  `).bind(user.id).first();
  
  if (existingSuperAdmin) {
    console.log('Super admin already exists for this user.');
    return;
  }
  
  // Add super admin (self-added for the first one)
  await db.prepare(`
    INSERT INTO super_admins (user_id, email, added_by, added_at, is_active)
    VALUES (?, ?, ?, ?, TRUE)
  `).bind(user.id, user.email, user.id, Date.now()).run();
  
  console.log(`Super admin privileges granted to ${user.email}`);
  
  // Grant all permissions to super admin
  const permissions = ['create_groups', 'delete_groups', 'manage_users', 'view_all_groups'];
  
  for (const permissionType of permissions) {
    await db.prepare(`
      INSERT OR REPLACE INTO user_permissions 
      (user_id, permission_type, granted_by, granted_at, expires_at, is_active)
      VALUES (?, ?, ?, ?, NULL, TRUE)
    `).bind(user.id, permissionType, user.id, Date.now()).run();
    
    console.log(`Permission ${permissionType} granted to ${user.email}`);
  }
  
  console.log('Super admin initialization complete!');
}

// Test the super admin system
export async function testSuperAdmin(env: Env, email: string): Promise<void> {
  const db = getDB(env);
  
  console.log('Testing super admin system...');
  
  // Find user
  const user = await db.prepare(`
    SELECT id, email FROM users WHERE email = ?
  `).bind(email).first();
  
  if (!user) {
    console.log(`User ${email} not found`);
    return;
  }
  
  // Check super admin status
  const superAdmin = await db.prepare(`
    SELECT * FROM super_admins WHERE user_id = ? AND is_active = TRUE
  `).bind(user.id).first();
  
  if (superAdmin) {
    console.log(`✅ ${email} is a super admin`);
  } else {
    console.log(`❌ ${email} is not a super admin`);
  }
  
  // Check permissions
  const permissions = await db.prepare(`
    SELECT permission_type, granted_at, expires_at, is_active
    FROM user_permissions 
    WHERE user_id = ? AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > ?)
  `).bind(user.id, Date.now()).all();
  
  console.log(`Permissions for ${email}:`);
  if (permissions.results.length === 0) {
    console.log('  No permissions found');
  } else {
    permissions.results.forEach((perm: any) => {
      console.log(`  - ${perm.permission_type} (granted: ${new Date(perm.granted_at).toISOString()})`);
    });
  }
}

// List all super admins
export async function listSuperAdmins(env: Env): Promise<void> {
  const db = getDB(env);
  
  console.log('Listing all super admins...');
  
  const superAdmins = await db.prepare(`
    SELECT 
      sa.id,
      sa.user_id,
      sa.email,
      sa.added_at,
      sa.is_active,
      u.email as user_email
    FROM super_admins sa
    JOIN users u ON sa.user_id = u.id
    WHERE sa.is_active = TRUE
    ORDER BY sa.added_at ASC
  `).all();
  
  if (superAdmins.results.length === 0) {
    console.log('No super admins found');
    return;
  }
  
  console.log('Super admins:');
  superAdmins.results.forEach((admin: any) => {
    console.log(`  - ${admin.email} (ID: ${admin.user_id}, added: ${new Date(admin.added_at).toISOString()})`);
  });
}

// List all permissions
export async function listAllPermissions(env: Env): Promise<void> {
  const db = getDB(env);
  
  console.log('Listing all active permissions...');
  
  const permissions = await db.prepare(`
    SELECT 
      up.id,
      up.user_id,
      up.permission_type,
      up.granted_at,
      up.expires_at,
      up.is_active,
      u.email as user_email,
      g.email as granted_by_email
    FROM user_permissions up
    JOIN users u ON up.user_id = u.id
    JOIN users g ON up.granted_by = g.id
    WHERE up.is_active = TRUE
    AND (up.expires_at IS NULL OR up.expires_at > ?)
    ORDER BY up.granted_at DESC
  `).bind(Date.now()).all();
  
  if (permissions.results.length === 0) {
    console.log('No active permissions found');
    return;
  }
  
  console.log('Active permissions:');
  permissions.results.forEach((perm: any) => {
    const expiresText = perm.expires_at ? ` (expires: ${new Date(perm.expires_at).toISOString()})` : ' (permanent)';
    console.log(`  - ${perm.user_email}: ${perm.permission_type}${expiresText}`);
  });
} 