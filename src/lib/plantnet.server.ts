import { createServerFn } from "@tanstack/react-start";

const API_BASE = "https://my-api.plantnet.org/v2";

// TanStack Start's server-fn serializer requires a concrete JSON-safe return
// type — plain `unknown` fails its ValidateSerializable check. Endpoints
// whose exact response shape isn't modeled (quota history, subscription,
// disease/variety/embedding results) return this instead.
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type PlantNetResult = {
  scientificName: string;
  commonNames: string[];
  score: number;
  // Enrichment from the identify response — optional so older callers and
  // plants saved to localStorage before these fields existed keep working.
  family?: string;
  genus?: string;
  gbifId?: string;
  powoId?: string;
  iucnCategory?: string;
};

export type PlantNetResponse =
  | { status: "ok"; results: PlantNetResult[] }
  | { status: "quota-exceeded" }
  | { status: "error"; message: string };

// Generic envelope every server fn below returns, so the API Explorer UI can
// render success/error/quota uniformly without one-off shapes per endpoint.
export type ApiResult<T> =
  { status: "ok"; data: T } | { status: "quota-exceeded" } | { status: "error"; message: string };

function requireApiKey(): { ok: true; key: string } | { ok: false; message: string } {
  const apiKey = process.env.PLANTNET_API_KEY;
  if (!apiKey) return { ok: false, message: "Plant identification is not configured." };
  return { ok: true, key: apiKey };
}

async function callApi<T>(
  path: string,
  params: Record<string, string | undefined> = {},
): Promise<ApiResult<T>> {
  const auth = requireApiKey();
  if (!auth.ok) return { status: "error", message: auth.message };

  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("api-key", auth.key);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, v);
  }

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch {
    return { status: "error", message: "Could not reach the Pl@ntNet API." };
  }

  if (response.status === 429) return { status: "quota-exceeded" };
  if (response.status === 403) {
    return { status: "error", message: "Not available on your Pl@ntNet plan (403)." };
  }
  if (!response.ok) {
    return { status: "error", message: `Request failed (${response.status}).` };
  }

  try {
    const data = (await response.json()) as T;
    return { status: "ok", data };
  } catch {
    return { status: "error", message: "Received an invalid response." };
  }
}

// ---------------------------------------------------------------------------
// my-api: quota, subscription
// ---------------------------------------------------------------------------

export type DailyQuota = {
  day: string;
  quota: { identify: { count: number; total: number; remaining: number } };
};

export const getDailyQuota = createServerFn({ method: "GET" }).handler(() =>
  callApi<DailyQuota>("/quota/daily"),
);

// [pro]-only — surfaced as a 403 ApiResult error for non-pro keys.
export const getSubscription = createServerFn({ method: "GET" }).handler(() =>
  callApi<Json>("/subscription"),
);

// ---------------------------------------------------------------------------
// taxonomy: species, project species
// ---------------------------------------------------------------------------

// The bare /v2/species endpoint (no project) only returns a small list of
// hybrid-genus entries (~100), NOT the general flora — confirmed by probing
// it directly. Pl@ntNet's project-species endpoints are paginated with no
// documented offset/cursor param; an undocumented `pageSize` raises the cap
// (confirmed up to several thousand rows). At pageSize=6000 the "useful"
// project returns 5545 entries covering the full A-Z alphabet, including
// common genera like Monstera — full coverage IS reliably fetchable this
// way; an earlier version of this comment claiming otherwise was wrong,
// caused by ProjectSpeciesEntry not matching the API's actual (flat) shape.
const SPECIES_PROJECT = "useful";
const SPECIES_PAGE_SIZE = "6000";

export const getSpecies = createServerFn({ method: "GET" })
  .validator((data: { lang?: string } | undefined) => data ?? {})
  .handler(({ data }) =>
    callApi<ProjectSpeciesEntry[]>(`/projects/${SPECIES_PROJECT}/species`, {
      lang: data.lang,
      pageSize: SPECIES_PAGE_SIZE,
    }),
  );

// Confirmed live against /v2/projects/useful/species: fields are flat on
// each entry, not nested under a `species` key. `genus`/`family` are
// nullable on some rows (e.g. hybrid entries) — callers must guard.
export type ProjectSpeciesEntry = {
  id: string;
  commonNames: string[];
  genus: string | null;
  family: string | null;
  scientificNameWithoutAuthor: string;
  scientificNameAuthorship: string;
  gbifId?: number;
  powoId?: string | null;
  iucnCategory?: string | null;
};

export const getProjectSpecies = createServerFn({ method: "GET" })
  .validator((data: { project: string; lang?: string }) => data)
  .handler(({ data }) =>
    callApi<ProjectSpeciesEntry[]>(`/projects/${encodeURIComponent(data.project)}/species`, {
      lang: data.lang,
      pageSize: SPECIES_PAGE_SIZE,
    }),
  );

// ---------------------------------------------------------------------------
// varieties
// ---------------------------------------------------------------------------

// Confirmed live against /v2/varieties: each row is a cultivar/variety name
// plus the parent species it belongs to — not a flat {label, categories}
// shape like /v2/diseases. All 137 rows carry a fully populated `species`.
export type PlantNetVariety = {
  name: string;
  species: {
    scientificName: string;
    scientificNameWithoutAuthor: string;
    scientificNameAuthorship: string;
    genus: string;
    family: string;
    commonNames?: string[];
    gbif?: { id: string };
  };
};

export const getVarieties = createServerFn({ method: "GET" }).handler(() =>
  callApi<PlantNetVariety[]>("/varieties"),
);

export type VarietyMatch = { name: string; score: number };

// Pl@ntNet's diseases/varieties identify endpoints return
// `{results: [{name, score, description}]}` — `name` is a short internal
// code (e.g. "BOTRCI"), `description` is the human-readable label (e.g.
// "Botrytis cinerea - Brownish-grey mildew"), confirmed against the live
// API. `entityKeys` is unused now but kept as a parameter so call sites
// don't need updating; a prior version of this function assumed a nested
// `{disease: {label}}`/`{variety: {label}}` shape that doesn't exist on the
// real response, which meant every match was silently filtered out as
// unparseable — this always returned an empty list regardless of what was
// actually in the photo.
function parseRankedMatches(body: Json, _entityKeys: string[]): { name: string; score: number }[] {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return [];
  const results = (body as Record<string, Json>).results;
  if (!Array.isArray(results)) return [];

  return results
    .map((r) => {
      if (typeof r !== "object" || r === null || Array.isArray(r)) return null;
      const rec = r as Record<string, Json>;
      const score = typeof rec.score === "number" ? rec.score : null;
      const name =
        typeof rec.description === "string"
          ? rec.description
          : typeof rec.name === "string"
            ? rec.name
            : null;
      if (score === null || name === null) return null;
      return { name, score };
    })
    .filter((m): m is { name: string; score: number } => m !== null);
}

export const identifyVarieties = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected FormData");
    return data;
  })
  .handler(async ({ data }): Promise<ApiResult<VarietyMatch[]>> => {
    const auth = requireApiKey();
    if (!auth.ok) return { status: "error", message: auth.message };

    const image = data.get("image");
    if (!(image instanceof Blob)) return { status: "error", message: "No image provided." };

    const forwardBody = new FormData();
    forwardBody.append("images", image, "capture.jpg");

    let response: Response;
    try {
      response = await fetch(
        `${API_BASE}/varieties/identify?api-key=${encodeURIComponent(auth.key)}`,
        { method: "POST", body: forwardBody },
      );
    } catch {
      return { status: "error", message: "Could not reach the Pl@ntNet API." };
    }
    if (response.status === 429) return { status: "quota-exceeded" };
    // Pl@ntNet's varieties/identify only covers cultivated-variety species
    // (crops/cultivars with named varieties) — it 404s "Species not found"
    // for any species outside that list, which includes most houseplants.
    // That's an expected empty result for this app, not a failure.
    if (response.status === 404) return { status: "ok", data: [] };
    if (!response.ok) return { status: "error", message: `Request failed (${response.status}).` };
    try {
      const body = (await response.json()) as Json;
      return { status: "ok", data: parseRankedMatches(body, ["variety"]) };
    } catch {
      return { status: "error", message: "Received an invalid response." };
    }
  });

// ---------------------------------------------------------------------------
// diseases
// ---------------------------------------------------------------------------

export type PlantNetDisease = {
  label: string;
  name: string;
  categories: string[];
};

export const getDiseases = createServerFn({ method: "GET" }).handler(() =>
  callApi<PlantNetDisease[]>("/diseases"),
);

export type DiseaseMatch = { name: string; score: number };

export const identifyDisease = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected FormData");
    return data;
  })
  .handler(async ({ data }): Promise<ApiResult<DiseaseMatch[]>> => {
    const auth = requireApiKey();
    if (!auth.ok) return { status: "error", message: auth.message };

    const image = data.get("image");
    if (!(image instanceof Blob)) return { status: "error", message: "No image provided." };

    const forwardBody = new FormData();
    forwardBody.append("images", image, "capture.jpg");

    let response: Response;
    try {
      response = await fetch(
        `${API_BASE}/diseases/identify?api-key=${encodeURIComponent(auth.key)}`,
        { method: "POST", body: forwardBody },
      );
    } catch {
      return { status: "error", message: "Could not reach the Pl@ntNet API." };
    }
    if (response.status === 429) return { status: "quota-exceeded" };
    if (!response.ok) return { status: "error", message: `Request failed (${response.status}).` };
    try {
      const body = (await response.json()) as Json;
      return { status: "ok", data: parseRankedMatches(body, ["disease"]) };
    } catch {
      return { status: "error", message: "Received an invalid response." };
    }
  });

// ---------------------------------------------------------------------------
// embeddings
// ---------------------------------------------------------------------------

export const createEmbeddings = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected FormData");
    return data;
  })
  .handler(async ({ data }): Promise<ApiResult<Json>> => {
    const auth = requireApiKey();
    if (!auth.ok) return { status: "error", message: auth.message };

    const image = data.get("image");
    if (!(image instanceof Blob)) return { status: "error", message: "No image provided." };

    const forwardBody = new FormData();
    forwardBody.append("images", image, "capture.jpg");

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/embeddings?api-key=${encodeURIComponent(auth.key)}`, {
        method: "POST",
        body: forwardBody,
      });
    } catch {
      return { status: "error", message: "Could not reach the Pl@ntNet API." };
    }
    if (response.status === 429) return { status: "quota-exceeded" };
    if (!response.ok) return { status: "error", message: `Request failed (${response.status}).` };
    try {
      return { status: "ok", data: await response.json() };
    } catch {
      return { status: "error", message: "Received an invalid response." };
    }
  });

// The embeddings response shape isn't documented — depth-first search for
// the first plausible feature vector (a reasonably long all-number array)
// rather than hardcoding a nesting that may differ per plan/version.
function findEmbeddingVector(body: Json): number[] | null {
  if (Array.isArray(body)) {
    if (body.length >= 16 && body.every((v) => typeof v === "number")) {
      return body as number[];
    }
    for (const item of body) {
      const found = findEmbeddingVector(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof body === "object" && body !== null) {
    for (const value of Object.values(body)) {
      const found = findEmbeddingVector(value);
      if (found) return found;
    }
  }
  return null;
}

// Same upstream call as createEmbeddings, but returns just the parsed
// feature vector — used by the growth timeline's "visual match" check.
export const getPhotoEmbedding = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected FormData");
    return data;
  })
  .handler(async ({ data }): Promise<ApiResult<number[]>> => {
    const auth = requireApiKey();
    if (!auth.ok) return { status: "error", message: auth.message };

    const image = data.get("image");
    if (!(image instanceof Blob)) return { status: "error", message: "No image provided." };

    const forwardBody = new FormData();
    forwardBody.append("images", image, "capture.jpg");

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/embeddings?api-key=${encodeURIComponent(auth.key)}`, {
        method: "POST",
        body: forwardBody,
      });
    } catch {
      return { status: "error", message: "Could not reach the Pl@ntNet API." };
    }
    if (response.status === 429) return { status: "quota-exceeded" };
    if (response.status === 403) {
      return { status: "error", message: "Not available on your Pl@ntNet plan (403)." };
    }
    if (!response.ok) return { status: "error", message: `Request failed (${response.status}).` };
    try {
      const body = (await response.json()) as Json;
      const vector = findEmbeddingVector(body);
      if (!vector) return { status: "error", message: "No embedding vector in the response." };
      return { status: "ok", data: vector };
    } catch {
      return { status: "error", message: "Received an invalid response." };
    }
  });

// ---------------------------------------------------------------------------
// identify (scan flow) — accepts optional `organs` and `project` FormData
// fields so the Scan UI can target a specific organ or regional flora.
// ---------------------------------------------------------------------------

// Values the identify endpoint documents for `organs`.
const VALID_ORGANS = new Set(["auto", "leaf", "flower", "fruit", "bark", "habit", "other"]);

export const identifyPlant = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected FormData");
    return data;
  })
  .handler(async ({ data }): Promise<PlantNetResponse> => {
    const auth = requireApiKey();
    if (!auth.ok) return { status: "error", message: auth.message };

    // Multi-photo submission (up to 4 angles/organs of the same plant in one
    // request) measurably improves Pl@ntNet's match confidence over a single
    // photo — confirmed against the live API, which accepts repeated
    // `images`/`organs` field pairs and returns one combined result. Older
    // callers sending a single "image" field still work via the fallback.
    const images: Blob[] = data.getAll("images").filter((v): v is File => v instanceof File);
    const legacyImage = data.get("image");
    if (images.length === 0 && legacyImage instanceof Blob) {
      images.push(legacyImage);
    }
    if (images.length === 0) {
      return { status: "error", message: "No image provided." };
    }

    const organsRaw = data.getAll("organs").filter((v): v is string => typeof v === "string");
    const organs =
      organsRaw.length > 0
        ? organsRaw.map((o) => (VALID_ORGANS.has(o) ? o : "auto"))
        : images.map(() => "auto");

    // Project ids are lowercase slugs (e.g. "all", "k-world-flora",
    // "useful") — anything else falls back to "all" rather than 404ing.
    const projectRaw = data.get("project");
    const project =
      typeof projectRaw === "string" && /^[a-z0-9-]+$/.test(projectRaw) ? projectRaw : "all";

    const forwardBody = new FormData();
    images.forEach((image, i) => {
      forwardBody.append("images", image, `capture-${i}.jpg`);
      forwardBody.append("organs", organs[i] ?? "auto");
    });

    let response: Response;
    try {
      response = await fetch(
        `${API_BASE}/identify/${project}?api-key=${encodeURIComponent(auth.key)}`,
        { method: "POST", body: forwardBody },
      );
    } catch {
      return { status: "error", message: "Could not reach the plant identification service." };
    }

    if (response.status === 429) {
      return { status: "quota-exceeded" };
    }
    if (!response.ok) {
      return { status: "error", message: `Plant identification failed (${response.status}).` };
    }

    let body: {
      results?: {
        score?: number;
        species?: {
          scientificNameWithoutAuthor?: string;
          commonNames?: string[];
          genus?: { scientificNameWithoutAuthor?: string };
          family?: { scientificNameWithoutAuthor?: string };
        };
        gbif?: { id?: string | number };
        powo?: { id?: string };
        iucn?: { category?: string };
      }[];
    };
    try {
      body = await response.json();
    } catch {
      return { status: "error", message: "Received an invalid response." };
    }

    const results: PlantNetResult[] = (body.results ?? [])
      .filter((r) => r.species?.scientificNameWithoutAuthor && typeof r.score === "number")
      .map((r) => ({
        scientificName: r.species!.scientificNameWithoutAuthor!,
        commonNames: r.species!.commonNames ?? [],
        score: r.score!,
        family: r.species!.family?.scientificNameWithoutAuthor,
        genus: r.species!.genus?.scientificNameWithoutAuthor,
        gbifId: r.gbif?.id != null ? String(r.gbif.id) : undefined,
        powoId: r.powo?.id,
        iucnCategory: r.iucn?.category,
      }));

    return { status: "ok", results };
  });
