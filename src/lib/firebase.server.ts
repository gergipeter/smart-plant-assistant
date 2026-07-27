// Firebase Realtime Database and Cloud Messaging integration
// Handles push notifications and real-time data sync

import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getMessaging } from 'firebase-admin/messaging';

// Initialize Firebase Admin (requires FIREBASE_KEY env var)
const serviceAccount = process.env.FIREBASE_KEY
  ? JSON.parse(Buffer.from(process.env.FIREBASE_KEY, 'base64').toString())
  : null;

let app = null;
if (serviceAccount) {
  app = initializeApp({
    credential: cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

export const db = app ? getDatabase(app) : null;
export const messaging = app ? getMessaging(app) : null;

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, string>;
}

// Send notification to device
export async function sendNotification(fcmToken: string, payload: NotificationPayload) {
  if (!messaging) return { success: false, error: 'Firebase not configured' };

  try {
    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.icon && { icon: payload.icon }),
      },
      data: payload.data || {},
      webpush: {
        fcmOptions: {
          link: '/',
        },
        notification: {
          icon: payload.icon || '/icon-192x192.png',
          badge: payload.badge || '/badge-72x72.png',
          tag: payload.tag || 'plant-reminder',
        },
      },
      token: fcmToken,
    };

    const response = await messaging.send(message);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('FCM error:', error);
    return { success: false, error: String(error) };
  }
}

// Send notifications to multiple devices
export async function sendNotificationToMany(
  fcmTokens: string[],
  payload: NotificationPayload
) {
  if (!messaging) return { success: false, error: 'Firebase not configured', failed: fcmTokens };

  const results = await Promise.allSettled(
    fcmTokens.map(token => sendNotification(token, payload))
  );

  const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
  const failed = fcmTokens.filter((_, i) => results[i]?.status === 'rejected');

  return { successful, failed, total: fcmTokens.length };
}

// Subscribe user to topic (for group notifications)
export async function subscribeToTopic(fcmToken: string, topic: string) {
  if (!messaging) return { success: false };

  try {
    await messaging.subscribeToTopic([fcmToken], topic);
    return { success: true };
  } catch (error) {
    console.error('Subscribe error:', error);
    return { success: false, error: String(error) };
  }
}

// Send to all users subscribed to a topic
export async function sendToTopic(topic: string, payload: NotificationPayload) {
  if (!messaging) return { success: false, error: 'Firebase not configured' };

  try {
    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      topic,
    };

    const response = await messaging.send(message);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Topic message error:', error);
    return { success: false, error: String(error) };
  }
}
