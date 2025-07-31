# Marketing Funnel Implementation Plan

## Overview
Implement a marketing funnel to collect emails from new users with permission to send updates, new features, and support communications. Integration with Sendy at mail.wpsteward.com.

## Phase 1: Frontend Implementation

### 1.1 Magic Link Request Enhancement
**File**: `frontend/src/components/SignUp.tsx`

**Changes**:
- Add checkbox below email input: "I'd like to receive updates about new features, app improvements, and support"
- Checkbox should be unchecked by default (opt-in)
- Add helper text: "We'll only send you relevant updates and you can unsubscribe anytime"
- Style checkbox to match existing design system
- Include marketingOptIn in the magic link request payload

**Implementation**:
```typescript
const [marketingOptIn, setMarketingOptIn] = useState(false);

// Add to form:
<Checkbox 
  isChecked={marketingOptIn}
  onChange={(e) => setMarketingOptIn(e.target.checked)}
  colorScheme="blue"
  size="md"
>
  I'd like to receive updates about new features, app improvements, and support
</Checkbox>
<Text fontSize="xs" color="gray.600" mt={1}>
  We'll only send you relevant updates and you can unsubscribe anytime
</Text>
```

### 1.2 Update Magic Link Request Handler
**File**: `frontend/src/components/SignUp.tsx`

**Changes**:
- Include `marketingOptIn` in the magic link request payload
- Update the API call to send the marketing preference
- Handle the marketing preference in the form submission

## Phase 2: Backend Implementation

### 2.1 Database Schema Updates
**File**: `workers/migrations/0017_add_marketing_preferences.sql`

**New Migration**:
```sql
-- Add marketing preferences to users table
ALTER TABLE users ADD COLUMN marketing_opt_in BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN marketing_opt_in_date INTEGER;
ALTER TABLE users ADD COLUMN marketing_opt_out_date INTEGER;

-- Add marketing preference to magic_links table
ALTER TABLE magic_links ADD COLUMN marketing_opt_in BOOLEAN DEFAULT FALSE;

-- Create marketing_events table for tracking
CREATE TABLE marketing_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  event_type TEXT NOT NULL, -- 'opt_in', 'opt_out', 'email_sent', 'email_opened', 'email_clicked'
  email_list TEXT, -- 'updates', 'features', 'support'
  metadata TEXT, -- JSON for additional data
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_marketing_opt_in ON users(marketing_opt_in);
CREATE INDEX IF NOT EXISTS idx_marketing_events_user_id ON marketing_events(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_events_event_type ON marketing_events(event_type);
```

### 2.2 Update Auth Handler
**File**: `workers/src/auth/index.ts`

**Changes**:
- Accept `marketingOptIn` in magic link request
- Store marketing preference in magic_links table
- Apply marketing preference during user creation in verifyMagicLink

**Implementation**:
```typescript
// In sendMagicLink handler
const { email, isRegistration, turnstileToken, verseSet, groupCode, marketingOptIn = false } = await request.json() as { 
  email: string; 
  isRegistration: boolean;
  turnstileToken: string;
  verseSet?: string;
  groupCode?: string;
  marketingOptIn?: boolean;
};

// Store in magic_links table with marketing preference
await db.prepare(
  'INSERT INTO magic_links (token, email, expires_at, verse_set, group_code, marketing_opt_in) VALUES (?, ?, ?, ?, ?, ?)'
).bind(token, email, expiresAt.toISOString(), verseSet || null, groupCode || null, marketingOptIn).run();

// In verifyMagicLink handler (after user creation)
if (magicLink.marketing_opt_in) {
  await db.prepare(`
    UPDATE users 
    SET marketing_opt_in = ?, marketing_opt_in_date = ?
    WHERE id = ?
  `).bind(true, Date.now(), userId).run();

  // Record marketing event
  await db.prepare(`
    INSERT INTO marketing_events (user_id, event_type, metadata, created_at)
    VALUES (?, 'opt_in', ?, ?)
  `).bind(userId, JSON.stringify({ source: 'signup' }), Date.now()).run();
}
```

### 2.3 Marketing API Endpoints
**File**: `workers/src/marketing/index.ts` (new file)

**Endpoints**:
- `POST /marketing/opt-in` - User opts in to marketing
- `POST /marketing/opt-out` - User opts out of marketing
- `GET /marketing/preferences` - Get user's marketing preferences
- `POST /marketing/sync-to-sendy` - Sync opted-in users to Sendy

**Implementation**:
```typescript
export default {
  optIn: async (request: Request, env: Env): Promise<Response> => {
    // Handle opt-in request
  },
  
  optOut: async (request: Request, env: Env): Promise<Response> => {
    // Handle opt-out request
  },
  
  getPreferences: async (request: Request, env: Env): Promise<Response> => {
    // Return user's marketing preferences
  },
  
  syncToSendy: async (request: Request, env: Env): Promise<Response> => {
    // Sync opted-in users to Sendy
  }
};
```

## Phase 3: Sendy Integration

### 3.1 Sendy API Configuration
**File**: `workers/src/marketing/sendy.ts` (new file)

**Configuration**:
- Sendy URL: `https://mail.wpsteward.com`
- API Key: Store in environment variables
- List ID: Store in environment variables

**Implementation**:
```typescript
interface SendyConfig {
  url: string;
  apiKey: string;
  listId: string;
}

const sendyConfig: SendyConfig = {
  url: env.SENDY_URL || 'https://mail.wpsteward.com',
  apiKey: env.SENDY_API_KEY,
  listId: env.SENDY_LIST_ID
};

export async function addToSendyList(email: string, name?: string): Promise<boolean> {
  const formData = new FormData();
  formData.append('api_key', sendyConfig.apiKey);
  formData.append('list', sendyConfig.listId);
  formData.append('email', email);
  if (name) formData.append('name', name);
  formData.append('boolean', 'true'); // Double opt-in

  const response = await fetch(`${sendyConfig.url}/subscribe`, {
    method: 'POST',
    body: formData
  });

  return response.ok;
}
```

### 3.2 Sync Service
**File**: `workers/src/marketing/sync.ts` (new file)

**Functionality**:
- Batch sync opted-in users to Sendy
- Handle API rate limits
- Track sync status
- Retry failed syncs

**Implementation**:
```typescript
export async function syncOptedInUsersToSendy(env: Env): Promise<void> {
  const db = getDB(env);
  
  // Get users who opted in but haven't been synced
  const users = await db.prepare(`
    SELECT u.email, u.name, u.marketing_opt_in_date
    FROM users u
    LEFT JOIN marketing_events me ON u.id = me.user_id AND me.event_type = 'sendy_synced'
    WHERE u.marketing_opt_in = true AND me.id IS NULL
    LIMIT 100
  `).all();

  for (const user of users) {
    try {
      const success = await addToSendyList(user.email, user.name);
      
      if (success) {
        // Record sync event
        await db.prepare(`
          INSERT INTO marketing_events (user_id, event_type, metadata, created_at)
          VALUES (?, 'sendy_synced', ?, ?)
        `).bind(user.id, JSON.stringify({ email: user.email }), Date.now()).run();
      }
    } catch (error) {
      console.error(`Failed to sync user ${user.email}:`, error);
    }
  }
}
```

## Phase 4: User Preferences Management

### 4.1 Settings Page Enhancement
**File**: `frontend/src/pages/Settings.tsx` (if exists) or create new component

**Features**:
- Marketing preferences toggle
- Email frequency preferences
- Unsubscribe option
- Email history

### 4.2 Email Preferences Component
**File**: `frontend/src/components/EmailPreferences.tsx` (new file)

**Implementation**:
```typescript
const EmailPreferences: React.FC = () => {
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleOptInToggle = async (optedIn: boolean) => {
    setLoading(true);
    try {
      const response = await fetch(`${getApiUrl()}/marketing/${optedIn ? 'opt-in' : 'opt-out'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        setMarketingOptIn(optedIn);
        toast({
          title: 'Success',
          description: optedIn ? 'You\'re now subscribed to updates!' : 'You\'ve been unsubscribed.',
          status: 'success'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update preferences',
        status: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <VStack spacing={4}>
      <Heading size="md">Email Preferences</Heading>
      <Switch
        isChecked={marketingOptIn}
        onChange={(e) => handleOptInToggle(e.target.checked)}
        isDisabled={loading}
      >
        Receive updates about new features and improvements
      </Switch>
      <Text fontSize="sm" color="gray.600">
        We'll send you occasional updates about new features, improvements, and support.
        You can unsubscribe anytime.
      </Text>
    </VStack>
  );
};
```

## Phase 5: Analytics & Tracking

### 5.1 Marketing Analytics
**File**: `workers/src/marketing/analytics.ts` (new file)

**Metrics to Track**:
- Opt-in rate during signup
- Opt-out rate
- Email open rates (via Sendy)
- Click-through rates
- Conversion rates

### 5.2 Dashboard Integration
**File**: `frontend/src/pages/AdminDashboard.tsx` (if exists)

**Features**:
- Marketing metrics overview
- Email list growth
- User engagement stats

## Phase 6: Email Templates & Content Strategy

### 6.1 Email Categories
1. **Welcome Series** (3 emails)
   - Welcome to Scripture Memory
   - Getting started guide
   - First week check-in

2. **Feature Updates** (as needed)
   - New verse sets
   - New features
   - App improvements

3. **Engagement Emails** (monthly)
   - Streak reminders
   - Progress celebrations
   - Community highlights

### 6.2 Sendy List Segmentation
- **Main List**: All opted-in users
- **Active Users**: Users with recent activity
- **Inactive Users**: Users who haven't used app in 30+ days
- **New Users**: Users who signed up in last 7 days

## Phase 7: Testing & Deployment

### 7.1 Testing Checklist
- [ ] Signup flow with marketing opt-in
- [ ] Opt-out functionality
- [ ] Sendy integration
- [ ] Email preferences management
- [ ] Analytics tracking
- [ ] GDPR compliance

### 7.2 Deployment Steps
1. Run database migrations
2. Deploy backend changes
3. Deploy frontend changes
4. Configure environment variables
5. Test Sendy integration
6. Monitor for 24 hours

## Phase 8: Legal & Compliance

### 8.1 Privacy Policy Updates
- Add marketing email section
- Explain data usage
- Provide unsubscribe instructions

### 8.2 GDPR Compliance
- Clear opt-in consent
- Easy unsubscribe process
- Data retention policies
- Right to be forgotten

## Environment Variables Needed

```bash
# Sendy Configuration
SENDY_URL=https://mail.wpsteward.com
SENDY_API_KEY=your_api_key_here
SENDY_LIST_ID=your_list_id_here

# Optional: Marketing settings
MARKETING_ENABLED=true
MARKETING_DEFAULT_OPT_IN=false
```

## Timeline Estimate

- **Phase 1-2**: 2-3 days (Frontend + Backend core)
- **Phase 3**: 1-2 days (Sendy integration)
- **Phase 4**: 1 day (User preferences)
- **Phase 5**: 1 day (Analytics)
- **Phase 6**: 2-3 days (Content strategy)
- **Phase 7**: 1 day (Testing & deployment)
- **Phase 8**: 1 day (Legal compliance)

**Total**: 9-12 days

## Success Metrics

- **Opt-in Rate**: Target 30-40% during signup
- **Email Open Rate**: Target 25-35%
- **Click-through Rate**: Target 5-10%
- **Unsubscribe Rate**: Keep under 2%
- **List Growth**: Track monthly growth rate

## Next Steps

1. Review and approve this plan
2. Set up Sendy API credentials
3. Begin with Phase 1 (Frontend implementation)
4. Create database migration
5. Implement backend changes
6. Test integration
7. Deploy to production
8. Monitor and optimize 