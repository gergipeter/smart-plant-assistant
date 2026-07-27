import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Heart, UserPlus, UserCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  followUser,
  toggleLike,
  unfollowUser,
  useFeedPosts,
  useFollowingList,
  useProfiles,
} from "@/lib/socialFeatures";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Feed — Verdant" },
      { name: "description", content: "See what other plant parents are growing." },
    ],
  }),
  component: FeedPage,
});

function FeedPage() {
  const { user } = useAuth();
  const { posts, loading, reload } = useFeedPosts();
  const authorIds = [...new Set(posts.map((p) => p.userId))];
  const { profiles } = useProfiles(authorIds);
  const { userIds: followingIds } = useFollowingList(user?.uid);
  const followingSet = new Set(followingIds);

  const handleToggleLike = async (postId: string, likedByMe: boolean) => {
    if (!user) return;
    await toggleLike(postId, user.uid, likedByMe);
    reload();
  };

  const handleToggleFollow = async (authorId: string) => {
    if (!user) return;
    if (followingSet.has(authorId)) {
      await unfollowUser(user.uid, authorId);
    } else {
      await followUser(user.uid, authorId);
    }
    reload();
  };

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-3xl mb-2">Feed</h1>
        <p className="text-sm text-muted-foreground">See what other plant parents are growing</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-12">Loading…</p>
      ) : posts.length === 0 ? (
        <div className="leaf-card p-4 text-sm text-muted-foreground text-center">
          No posts yet — be the first to share from your profile.
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const profile = profiles.get(post.userId);
            const isOwnPost = user?.uid === post.userId;
            const isFollowing = followingSet.has(post.userId);
            return (
              <div key={post.id} className="leaf-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-full bg-primary/20 text-primary text-sm grid place-items-center overflow-hidden shrink-0">
                    {profile?.avatarUrl ? (
                      <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (profile?.username || "?").charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{profile?.username || "Plant Parent"}</p>
                    <p className="text-xs text-muted-foreground">{post.plantName}</p>
                  </div>
                  {user && !isOwnPost && (
                    <button
                      onClick={() => handleToggleFollow(post.userId)}
                      className="ios-tap shrink-0 text-xs font-medium text-primary flex items-center gap-1"
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Follow
                        </>
                      )}
                    </button>
                  )}
                </div>
                {post.photoUrl && (
                  <img src={post.photoUrl} alt="" className="w-full h-48 object-cover rounded-lg mb-3" />
                )}
                <p className="text-sm mb-3">{post.caption}</p>
                <button
                  onClick={() => handleToggleLike(post.id, post.likedByMe)}
                  disabled={!user}
                  className="ios-tap flex items-center gap-1 text-xs text-muted-foreground disabled:opacity-50"
                >
                  <Heart
                    className={`h-4 w-4 ${post.likedByMe ? "fill-red-500 text-red-500" : ""}`}
                    strokeWidth={1.75}
                  />
                  {post.likeCount}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
