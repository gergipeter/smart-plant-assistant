import { useEffect, useState } from "react";
import { MapPin, Phone, Globe, Star } from "lucide-react";
import {
  findNearbyNurseries,
  type Nursery,
} from "@/lib/nurseries.server";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function NurseriesFinder({
  lat,
  lon,
  isOpen,
  onClose,
}: {
  lat?: number;
  lon?: number;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [nurseries, setNurseries] = useState<Nursery[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadNurseries = async () => {
      setLoading(true);
      try {
        const result = await findNearbyNurseries({ lat, lon });
        if (result.status === "ok") {
          setNurseries(result.data);
        }
      } catch (err) {
        console.error("Failed to load nurseries");
      } finally {
        setLoading(false);
      }
    };

    loadNurseries();
  }, [isOpen, lat, lon]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nearby Plant Nurseries</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 rounded-full border-2 border-current border-t-transparent animate-spin" />
          </div>
        ) : nurseries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No nurseries found in your area.
          </p>
        ) : (
          <div className="space-y-3">
            {nurseries.map((nursery, i) => (
              <div key={i} className="border rounded-lg p-3">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-sm">{nursery.name}</h4>
                  {nursery.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                      <span className="text-xs font-medium">{nursery.rating}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{nursery.address}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {nursery.distance.toFixed(1)} km away
                  </div>
                  {nursery.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{nursery.phone}</span>
                    </div>
                  )}
                  {nursery.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-primary" />
                      <a
                        href={nursery.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Visit website
                      </a>
                    </div>
                  )}
                  {nursery.specialties.length > 0 && (
                    <div className="text-muted-foreground">
                      Specializes in: {nursery.specialties.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
