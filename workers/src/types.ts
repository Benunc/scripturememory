import { D1Database } from '@cloudflare/workers-types';

export interface Env {
  DB_DEV: D1Database;
  DB_PROD: D1Database;
  ENVIRONMENT: string;
}

export interface D1Result {
  meta: {
    last_row_id: string | number;
    changes: number;
    duration: number;
  };
  results: any[];
  success: boolean;
}

export interface User {
  id: number;
  email: string;
  created_at: number;
  last_login_at?: number;
  has_donated: boolean;
  total_donations: number;
  donation_count: number;
  last_donation_date?: number;
  last_donation_amount?: number;
  preferred_translation: string;
  notification_preferences?: Record<string, any>;
}

export interface Verse {
  id?: number;
  user_id: number;
  reference: string;
  text: string;
  translation: string;
  status: string;
  created_at: number;
}

export interface MagicLink {
  token: string;
  email: string;
  expires_at: number;
  created_at?: number;
}

export interface Session {
  token: string;
  email: string;
  expires_at: number;
  created_at?: number;
} 