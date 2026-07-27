import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Heart, Settings, ArrowRight, Camera, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useGardenPlants } from "@/lib/myGarden";
import {
  createPost,
  toggleLike,
  useFollowCounts,
  useFollowingList,
  useProfiles,
  useUserPosts,
} from "@/lib/socialFeatures";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Verdant" },
      { name: "description", content: "Your plant parent profile and community presence." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const [tab, setTab] = useState<"overview" | "posts" | "following">("overview");
  const { user: authUser, loading } = useAuth();
  const navigate = useNavigate();
  const gardenPlants = useGardenPlants();
  const { followerCount, followingCount } = useFollowCounts(authUser?.uid);
  const { posts, loading: postsLoading, reload: reloadPosts } = useUserPosts(authUser?.uid);
  const { userIds: followingIds, loading: followingLoading } = useFollowingList(authUser?.uid);
  const { profiles: followingProfiles } = useProfiles(followingIds);

  const [showComposer, setShowComposer] = useState(false);
  const [selectedPlantId, setSelectedPlantId] = useState("");
  const [caption, setCaption] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !authUser) {
      navigate({ to: "/login" });
    }
  }, [loading, authUser, navigate]);

  if (loading || !authUser) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground text-center py-12">Loading…</p>
      </AppShell>
    );
  }

  const initial = (authUser.displayName || authUser.email || "?").charAt(0).toUpperCase();
  const user = {
    username: authUser.displayName || authUser.email?.split("@")[0] || "Plant Parent",
    email: authUser.email || "",
    bio: "🌿 Plant enthusiast growing their garden with Verdant.",
    avatar: authUser.photoURL,
  };

  const handlePhotoPicked = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const clearPhoto = () => {
    setPhoto(null);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmitPost = async () => {
    const plant = gardenPlants.find((p) => p.id === selectedPlantId);
    if (!plant || !caption.trim()) return;

    setPosting(true);
    setPostError(null);
    try {
      const result = await createPost({
        userId: authUser.uid,
        plantId: plant.id,
        plantName: plant.name,
        caption: caption.trim(),
        photo: photo ?? undefined,
      });
      if (result.ok) {
        setShowComposer(false);
        setSelectedPlantId("");
        setCaption("");
        clearPhoto();
        reloadPosts();
      } else {
        setPostError(result.message);
      }
    } finally {
      setPosting(false);
    }
  };

  const handleToggleLike = async (postId: string, likedByMe: boolean) => {
    await toggleLike(postId, authUser.uid, likedByMe);
    reloadPosts();
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground text-3xl grid place-items-center mb-3 overflow-hidden">
              {user.avatar ? (
                <img src={user.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <h1 className="font-display text-2xl">{user.username}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <Link
            to="/settings"
            className="ios-tap h-10 w-10 rounded-full bg-secondary grid place-items-center"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" strokeWidth={1.75} />
          </Link>
        </div>

        {/* Bio */}
        <p className="text-sm mb-4">{user.bio}</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="leaf-card p-3 text-center">
            <p className="text-2xl font-bold text-primary">{gardenPlants.length}</p>
            <p className="text-xs text-muted-foreground">Plants</p>
          </div>
          <div className="leaf-card p-3 text-center">
            <p className="text-2xl font-bold text-primary">{followerCount}</p>
            <p className="text-xs text-muted-foreground">Followers</p>
          </div>
          <div className="leaf-card p-3 text-center">
            <p className="text-2xl font-bold text-primary">{followingCount}</p>
            <p className="text-xs text-muted-foreground">Following</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-muted rounded-full p-1 mb-6">
        {(["overview", "posts", "following"] as const).map((tabId) => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={`ios-tap flex-1 py-2 px-3 rounded-full text-sm font-medium transition-colors ${
              tab === tabId ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {tabId === "overview" ? "Overview" : tabId === "posts" ? "Posts" : "Following"}
          </button>
        ))}
      </div>

      {/* TAB: Overview */}
      {tab === "overview" && (
        <section className="space-y-4 mb-8">
          <h2 className="text-lg font-display px-1">Your Garden</h2>
          {gardenPlants.length === 0 ? (
            <div className="leaf-card p-4 text-sm text-muted-foreground text-center">
              No plants yet — scan or add one to get started.
            </div>
          ) : (
            gardenPlants.slice(0, 5).map((plant) => (
              <Link
                key={plant.id}
                to="/plant/$id"
                params={{ id: plant.id }}
                className="ios-tap leaf-card p-4 flex items-center gap-3"
              >
                <div className="h-9 w-9 rounded-full bg-secondary grid place-items-center shrink-0 text-lg">
                  {plant.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{plant.name}</p>
                  <p className="text-xs text-muted-foreground">{plant.nextTask}</p>
                </div>
              </Link>
            ))
          )}
        </section>
      )}

      {/* TAB: Posts */}
      {tab === "posts" && (
        <section className="space-y-4 mb-8">
          {!showComposer ? (
            <button
              onClick={() => setShowComposer(true)}
              disabled={gardenPlants.length === 0}
              className="ios-tap w-full h-11 rounded-full border-2 border-dashed border-border text-sm font-medium text-muted-foreground disabled:opacity-50"
            >
              {gardenPlants.length === 0 ? "Add a plant first to share a post" : "+ Share a post about your plant"}
            </button>
          ) : (
            <div className="leaf-card p-4 space-y-3">
              <select
                value={selectedPlantId}
                onChange={(e) => setSelectedPlantId(e.target.value)}
                className="ios-tap w-full p-3 rounded-lg border border-border bg-background text-foreground text-sm"
              >
                <option value="">Choose a plant…</option>
                {gardenPlants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="What's new with this plant?"
                className="ios-tap w-full p-3 rounded-lg border border-border bg-background text-foreground text-sm min-h-[80px] resize-none"
              />

              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoPicked} />
              {photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt="" className="w-full h-40 object-cover rounded-lg" />
                  <button
                    onClick={clearPhoto}
                    className="ios-tap absolute top-2 right-2 h-7 w-7 rounded-full bg-background/80 grid place-items-center"
                    aria-label="Remove photo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="ios-tap w-full border-2 border-dashed border-border rounded-lg p-4 text-center hover:bg-secondary/50 transition-colors flex items-center justify-center gap-2 text-sm text-muted-foreground"
                >
                  <Camera className="h-4 w-4" strokeWidth={1.75} />
                  Add a photo (optional)
                </button>
              )}

              {postError && <p className="text-sm text-destructive">{postError}</p>}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowComposer(false);
                    setPostError(null);
                  }}
                  className="ios-tap flex-1 h-11 rounded-full border border-border text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitPost}
                  disabled={posting || !selectedPlantId || !caption.trim()}
                  className="ios-tap flex-1 h-11 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                >
                  {posting ? "Posting…" : "Post"}
                </button>
              </div>
            </div>
          )}

          {postsLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
          ) : posts.length === 0 ? (
            <div className="leaf-card p-4 text-sm text-muted-foreground text-center">
              No posts yet.
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="leaf-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-full bg-primary/20 text-primary text-sm grid place-items-center overflow-hidden">
                    {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : initial}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{post.plantName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {post.photoUrl && (
                  <img src={post.photoUrl} alt="" className="w-full h-40 object-cover rounded-lg mb-3" />
                )}
                <p className="text-sm mb-3">{post.caption}</p>
                <button
                  onClick={() => handleToggleLike(post.id, post.likedByMe)}
                  className="ios-tap flex items-center gap-1 text-xs text-muted-foreground"
                >
                  <Heart
                    className={`h-4 w-4 ${post.likedByMe ? "fill-red-500 text-red-500" : ""}`}
                    strokeWidth={1.75}
                  />
                  {post.likeCount}
                </button>
              </div>
            ))
          )}
        </section>
      )}

      {/* TAB: Following */}
      {tab === "following" && (
        <section className="space-y-3 mb-8">
          {followingLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
          ) : followingIds.length === 0 ? (
            <div className="leaf-card p-4 text-sm text-muted-foreground text-center">
              Not following anyone yet — check the{" "}
              <Link to="/feed" className="text-primary hover:underline">
                feed
              </Link>{" "}
              to find people to follow.
            </div>
          ) : (
            followingIds.map((id) => {
              const profile = followingProfiles.get(id);
              return (
                <div key={id} className="leaf-card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-secondary grid place-items-center shrink-0 overflow-hidden">
                      {profile?.avatarUrl ? (
                        <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        "🌿"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{profile?.username || "Plant Parent"}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
                </div>
              );
            })
          )}
        </section>
      )}
    </AppShell>
  );
}
