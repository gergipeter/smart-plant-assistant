import { useEffect, useState } from "react";
import { Leaf, Sprout, Thermometer, Zap } from "lucide-react";
import { enrichPlantData, type TrefleEnrichment } from "@/lib/trefle.server";
import { analyzePlantImage, type ImageAnalysisResult } from "@/lib/image-recognition.server";
import type { Plant } from "@/lib/plants";

export function PlantEnrichment({ plant }: { plant: Plant }) {
  const [enrichment, setEnrichment] = useState<TrefleEnrichment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadEnrichment = async () => {
      try {
        const result = await enrichPlantData({
          scientificName: plant.scientific,
          commonName: plant.name,
        });

        if (result.status === "ok") {
          setEnrichment(result.data);
        } else {
          setError(result.message);
        }
      } catch (err) {
        setError("Failed to load plant details");
      } finally {
        setLoading(false);
      }
    };

    loadEnrichment();
  }, [plant.scientific, plant.name]);

  if (loading) {
    return (
      <div className="leaf-card h-32 animate-pulse bg-secondary" />
    );
  }

  if (error || !enrichment) {
    return null;
  }

  return (
    <div className="space-y-3">
      {enrichment.matureHeight && (
        <div className="leaf-card flex items-center gap-3 p-3">
          <Leaf className="h-4 w-4 text-primary shrink-0" strokeWidth={1.75} />
          <div className="text-sm">
            <p className="font-medium">Mature Height</p>
            <p className="text-xs text-muted-foreground">{enrichment.matureHeight}</p>
          </div>
        </div>
      )}

      {enrichment.bloomMonths && enrichment.bloomMonths.length > 0 && (
        <div className="leaf-card flex items-center gap-3 p-3">
          <Sprout className="h-4 w-4 text-primary shrink-0" strokeWidth={1.75} />
          <div className="text-sm">
            <p className="font-medium">Blooming Months</p>
            <p className="text-xs text-muted-foreground">
              {enrichment.bloomMonths.join(", ")}
            </p>
          </div>
        </div>
      )}

      {enrichment.hardyTemperature && (
        <div className="leaf-card flex items-center gap-3 p-3">
          <Thermometer className="h-4 w-4 text-primary shrink-0" strokeWidth={1.75} />
          <div className="text-sm">
            <p className="font-medium">Hardy Temperature</p>
            <p className="text-xs text-muted-foreground">{enrichment.hardyTemperature}</p>
          </div>
        </div>
      )}

      {enrichment.careLevel && (
        <div className="leaf-card flex items-center gap-3 p-3">
          <Zap className="h-4 w-4 text-primary shrink-0" strokeWidth={1.75} />
          <div className="text-sm">
            <p className="font-medium">Care Level</p>
            <p className="text-xs text-muted-foreground">{enrichment.careLevel}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function ImageHealthAnalysis({ photo }: { photo: Blob | null }) {
  const [analysis, setAnalysis] = useState<ImageAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!photo) return;

    const analyze = async () => {
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append("image", photo);

        const result = await analyzePlantImage({ data: formData });

        if (result.status === "ok") {
          setAnalysis(result.data);
        } else {
          setError(result.message);
        }
      } catch (err) {
        setError("Failed to analyze image");
      } finally {
        setLoading(false);
      }
    };

    analyze();
  }, [photo]);

  if (!loading && !analysis) return null;

  if (loading) {
    return (
      <div className="leaf-card h-20 animate-pulse bg-secondary" />
    );
  }

  if (error || !analysis) return null;

  return (
    <div className="leaf-card p-4 space-y-3 border-l-4 border-primary">
      <div>
        <p className="text-sm font-medium">{analysis.healthAssessment}</p>
        <p className="text-xs text-muted-foreground mt-1">{analysis.leafCondition}</p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">Health Score</span>
        <span className={`text-sm font-semibold ${
          analysis.overallHealth >= 80 ? "text-green-600" :
          analysis.overallHealth >= 60 ? "text-yellow-600" :
          "text-red-600"
        }`}>
          {analysis.overallHealth}%
        </span>
      </div>

      {analysis.detectedIssues.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Detected Issues:</p>
          <ul className="text-xs space-y-1">
            {analysis.detectedIssues.map((issue, i) => (
              <li key={i} className="text-muted-foreground">
                {issue.name} ({Math.round(issue.confidence * 100)}%)
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.recommendations.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Recommendations:</p>
          <ul className="text-xs space-y-1">
            {analysis.recommendations.map((rec, i) => (
              <li key={i} className="text-muted-foreground">• {rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
