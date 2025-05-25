import { D1Database } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
}

export interface Verse {
  id?: number;
  email?: string;
  reference: string;
  text: string;
  translation?: string;
  created_at?: number;
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