import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { ApiResult } from "./plantnet.server";

export type NotificationPreferences = {
  wateringReminders: boolean;
  dailyDigestTime: string;
};

function getSupabaseServerClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  wateringReminders: true,
  dailyDigestTime: "08:00",
};

export const getNotificationPreferences = createServerFn({ method: "GET" })
  .validator((data: { userId?: string }) => data)
  .handler(async ({ data }): Promise<ApiResult<NotificationPreferences>> => {
    if (!data.userId) return { status: "ok", data: DEFAULT_PREFERENCES };

    const client = getSupabaseServerClient();
    if (!client) return { status: "ok", data: DEFAULT_PREFERENCES };

    const { data: row } = await client
      .from("notification_preferences")
      .select("watering_reminders, daily_digest_time")
      .eq("user_id", data.userId)
      .maybeSingle();

    if (!row) return { status: "ok", data: DEFAULT_PREFERENCES };

    return {
      status: "ok",
      data: {
        wateringReminders: row.watering_reminders,
        dailyDigestTime: row.daily_digest_time,
      },
    };
  });

export const updateNotificationPreferences = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid data");
    const d = data as Record<string, unknown>;
    if (typeof d.userId !== "string" || !d.userId) throw new Error("Missing userId");
    return {
      userId: d.userId,
      wateringReminders: typeof d.wateringReminders === "boolean" ? d.wateringReminders : undefined,
      dailyDigestTime: typeof d.dailyDigestTime === "string" ? d.dailyDigestTime : undefined,
    };
  })
  .handler(async ({ data }): Promise<ApiResult<NotificationPreferences>> => {
    const client = getSupabaseServerClient();
    if (!client) return { status: "error", message: "Notification preferences are not configured." };

    const { error } = await client.from("notification_preferences").upsert({
      user_id: data.userId,
      ...(data.wateringReminders !== undefined && { watering_reminders: data.wateringReminders }),
      ...(data.dailyDigestTime !== undefined && { daily_digest_time: data.dailyDigestTime }),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Preferences update error:", error);
      return { status: "error", message: "Could not update preferences." };
    }

    const { data: row } = await client
      .from("notification_preferences")
      .select("watering_reminders, daily_digest_time")
      .eq("user_id", data.userId)
      .maybeSingle();

    return {
      status: "ok",
      data: {
        wateringReminders: row?.watering_reminders ?? DEFAULT_PREFERENCES.wateringReminders,
        dailyDigestTime: row?.daily_digest_time ?? DEFAULT_PREFERENCES.dailyDigestTime,
      },
    };
  });
