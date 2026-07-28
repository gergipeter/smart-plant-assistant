import { useEffect, useState } from "react";
import { ExternalLink, Images } from "lucide-react";
import { getSpeciesGallery, type SpeciesGalleryPhoto } from "@/lib/speciesGallery.server";
import { useT } from "@/lib/i18n";

// Real photos other people have taken of this species, sourced from
// Wikimedia Commons (see speciesGallery.server.ts) rather than a single
// curated reference image — lets a user compare their own plant against
// how the species actually looks "in the wild" across many growers/angles.
export function CommunityPhotos({ scientificName }: { scientificName: string }) {
  const t = useT();
  const [photos, setPhotos] = useState<SpeciesGalleryPhoto[] | null>(null);
  const [viewerPhoto, setViewerPhoto] = useState<SpeciesGalleryPhoto | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPhotos(null);

    getSpeciesGallery({ data: { scientificName } }).then((result) => {
      if (cancelled) return;
      setPhotos(result.status === "ok" ? result.photos : []);
    });

    return () => {
      cancelled = true;
    };
  }, [scientificName]);

  if (photos === null) {
    return <div className="leaf-card h-32 animate-pulse bg-secondary" />;
  }

  if (photos.length === 0) return null;

  return (
    <div className="leaf-card p-4">
      <h3 className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground mb-3">
        <Images className="h-3.5 w-3.5" strokeWidth={1.75} /> {t("plant.communityPhotos")}
      </h3>
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {photos.map((photo) => (
          <button
            key={photo.fullUrl}
            onClick={() => setViewerPhoto(photo)}
            className="ios-tap h-20 w-20 rounded-lg overflow-hidden shrink-0 bg-secondary"
          >
            <img
              src={photo.thumbUrl}
              alt={photo.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{t("plant.communityPhotosCredit")}</p>

      {viewerPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6"
          onClick={() => setViewerPhoto(null)}
        >
          <img
            src={viewerPhoto.fullUrl}
            alt={viewerPhoto.title}
            className="max-h-[75vh] max-w-full rounded-xl object-contain"
          />
          <a
            href={viewerPhoto.descriptionUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ios-tap mt-4 flex items-center gap-1.5 text-sm text-white/80"
          >
            {viewerPhoto.title} <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
          </a>
        </div>
      )}
    </div>
  );
}
