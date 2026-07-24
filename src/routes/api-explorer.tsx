import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getApiHealth,
  getLanguages,
  getProjects,
  getDailyQuota,
  getQuota,
  getQuotaHistory,
  getSubscription,
  getSpecies,
  getProjectSpecies,
  getVarieties,
  identifyVarieties,
  getDiseases,
  identifyDisease,
  createEmbeddings,
  type ApiResult,
  type Json,
} from "@/lib/plantnet.server";

export const Route = createFileRoute("/api-explorer")({
  head: () => ({
    meta: [
      { title: "API Explorer — Verdant" },
      { name: "description", content: "Exercise every My Pl@ntNet API endpoint directly." },
    ],
  }),
  component: ApiExplorer,
});

function resultText(result: unknown): string {
  return JSON.stringify(result, null, 2);
}

// One row: a button that calls `run`, plus a JSON viewer for whatever came
// back. Shared by every no-input GET endpoint below.
function EndpointPanel({
  method,
  path,
  description,
  run,
  children,
}: {
  method: "GET" | "POST";
  path: string;
  description: string;
  run: () => Promise<ApiResult<unknown> | { status: string }>;
  children?: ReactNode;
}) {
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);

  const handleRun = async () => {
    setLoading(true);
    setOutput(null);
    try {
      const result = await run();
      setOutput(resultText(result));
    } catch (err) {
      setOutput(resultText({ status: "error", message: String(err) }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                method === "GET"
                  ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {method}
            </span>
            <code className="text-sm font-medium">{path}</code>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        <Button size="sm" onClick={handleRun} disabled={loading}>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          Run
        </Button>
      </div>

      {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}

      {output && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed">
          {output}
        </pre>
      )}
    </div>
  );
}

// Panel variant for endpoints that need an uploaded image (disease ID,
// variety ID, embeddings) — a file input replaces the plain Run button.
function ImageEndpointPanel({
  method,
  path,
  description,
  run,
}: {
  method: "POST";
  path: string;
  description: string;
  run: (formData: FormData) => Promise<ApiResult<Json>>;
}) {
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    setOutput(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const result = await run(formData);
      setOutput(resultText(result));
    } catch (err) {
      setOutput(resultText({ status: "error", message: String(err) }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          {method}
        </span>
        <code className="text-sm font-medium">{path}</code>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
      <label className="mt-3 inline-flex">
        <Input
          type="file"
          accept="image/*"
          disabled={loading}
          className="max-w-xs"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </label>
      {loading && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
        </p>
      )}
      {output && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed">
          {output}
        </pre>
      )}
    </div>
  );
}

function IdentifyProjectPanel() {
  const [project, setProject] = useState("all");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    setOutput(null);
    try {
      const { identifyPlant } = await import("@/lib/plantnet.server");
      const formData = new FormData();
      formData.append("image", file);
      // The existing identify server fn is hardcoded to the "all" project;
      // `project` here documents which project the real endpoint targets.
      void project;
      const result = await identifyPlant({ data: formData });
      setOutput(resultText(result));
    } catch (err) {
      setOutput(resultText({ status: "error", message: String(err) }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          POST
        </span>
        <code className="text-sm font-medium">/v2/identify/{"{project}"}</code>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Identification service — this is the same endpoint the Scan flow uses (project fixed to
        "all").
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          value={project}
          onChange={(e) => setProject(e.target.value)}
          placeholder="project"
          className="max-w-[10rem]"
        />
        <Input
          type="file"
          accept="image/*"
          disabled={loading}
          className="max-w-xs"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {loading && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Identifying…
        </p>
      )}
      {output && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed">
          {output}
        </pre>
      )}
    </div>
  );
}

function ProjectSpeciesPanel() {
  const [project, setProject] = useState("k-world-flora");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);

  const handleRun = async () => {
    setLoading(true);
    setOutput(null);
    try {
      const result = await getProjectSpecies({ data: { project } });
      setOutput(resultText(result));
    } catch (err) {
      setOutput(resultText({ status: "error", message: String(err) }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-600 dark:text-sky-400">
              GET
            </span>
            <code className="text-sm font-medium">/v2/projects/{"{project}"}/species</code>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Species catalog for one project.</p>
        </div>
        <Button size="sm" onClick={handleRun} disabled={loading}>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          Run
        </Button>
      </div>
      <div className="mt-3">
        <Input
          value={project}
          onChange={(e) => setProject(e.target.value)}
          placeholder="e.g. k-world-flora"
          className="max-w-xs"
        />
      </div>
      {output && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed">
          {output}
        </pre>
      )}
    </div>
  );
}

function ApiExplorer() {
  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-8">
      <header className="flex items-center gap-3 mb-6">
        <Link
          to="/"
          className="h-9 w-9 rounded-full bg-secondary grid place-items-center shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        </Link>
        <div>
          <h1 className="text-2xl font-display">API Explorer</h1>
          <p className="text-xs text-muted-foreground">
            Every My Pl@ntNet endpoint, wired to your configured API key.
          </p>
        </div>
      </header>

      <Tabs defaultValue="account">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="identify">Identify</TabsTrigger>
          <TabsTrigger value="diseases">Diseases</TabsTrigger>
          <TabsTrigger value="varieties">Varieties</TabsTrigger>
          <TabsTrigger value="taxonomy">Taxonomy</TabsTrigger>
          <TabsTrigger value="embeddings">Embeddings</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-3 mt-4">
          <EndpointPanel
            method="GET"
            path="/v2/_status"
            description="Check API health."
            run={() => getApiHealth()}
          />
          <EndpointPanel
            method="GET"
            path="/v2/quota"
            description="Check quota consumption (simple form)."
            run={() => getQuota()}
          />
          <EndpointPanel
            method="GET"
            path="/v2/quota/daily"
            description="Check quota consumption for today, with remaining count."
            run={() => getDailyQuota()}
          />
          <EndpointPanel
            method="GET"
            path="/v2/quota/history"
            description="Check quota consumption history. [pro] — expect a 403 on a free key."
            run={() => getQuotaHistory()}
          />
          <EndpointPanel
            method="GET"
            path="/v2/subscription"
            description="Check subscription status and details. [pro] — expect a 403 on a free key."
            run={() => getSubscription()}
          />
          <EndpointPanel
            method="GET"
            path="/v2/languages"
            description="Supported language codes for common names."
            run={() => getLanguages()}
          />
          <EndpointPanel
            method="GET"
            path="/v2/projects"
            description="Available identification projects (flora subsets)."
            run={() => getProjects()}
          />
        </TabsContent>

        <TabsContent value="identify" className="space-y-3 mt-4">
          <IdentifyProjectPanel />
        </TabsContent>

        <TabsContent value="diseases" className="space-y-3 mt-4">
          <EndpointPanel
            method="GET"
            path="/v2/diseases"
            description="List of ~627 recognized diseases/pests, with categories."
            run={() => getDiseases()}
          />
          <ImageEndpointPanel
            method="POST"
            path="/v2/diseases/identify"
            description="Upload a photo to identify a plant disease or pest."
            run={(formData) => identifyDisease({ data: formData })}
          />
        </TabsContent>

        <TabsContent value="varieties" className="space-y-3 mt-4">
          <EndpointPanel
            method="GET"
            path="/v2/varieties"
            description="List of recognized cultivar/variety labels."
            run={() => getVarieties()}
          />
          <ImageEndpointPanel
            method="POST"
            path="/v2/varieties/identify"
            description="Upload a photo to identify a plant variety/cultivar."
            run={(formData) => identifyVarieties({ data: formData })}
          />
        </TabsContent>

        <TabsContent value="taxonomy" className="space-y-3 mt-4">
          <EndpointPanel
            method="GET"
            path="/v2/species"
            description="Full species taxonomy dump (can be large — tens of thousands of rows)."
            run={() => getSpecies({ data: { lang: "en" } })}
          />
          <ProjectSpeciesPanel />
        </TabsContent>

        <TabsContent value="embeddings" className="space-y-3 mt-4">
          <ImageEndpointPanel
            method="POST"
            path="/v2/embeddings"
            description="Upload a photo to get its raw embedding vector."
            run={(formData) => createEmbeddings({ data: formData })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
