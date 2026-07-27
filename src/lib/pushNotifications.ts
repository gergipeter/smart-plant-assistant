// Client-side push notification subscription — registers the service
// worker, requests browser notification permission, and exchanges that for
// an FCM device token saved via notifications.server.ts's
// savePushSubscription. The actual *sending* of a push (once a reminder is
// due) happens server-side in firebase.server.ts / the watering-reminder
// Edge Function — this module only owns getting a token onto this device.
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, deleteToken, isSupported, type Messaging } from "firebase/messaging";
import { savePushSubscription, removePushSubscription } from "@/lib/notifications.server";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export const isPushConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && vapidKey,
);

let appInstance: FirebaseApp | null = null;
let messagingInstance: Messaging | null = null;

async function getMessagingInstance(): Promise<Messaging | null> {
  if (!isPushConfigured) return null;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  if (!(await isSupported())) return null;

  if (!messagingInstance) {
    appInstance = appInstance ?? initializeApp(firebaseConfig);
    messagingInstance = getMessaging(appInstance);
  }
  return messagingInstance;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const params = new URLSearchParams({
    apiKey: firebaseConfig.apiKey ?? "",
    authDomain: firebaseConfig.authDomain ?? "",
    projectId: firebaseConfig.projectId ?? "",
    messagingSenderId: firebaseConfig.messagingSenderId ?? "",
    appId: firebaseConfig.appId ?? "",
  });
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params}`);
}

export type PushSubscribeResult =
  | { status: "ok" }
  | { status: "denied" }
  | { status: "unsupported" }
  | { status: "error"; message: string };

// Requests notification permission (triggers the browser's native prompt)
// and, if granted, registers this device's FCM token against `userId`.
// Call this from a deliberate user action (a settings toggle), never on
// page load — unsolicited permission prompts get auto-denied by most
// browsers' heuristics and burn the one chance to ask.
export async function subscribeToPush(userId: string): Promise<PushSubscribeResult> {
  if (!isPushConfigured) return { status: "unsupported" };

  const messaging = await getMessagingInstance();
  if (!messaging) return { status: "unsupported" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { status: "denied" };

  try {
    const registration = await registerServiceWorker();
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (!token) return { status: "error", message: "Could not get a device token." };

    const res = await savePushSubscription({ data: { userId, fcmToken: token } });
    if (res.status !== "ok") {
      return { status: "error", message: res.status === "error" ? res.message : "Could not save subscription." };
    }
    return { status: "ok" };
  } catch (err) {
    console.error("Push subscribe error:", err);
    return { status: "error", message: "Could not enable push notifications." };
  }
}

// Revokes this device's token locally and removes it server-side, so no
// further pushes are sent to it.
export async function unsubscribeFromPush(userId: string): Promise<void> {
  const messaging = await getMessagingInstance();
  if (!messaging) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
    const token = registration ? await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration }) : null;
    if (token) {
      await deleteToken(messaging);
      await removePushSubscription({ data: { userId, fcmToken: token } });
    }
  } catch (err) {
    console.error("Push unsubscribe error:", err);
  }
}

// Current browser permission state, for rendering the right toggle UI
// without prompting — "default" means not yet asked.
export function getPushPermissionState(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}
