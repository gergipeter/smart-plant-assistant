import { createServerFn } from "@tanstack/react-start";
import type { ApiResult } from "./plantnet.server";

export type AIDoctorAdvice = {
  diagnosis: string;
  treatment: string[];
  urgency: "low" | "medium" | "high";
  preventionTips: string[];
};

export const getAIDoctorAdvice = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid data");
    const d = data as Record<string, unknown>;
    return {
      plantName: typeof d.plantName === "string" ? d.plantName : "",
      issue: typeof d.issue === "string" ? d.issue : "",
      recentHistory: typeof d.recentHistory === "string" ? d.recentHistory : undefined,
      photoContext: typeof d.photoContext === "string" ? d.photoContext : undefined,
    };
  })
  .handler(async ({ data }): Promise<ApiResult<AIDoctorAdvice>> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { status: "error", message: "AI Doctor service not configured." };
    }

    const historyContext = data.recentHistory ? `\nRecent history: ${data.recentHistory}` : "";
    const photoCtx = data.photoContext ? `\nPhoto analysis: ${data.photoContext}` : "";

    const prompt = `You are an expert plant care doctor specializing in diagnosing and treating plant health issues.

A user has a ${data.plantName} with the following issue: "${data.issue}"${historyContext}${photoCtx}

Respond ONLY with valid JSON (no markdown, no extra text) matching this exact structure:
{
  "diagnosis": "One-sentence diagnosis of the plant's condition",
  "treatment": ["Action 1", "Action 2", "Action 3"],
  "urgency": "low|medium|high",
  "preventionTips": ["Prevention tip 1", "Prevention tip 2"]
}`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 500,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        return { status: "error", message: "AI Doctor request failed." };
      }

      const body = (await response.json()) as {
        content?: { type?: string; text?: string }[];
      };

      const text = body.content?.[0]?.text ?? "";
      const advice = JSON.parse(text) as AIDoctorAdvice;

      if (!advice.diagnosis || !Array.isArray(advice.treatment) || !advice.urgency) {
        return { status: "error", message: "Invalid response from AI Doctor." };
      }

      return { status: "ok", data: advice };
    } catch (error) {
      console.error("AI Doctor error:", error);
      return { status: "error", message: "Could not reach AI Doctor service." };
    }
  });
