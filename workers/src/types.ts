import { D1Database } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_REGION: string;
  SES_FROM_EMAIL: string;
  SENDY_API_KEY: string;
  SENDY_LIST_ID: string;
  SENDY_URL: string;
  TURNSTILE_SECRET_KEY: string;
  TURNSTILE_SITE_KEY: string;
  API_URL?: string;
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
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