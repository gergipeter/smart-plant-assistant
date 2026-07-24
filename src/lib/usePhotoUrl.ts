import { useEffect, useState } from "react";
import { getPhoto } from "@/lib/photoStore";

// Resolves a timeline entry's stored photo (if any) to a blob: URL for <img>
// use, revoking it on unmount/entryId change to avoid leaking object URLs.
export function usePhotoUrl(entryId: string | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!entryId) {
      setUrl(undefined);
      return;
    }
    let cancelled = false;
    let objectUrl: string | undefined;

    getPhoto(entryId).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [entryId]);

  return url;
}
