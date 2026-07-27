// Social features: posts (photo + caption about a garden plant), follows,
// and likes. Fully Supabase-backed — posts/follows/likes require a signed-in
// user to write, but reads are public (feed + follower counts are visible
// to signed-out visitors too, matching the "posts are viewable by everyone"
// RLS policy in supabase/schema.sql).
import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export type SocialPost = {
  id: string;
  userId: string;
  plantId: string;
  plantName: string;
  caption: string;
  photoUrl?: string;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
  // Set when shared from a HealthChecks disease-identify result — see
  // createPost's diseaseLabel/diseaseConfidence input and plant.$id.tsx's
  // "share to feed" flow. Undefined for an ordinary post.
  diseaseLabel?: string;
  diseaseConfidence?: number;
};

const POST_PHOTO_BUCKET = "post-photos";

function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function getCurrentUserId(): string | null {
  if (!supabase) return null;
  const key = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
  if (!key) return null;
  try {
    const session = JSON.parse(localStorage.getItem(key) || "null");
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

type PostRow = {
  id: string;
  user_id: string;
  plant_id: string;
  plant_name: string;
  caption: string;
  photo_path: string | null;
  disease_label: string | null;
  disease_confidence: number | null;
  created_at: string;
};

function photoUrlFor(path: string | null): string | undefined {
  if (!path || !supabase) return undefined;
  return supabase.storage.from(POST_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function attachLikeInfo(posts: PostRow[]): Promise<SocialPost[]> {
  if (!supabase || posts.length === 0) return [];

  const postIds = posts.map((p) => p.id);
  const { data: likes } = await supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds);

  const currentUserId = getCurrentUserId();
  const likeCounts = new Map<string, number>();
  const likedByMeSet = new Set<string>();
  for (const like of likes ?? []) {
    likeCounts.set(like.post_id, (likeCounts.get(like.post_id) ?? 0) + 1);
    if (currentUserId && like.user_id === currentUserId) likedByMeSet.add(like.post_id);
  }

  return posts.map((row) => ({
    id: row.id,
    userId: row.user_id,
    plantId: row.plant_id,
    plantName: row.plant_name,
    caption: row.caption,
    photoUrl: photoUrlFor(row.photo_path),
    likeCount: likeCounts.get(row.id) ?? 0,
    likedByMe: likedByMeSet.has(row.id),
    createdAt: row.created_at,
    diseaseLabel: row.disease_label ?? undefined,
    diseaseConfidence: row.disease_confidence ?? undefined,
  }));
}

// Public feed — most recent posts from all users. Used by the discovery
// feed; works signed-out too (RLS allows anyone to read posts).
export function useFeedPosts(): { posts: SocialPost[]; loading: boolean; reload: () => void } {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(async ({ data }) => {
        setPosts(await attachLikeInfo((data as PostRow[]) ?? []));
        setLoading(false);
      });
  }, [tick]);

  return { posts, loading, reload: () => setTick((t) => t + 1) };
}

// One user's posts, for their profile page.
export function useUserPosts(userId: string | undefined): { posts: SocialPost[]; loading: boolean; reload: () => void } {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("posts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        setPosts(await attachLikeInfo((data as PostRow[]) ?? []));
        setLoading(false);
      });
  }, [userId, tick]);

  return { posts, loading, reload: () => setTick((t) => t + 1) };
}

export async function createPost(input: {
  userId: string;
  plantId: string;
  plantName: string;
  caption: string;
  photo?: Blob;
  diseaseLabel?: string;
  diseaseConfidence?: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const client = requireSupabase();

  let photoPath: string | null = null;
  if (input.photo) {
    photoPath = `${input.userId}/${Date.now()}`;
    const { error: uploadError } = await client.storage
      .from(POST_PHOTO_BUCKET)
      .upload(photoPath, input.photo, { contentType: input.photo.type || "image/jpeg" });
    if (uploadError) return { ok: false, message: "Could not upload photo." };
  }

  const { error } = await client.from("posts").insert({
    user_id: input.userId,
    plant_id: input.plantId,
    plant_name: input.plantName,
    caption: input.caption,
    photo_path: photoPath,
    disease_label: input.diseaseLabel ?? null,
    disease_confidence: input.diseaseConfidence ?? null,
  });

  if (error) return { ok: false, message: "Could not create post." };
  return { ok: true };
}

export async function deletePost(postId: string): Promise<void> {
  const client = requireSupabase();
  await client.from("posts").delete().eq("id", postId);
}

export async function toggleLike(postId: string, userId: string, currentlyLiked: boolean): Promise<void> {
  const client = requireSupabase();
  if (currentlyLiked) {
    await client.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
  } else {
    await client.from("post_likes").insert({ post_id: postId, user_id: userId });
  }
}

// ---- Follows ----

export async function followUser(followerId: string, followingId: string): Promise<void> {
  const client = requireSupabase();
  await client.from("follows").insert({ follower_id: followerId, following_id: followingId });
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const client = requireSupabase();
  await client.from("follows").delete().eq("follower_id", followerId).eq("following_id", followingId);
}

export function useFollowCounts(userId: string | undefined): {
  followerCount: number;
  followingCount: number;
  reload: () => void;
} {
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured || !supabase) return;
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", userId)
      .then(({ count }) => setFollowerCount(count ?? 0));
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", userId)
      .then(({ count }) => setFollowingCount(count ?? 0));
  }, [userId, tick]);

  return { followerCount, followingCount, reload: () => setTick((t) => t + 1) };
}

export function useIsFollowing(followerId: string | undefined, followingId: string | undefined): {
  isFollowing: boolean;
  loading: boolean;
} {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!followerId || !followingId || !supabase) {
      setLoading(false);
      return;
    }
    supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", followerId)
      .eq("following_id", followingId)
      .maybeSingle()
      .then(({ data }) => {
        setIsFollowing(!!data);
        setLoading(false);
      });
  }, [followerId, followingId]);

  return { isFollowing, loading };
}

// List of user ids this user follows — used to show a "who you follow" list.
export function useFollowingList(userId: string | undefined): { userIds: string[]; loading: boolean } {
  const [userIds, setUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !supabase) {
      setLoading(false);
      return;
    }
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId)
      .then(({ data }) => {
        setUserIds((data ?? []).map((row) => row.following_id));
        setLoading(false);
      });
  }, [userId]);

  return { userIds, loading };
}

// ---- Public profile lookups (for the feed and "who you follow" list) ----

export type PublicProfile = {
  id: string;
  username: string | null;
  avatarUrl: string | null;
};

export function useProfiles(userIds: string[]): { profiles: Map<string, PublicProfile>; loading: boolean } {
  const [profiles, setProfiles] = useState<Map<string, PublicProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const key = userIds.join(",");

  useEffect(() => {
    if (userIds.length === 0 || !supabase) {
      setLoading(false);
      return;
    }
    supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", userIds)
      .then(({ data }) => {
        const map = new Map<string, PublicProfile>();
        for (const row of data ?? []) {
          map.set(row.id, { id: row.id, username: row.username, avatarUrl: row.avatar_url });
        }
        setProfiles(map);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { profiles, loading };
}
