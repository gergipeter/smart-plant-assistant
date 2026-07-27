import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Sparkles, Send, Loader2, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { useGardenPlants } from "@/lib/myGarden";
import { findKnowledgeAnswer } from "@/lib/plantKnowledge";
import { enrichPlantData } from "@/lib/trefle.server";
import { saveExpertQuestion, useExpertQuestions, countQuestionsThisMonth } from "@/lib/expertQuestions";
import { useAuth } from "@/lib/auth";
import { getSubscriptionAsync, TIER_FEATURES, formatTierName } from "@/lib/premium";

export const Route = createFileRoute("/ask-expert")({
  head: () => ({
    meta: [
      { title: "Ask an Expert — Verdant" },
      { name: "description", content: "Get instant plant-care answers, day or night." },
    ],
  }),
  component: AskExpertPage,
});

// Branding only — names/avatars for personality. No ratings, review counts,
// or "responds in X" claims: answers come from the automated knowledge base
// below, not from these characters, so nothing here implies a real person
// reviewed your question.
const PERSONAS = [
  { name: "Dr. Plant Science", avatar: "🌳", expertise: ["Tropical", "Propagation", "Diseases"] },
  { name: "Succulent Sam", avatar: "🌵", expertise: ["Succulents", "Cacti"] },
  { name: "Urban Green", avatar: "🏢", expertise: ["Indoor Plants", "Small Spaces"] },
];

async function answerQuestion(question: string, plantName?: string): Promise<string> {
  const knowledgeAnswer = findKnowledgeAnswer(question);
  if (knowledgeAnswer) {
    return plantName ? `For your ${plantName}: ${knowledgeAnswer}` : knowledgeAnswer;
  }

  if (plantName) {
    const enrichRes = await enrichPlantData({ data: { commonName: plantName } });
    if (enrichRes.status === "ok") {
      const e = enrichRes.data;
      const parts: string[] = [];
      if (e.waterNeeds) parts.push(`Water needs: ${e.waterNeeds}`);
      if (e.hardyTemperature) parts.push(`Hardy temperature: ${e.hardyTemperature}`);
      if (e.matureHeight) parts.push(`Mature height: ${e.matureHeight}`);
      if (e.careLevel) parts.push(`Care level: ${e.careLevel}`);
      if (parts.length) {
        return `Here's what I found for ${plantName}:\n${parts.join("\n")}`;
      }
    }
  }

  return "I don't have a specific answer for that yet — try rephrasing, or ask about watering, light, toxicity, soil, pests, propagation, humidity, or repotting.";
}

function AskExpertPage() {
  const [tab, setTab] = useState<"browse" | "ask">("ask");
  const [question, setQuestion] = useState("");
  const [selectedPlant, setSelectedPlant] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);
  const gardenPlants = useGardenPlants();
  const { questions, reload } = useExpertQuestions();
  const { user } = useAuth();
  const [access, setAccess] = useState<{ tier: string; limit: number; used: number } | null>(null);

  useEffect(() => {
    if (!user) {
      setAccess({ tier: "free", limit: 0, used: 0 });
      return;
    }
    Promise.all([getSubscriptionAsync(user.uid), countQuestionsThisMonth(user.uid)]).then(
      ([sub, used]) => {
        setAccess({ tier: sub.tier, limit: TIER_FEATURES[sub.tier].expertQuestionsPerMonth, used });
      },
    );
  }, [user, questions.length]);

  const handleAsk = async () => {
    if (!question.trim() || busy) return;
    if (!access || access.used >= access.limit) {
      setLimitError(
        access?.limit === 0
          ? "Ask an Expert is a Plus/Pro feature. Upgrade to start asking."
          : "You've used all your questions for this month. Upgrade to Pro for unlimited access.",
      );
      return;
    }

    setBusy(true);
    setLastAnswer(null);
    setLimitError(null);
    try {
      const plantName = gardenPlants.find((p) => p.id === selectedPlant)?.name;
      const answer = await answerQuestion(question, plantName);
      await saveExpertQuestion({ plantName, question, answer });
      setLastAnswer(answer);
      setQuestion("");
      reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl mb-2">Ask an Expert</h1>
        <p className="text-sm text-muted-foreground">
          Instant plant-care answers — automated, no waiting.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-muted rounded-full p-1 mb-6">
        {(["ask", "browse"] as const).map((tabId) => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={`ios-tap flex-1 py-2 px-3 rounded-full text-sm font-medium transition-colors ${
              tab === tabId ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {tabId === "ask" ? "Ask a Question" : "Your Questions"}
          </button>
        ))}
      </div>

      {/* TAB: Ask */}
      {tab === "ask" && (
        <section className="space-y-4 mb-8">
          {access && access.limit === 0 && (
            <Link to="/premium" className="ios-tap leaf-card p-4 flex items-center gap-3 block">
              <div className="h-9 w-9 rounded-full bg-secondary grid place-items-center shrink-0">
                <Lock className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Ask an Expert is a Plus/Pro feature</p>
                <p className="text-xs text-muted-foreground">Upgrade to start asking questions</p>
              </div>
            </Link>
          )}

          {access && access.limit > 0 && Number.isFinite(access.limit) && (
            <p className="text-xs text-muted-foreground px-1">
              {access.used}/{access.limit} questions used this month ({formatTierName(access.tier as "plus" | "pro")})
            </p>
          )}

          <div className="leaf-card p-4 space-y-4">
            <div>
              <label className="text-sm font-medium block mb-2">Which plant? (optional)</label>
              <select
                value={selectedPlant}
                onChange={(e) => setSelectedPlant(e.target.value)}
                className="ios-tap w-full p-3 rounded-lg border border-border bg-background text-foreground text-sm"
              >
                <option value="">Not sure / general question</option>
                {gardenPlants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Your Question</label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. 'How often should I water succulents?' or 'Is this toxic to cats?'"
                className="ios-tap w-full p-3 rounded-lg border border-border bg-background text-foreground text-sm min-h-[100px] resize-none"
              />
            </div>

            {limitError && <p className="text-sm text-destructive">{limitError}</p>}

            <button
              onClick={handleAsk}
              disabled={busy || !question.trim() || !access || access.used >= access.limit}
              className="ios-tap w-full h-12 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <Send className="h-4 w-4" strokeWidth={1.75} />
              )}
              {busy ? "Thinking…" : "Ask"}
            </button>
          </div>

          {lastAnswer && (
            <div className="leaf-card p-4 border border-primary/30">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" strokeWidth={1.75} />
                <h3 className="font-medium text-sm">Answer</h3>
              </div>
              <p className="text-sm whitespace-pre-line leading-relaxed">{lastAnswer}</p>
            </div>
          )}

          {/* Info */}
          <div className="leaf-card p-4 bg-secondary/30">
            <h3 className="font-medium text-sm mb-2">Get the Best Answers</h3>
            <ul className="text-xs space-y-1 text-muted-foreground">
              <li>• Ask about one topic at a time — watering, light, soil, pests, etc.</li>
              <li>• Naming a plant gives a more specific answer</li>
              <li>• Answers are generated instantly and automatically, not by a human</li>
            </ul>
          </div>
        </section>
      )}

      {/* TAB: Your Questions */}
      {tab === "browse" && (
        <section className="space-y-4 mb-8">
          <div>
            <h2 className="text-lg font-display mb-3 px-1">Meet the Personas</h2>
            <p className="text-xs text-muted-foreground px-1 mb-3">
              Answers come from an automated plant-care knowledge base, styled with these personas — not real people.
            </p>
            <div className="space-y-3">
              {PERSONAS.map((p) => (
                <div key={p.name} className="leaf-card p-4 flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-secondary grid place-items-center text-2xl shrink-0">
                    {p.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{p.name}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {p.expertise.map((skill) => (
                        <span
                          key={skill}
                          className="text-xs bg-secondary/50 px-2 py-1 rounded-full text-muted-foreground"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-display mb-3 px-1">Your Questions</h2>
            {questions.length === 0 ? (
              <div className="leaf-card p-4 text-sm text-muted-foreground text-center">
                Nothing yet — ask your first question to see it here.
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((q) => (
                  <div key={q.id} className="leaf-card p-4">
                    <div className="flex items-center gap-2 mb-1">
                      {q.plantName && (
                        <span className="text-xs bg-secondary/50 px-1.5 py-0.5 rounded">{q.plantName}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(q.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-medium text-sm mb-1">{q.question}</h3>
                    <p className="text-xs text-muted-foreground whitespace-pre-line">{q.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </AppShell>
  );
}
