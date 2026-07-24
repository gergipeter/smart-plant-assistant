import { useState } from "react";
import { Sparkles, Send, Loader } from "lucide-react";
import { askAIDoctor, type AIDoctorResponse } from "@/lib/ai-doctor.server";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function AIDoctorChat({
  plantName,
  onClose,
}: {
  plantName: string;
  onClose: () => void;
}) {
  const [issue, setIssue] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async () => {
    if (!issue.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const result = (await askAIDoctor({
        plantName,
        issue,
      })) as AIDoctorResponse;

      if (result.status === "ok") {
        setResponse(result.advice);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError("Failed to get advice. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="leaf-card p-4 border border-primary/30">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Ask the AI Plant Doctor</h3>
      </div>

      {!response ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Describe what's going on with your {plantName}
          </p>
          <Textarea
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            placeholder="e.g., 'Leaves are turning yellow and drooping'"
            className="min-h-24 resize-none"
            disabled={loading}
          />
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
          <div className="flex gap-2">
            <Button
              onClick={handleAsk}
              disabled={loading || !issue.trim()}
              className="flex-1"
              size="sm"
            >
              {loading ? (
                <Loader className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Send className="h-3.5 w-3.5 mr-1" />
                  Get Advice
                </>
              )}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
            >
              Close
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-primary/10 p-3 rounded-lg">
            <p className="text-sm leading-relaxed">{response}</p>
          </div>
          <button
            onClick={() => {
              setResponse(null);
              setIssue("");
            }}
            className="text-xs text-primary hover:underline"
          >
            Ask another question
          </button>
        </div>
      )}
    </div>
  );
}
