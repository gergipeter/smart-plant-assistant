// "Ask an Expert" question history. Answers are generated instantly by the
// free knowledge base (plantKnowledge.ts) + Trefle species lookup — not by
// real human experts. Persists to Supabase when signed in, falls back to
// localStorage otherwise, same pattern as myGarden.ts / premium.ts.
import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export type ExpertQuestion = {
  id: string;
  plantName?: string;
  question: string;
  answer: string;
  createdAt: string;
};

const STORAGE_KEY = "verdant.expert-questions.v1";

function loadLocal(): ExpertQuestion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ExpertQuestion[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocal(entries: ExpertQuestion[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

type QuestionRow = {
  id: string;
  plant_name: string | null;
  question: string;
  answer: string;
  created_at: string;
};

function fromRow(row: QuestionRow): ExpertQuestion {
  return {
    id: row.id,
    plantName: row.plant_name ?? undefined,
    question: row.question,
    answer: row.answer,
    createdAt: row.created_at,
  };
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

export function useExpertQuestions(): { questions: ExpertQuestion[]; reload: () => void } {
  const [questions, setQuestions] = useState<ExpertQuestion[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const userId = isSupabaseConfigured ? getCurrentUserId() : null;

    if (userId && supabase) {
      supabase
        .from("expert_questions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          setQuestions(data ? (data as QuestionRow[]).map(fromRow) : []);
        });
    } else {
      setQuestions(
        loadLocal().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      );
    }
  }, [tick]);

  return { questions, reload: () => setTick((t) => t + 1) };
}

function startOfMonthISO(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

// Questions asked since the start of the current calendar month — used to
// enforce Plus's 5/month cap (see canAskExpert in premium.ts's tier table).
export async function countQuestionsThisMonth(userId: string | undefined): Promise<number> {
  const monthStart = startOfMonthISO();

  if (userId && isSupabaseConfigured && supabase) {
    const { count } = await supabase
      .from("expert_questions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", monthStart);
    return count ?? 0;
  }

  return loadLocal().filter((q) => q.createdAt >= monthStart).length;
}

export async function saveExpertQuestion(entry: {
  plantName?: string;
  question: string;
  answer: string;
}): Promise<void> {
  const userId = isSupabaseConfigured ? getCurrentUserId() : null;

  if (userId && supabase) {
    const { error } = await supabase.from("expert_questions").insert({
      user_id: userId,
      plant_name: entry.plantName ?? null,
      question: entry.question,
      answer: entry.answer,
    });
    if (error) console.error("Failed to save question to Supabase:", error);
    return;
  }

  const local = loadLocal();
  local.push({
    id: `local-${Date.now()}`,
    plantName: entry.plantName,
    question: entry.question,
    answer: entry.answer,
    createdAt: new Date().toISOString(),
  });
  saveLocal(local);
}
