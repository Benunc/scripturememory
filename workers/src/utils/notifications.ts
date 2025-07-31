import { Env } from '../types';
import { getDB } from './db';

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

interface NotificationData {
  type: 'new_user' | 'verse_mastered' | 'guess_streak' | 'login_streak' | 'marketing_error' | 'system_error';
  userId?: number;
  userEmail?: string;
  details: Record<string, any>;
  timestamp: number;
}

export const sendNotification = async (env: Env, data: NotificationData): Promise<void> => {
  const adminEmail = 'ben@wpsteward.com';
  
  // Check if this notification type is enabled
  const db = getDB(env);
  const setting = await db.prepare(`
    SELECT enabled FROM notification_settings 
    WHERE notification_type = ?
  `).bind(data.type).first();

  if (!setting || !setting.enabled) {
    console.log(`Notification type ${data.type} is disabled, skipping`);
    return;
  }

  // Don't send actual emails in development unless explicitly enabled
  const isDevelopment = env.NODE_ENV === 'development' && env.NOTIFICATIONS_ENABLED !== 'true';
  
  if (isDevelopment) {
    console.log('Notification (dev mode):', data);
    
    // Log to database for development testing
    await db.prepare(`
      INSERT INTO notification_logs (type, user_id, user_email, details, sent_at, success, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.type,
      data.userId || null,
      data.userEmail || null,
      JSON.stringify(data.details),
      data.timestamp,
      true, // Mark as successful for dev logs
      'Development mode - email not sent'
    ).run();
    
    return;
  }

  try {
    const subject = getNotificationSubject(data);
    const body = getNotificationBody(data);
    
    // Use Amazon SES for sending emails
    const date = new Date();
    const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, '');
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const service = 'ses';
    const region = env.AWS_REGION;
    const algorithm = 'AWS4-HMAC-SHA256';
    const scope = `${dateStamp}/${region}/${service}/aws4_request`;
    
    // Create the email message
    const message = `From: ${env.SES_FROM_EMAIL}\r\nTo: ${adminEmail}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body}`;
    const messageBytes = new TextEncoder().encode(message);
    const messageBase64 = btoa(String.fromCharCode(...new Uint8Array(messageBytes)));
    
    // Create the request body
    const requestBody = `Action=SendRawEmail&Version=2010-12-01&RawMessage.Data=${encodeURIComponent(messageBase64)}`;
    
    // Create the canonical request
    const canonicalRequest = [
      'POST',
      '/',
      '',
      `content-type:application/x-www-form-urlencoded\nhost:${service}.${region}.amazonaws.com\nx-amz-date:${amzDate}`,
      'content-type;host;x-amz-date',
      arrayBufferToHex(await calculateSignature(env.AWS_SECRET_ACCESS_KEY, requestBody))
    ].join('\n');
    
    // Create the string to sign
    const stringToSign = [
      algorithm,
      amzDate,
      scope,
      arrayBufferToHex(await calculateSignature(env.AWS_SECRET_ACCESS_KEY, canonicalRequest))
    ].join('\n');
    
    // Create the authorization header
    const signature = arrayBufferToHex(await calculateSignature(env.AWS_SECRET_ACCESS_KEY, stringToSign));
    const authorizationHeader = `${algorithm} Credential=${env.AWS_ACCESS_KEY_ID}/${scope}, SignedHeaders=content-type;host;x-amz-date, Signature=${signature}`;
    
    // Send the request to SES
    const response = await fetch(`https://${service}.${region}.amazonaws.com/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Amz-Date': amzDate,
        'Authorization': authorizationHeader,
        'Host': `${service}.${region}.amazonaws.com`
      },
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send notification via SES:', errorText);
      
      // Log the failed notification
      await db.prepare(`
        INSERT INTO notification_logs (type, user_id, user_email, details, sent_at, success, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        data.type,
        data.userId || null,
        data.userEmail || null,
        JSON.stringify(data.details),
        data.timestamp,
        false,
        errorText
      ).run();
    } else {
      console.log('Notification sent successfully via SES');
      
      // Log the successful notification
      await db.prepare(`
        INSERT INTO notification_logs (type, user_id, user_email, details, sent_at, success)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        data.type,
        data.userId || null,
        data.userEmail || null,
        JSON.stringify(data.details),
        data.timestamp,
        true
      ).run();
    }
  } catch (error) {
    console.error('Error sending notification via SES:', error);
    
    // Log the error
    await db.prepare(`
      INSERT INTO notification_logs (type, user_id, user_email, details, sent_at, success, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.type,
      data.userId || null,
      data.userEmail || null,
      JSON.stringify(data.details),
      data.timestamp,
      false,
      error instanceof Error ? error.message : 'Unknown error'
    ).run();
  }
};

const getNotificationSubject = (data: NotificationData): string => {
  switch (data.type) {
    case 'new_user':
      return `🎉 New User: ${data.userEmail}`;
    case 'verse_mastered':
      return `📖 Verse Mastered: ${data.details.reference}`;
    case 'guess_streak':
      return `🔥 Guess Streak: ${data.details.streak} words`;
    case 'login_streak':
      return `📅 Login Streak: ${data.details.streak} days`;
    case 'marketing_error':
      return `⚠️ Marketing Error: ${data.userEmail}`;
    case 'system_error':
      return `🚨 System Error: ${data.details.error}`;
    default:
      return 'Scripture Memory Notification';
  }
};

const getNotificationBody = (data: NotificationData): string => {
  const timestamp = new Date(data.timestamp).toLocaleString();
  
  switch (data.type) {
    case 'new_user':
      return `New user registered!
Email: ${data.userEmail}
User ID: ${data.userId}
Time: ${timestamp}
Verse Set: ${data.details.verseSet || 'Default'}`;

    case 'verse_mastered':
      return `Verse mastered!
User: ${data.userEmail} (ID: ${data.userId})
Reference: ${data.details.reference}
Translation: ${data.details.translation}
Time: ${timestamp}`;

    case 'guess_streak':
      return `Impressive guess streak!
User: ${data.userEmail} (ID: ${data.userId})
Streak: ${data.details.streak} words
Previous Best: ${data.details.previousBest}
Time: ${timestamp}`;

    case 'login_streak':
      return `Login streak milestone!
User: ${data.userEmail} (ID: ${data.userId})
Streak: ${data.details.streak} days
Previous Best: ${data.details.previousBest}
Time: ${timestamp}`;

    case 'marketing_error':
      return `Marketing opt-in failed!
User: ${data.userEmail} (ID: ${data.userId})
Error: ${data.details.error}
Time: ${timestamp}
Action needed: Check Sendy integration`;

    case 'system_error':
      return `System error occurred!
Error: ${data.details.error}
Context: ${data.details.context}
Time: ${timestamp}
Action needed: Investigate system health`;

    default:
      return `Notification: ${JSON.stringify(data, null, 2)}`;
  }
};

// Convenience functions for specific notification types
export const notifyNewUser = async (env: Env, userId: number, userEmail: string, verseSet?: string): Promise<void> => {
  await sendNotification(env, {
    type: 'new_user',
    userId,
    userEmail,
    details: { verseSet },
    timestamp: Date.now(),
  });
};

export const notifyVerseMastered = async (env: Env, userId: number, userEmail: string, reference: string, translation: string): Promise<void> => {
  await sendNotification(env, {
    type: 'verse_mastered',
    userId,
    userEmail,
    details: { reference, translation },
    timestamp: Date.now(),
  });
};

export const notifyGuessStreak = async (env: Env, userId: number, userEmail: string, streak: number, previousBest: number): Promise<void> => {
  // Only notify for significant streaks (100+ words or new personal best)
  if (streak >= 100 || streak > previousBest) {
    await sendNotification(env, {
      type: 'guess_streak',
      userId,
      userEmail,
      details: { streak, previousBest },
      timestamp: Date.now(),
    });
  }
};

export const notifyLoginStreak = async (env: Env, userId: number, userEmail: string, streak: number, previousBest: number): Promise<void> => {
  // Only notify for milestone streaks (7, 30, 100 days) or new personal best
  const milestones = [7, 30, 100];
  if (milestones.includes(streak) || streak > previousBest) {
    await sendNotification(env, {
      type: 'login_streak',
      userId,
      userEmail,
      details: { streak, previousBest },
      timestamp: Date.now(),
    });
  }
};

export const notifyMarketingError = async (env: Env, userId: number, userEmail: string, error: string): Promise<void> => {
  await sendNotification(env, {
    type: 'marketing_error',
    userId,
    userEmail,
    details: { error },
    timestamp: Date.now(),
  });
};

export const notifySystemError = async (env: Env, error: string, context: string): Promise<void> => {
  await sendNotification(env, {
    type: 'system_error',
    details: { error, context },
    timestamp: Date.now(),
  });
}; 