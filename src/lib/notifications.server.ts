import { createServerFn } from "@tanstack/react-start";
import type { ApiResult } from "./plantnet.server";

export type NotificationPreferences = {
  enablePushNotifications: boolean;
  enableEmailDigest: boolean;
  dailyDigestTime: string;
  wateringReminders: boolean;
  diseaseAlerts: boolean;
  weatherUpdates: boolean;
  quietHours?: { start: string; end: string };
};

export type WateringReminder = {
  plantId: string;
  plantName: string;
  daysUntilWatering: number;
  lastWatered: string;
};

export const getNotificationPreferences = createServerFn({ method: "GET" })
  .handler((): NotificationPreferences => {
    if (typeof localStorage === "undefined") {
      return {
        enablePushNotifications: false,
        enableEmailDigest: false,
        dailyDigestTime: "08:00",
        wateringReminders: true,
        diseaseAlerts: true,
        weatherUpdates: true,
      };
    }

    try {
      const prefs = localStorage.getItem("notification_prefs");
      if (prefs) {
        return JSON.parse(prefs);
      }
    } catch {
      /* fallback to defaults */
    }

    return {
      enablePushNotifications: false,
      enableEmailDigest: false,
      dailyDigestTime: "08:00",
      wateringReminders: true,
      diseaseAlerts: true,
      weatherUpdates: true,
    };
  });

export const updateNotificationPreferences = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid data");
    return data as Partial<NotificationPreferences>;
  })
  .handler(async ({ data }): Promise<ApiResult<NotificationPreferences>> => {
    try {
      if (typeof localStorage === "undefined") {
        return { status: "error", message: "Storage not available." };
      }

      const current = JSON.parse(
        localStorage.getItem("notification_prefs") || "{}"
      ) as Partial<NotificationPreferences>;
      const updated = { ...current, ...data };

      localStorage.setItem("notification_prefs", JSON.stringify(updated));

      return { status: "ok", data: updated as NotificationPreferences };
    } catch (error) {
      console.error("Preferences update error:", error);
      return { status: "error", message: "Could not update preferences." };
    }
  });

export const scheduleWateringReminders = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!Array.isArray(data)) throw new Error("Expected array of reminders");
    return data as WateringReminder[];
  })
  .handler(async ({ data }): Promise<ApiResult<{ scheduled: number }>> => {
    try {
      if (typeof localStorage === "undefined") {
        return { status: "error", message: "Storage not available." };
      }

      localStorage.setItem("watering_reminders", JSON.stringify(data));

      return { status: "ok", data: { scheduled: data.length } };
    } catch (error) {
      console.error("Schedule error:", error);
      return { status: "error", message: "Could not schedule reminders." };
    }
  });

export const getUpcomingReminders = createServerFn({ method: "GET" })
  .handler(async (): Promise<ApiResult<WateringReminder[]>> => {
    try {
      if (typeof localStorage === "undefined") {
        return { status: "ok", data: [] };
      }

      const reminders = localStorage.getItem("watering_reminders");
      if (!reminders) {
        return { status: "ok", data: [] };
      }

      const parsed = JSON.parse(reminders) as WateringReminder[];
      const upcoming = parsed.filter((r) => r.daysUntilWatering <= 3).sort((a, b) => a.daysUntilWatering - b.daysUntilWatering);

      return { status: "ok", data: upcoming };
    } catch (error) {
      console.error("Reminders fetch error:", error);
      return { status: "error", message: "Could not fetch reminders." };
    }
  });
