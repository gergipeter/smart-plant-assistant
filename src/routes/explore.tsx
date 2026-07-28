import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell, PlantThumb } from "@/components/AppShell";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, ExternalLink, Sprout, Bug, Tag, X, Plus, Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getSpecies,
  getDiseases,
  getVarieties,
  type ProjectSpeciesEntry,
  type PlantNetDisease,
  type PlantNetVariety,
} from "@/lib/plantnet.server";
import { getSpeciesPhoto } from "@/lib/speciesPhoto.server";
import { getPlant, plants, speciesCatalog } from "@/lib/plants";
import { addToMyGarden, buildPlantFromSpecies, canAddPlant } from "@/lib/myGarden";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore species — Verdant" },
      {
        name: "description",
        content: "Search Pl@ntNet's full species database beyond your own garden.",
      },
    ],
  }),
  component: Explore,
});

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 30;

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

// Species already curated in the local catalog get a direct link to their
// care guide instead of just a name — a search hit that happens to be a
// plant Verdant already knows about is worth surfacing as such.
const catalogBySciName = new Map(
  [...plants, ...speciesCatalog].map((p) => [normalize(p.scientific), p.id]),
);

// Fetched once per scientific name and cached indefinitely (query key is
// the name itself) — Wikipedia photos don't change during a session, and
// this avoids re-fetching the same species' photo across list scroll and
// detail-sheet open. `enabled` gates the fetch so it only fires once this
// row/sheet is actually rendered (list rows lazy-load as they scroll into
// view via IntersectionObserver in SpeciesThumb below), not for the whole
// result set up front.
function useSpeciesPhoto(scientificName: string, enabled: boolean) {
  return useQuery({
    queryKey: ["species-photo", scientificName],
    queryFn: async () => {
      const res = await getSpeciesPhoto({ data: { scientificName } });
      return res.status === "ok" ? res : null;
    },
    staleTime: Infinity,
    enabled,
  });
}

// Thumbnail used in both list rows and the detail sheet — shows a real
// Wikipedia photo when one exists, falls back to the emoji/icon placeholder
// otherwise. `lazy: true` (list rows) delays the fetch until the element
// is actually visible, so scrolling a 30-row result list doesn't fire 30
// requests at once; the detail sheet passes `lazy: false` since it's
// already the one thing on screen when opened.
function SpeciesThumb({
  scientificName,
  fallback,
  className,
  lazy,
}: {
  scientificName: string;
  fallback: React.ReactNode;
  className: string;
  lazy: boolean;
}) {
  const [visible, setVisible] = useState(!lazy);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lazy || visible) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [lazy, visible]);

  const photoQuery = useSpeciesPhoto(scientificName, visible);
  const photo = photoQuery.data;

  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      {photo ? (
        <img src={photo.url} alt="" className="h-full w-full object-cover" />
      ) : (
        fallback
      )}
    </div>
  );
}

function SpeciesRow({
  entry,
  onSelect,
}: {
  entry: ProjectSpeciesEntry;
  onSelect: (entry: ProjectSpeciesEntry) => void;
}) {
  const t = useT();
  const catalogId = catalogBySciName.get(normalize(entry.scientificNameWithoutAuthor));
  const catalogPlant = catalogId ? getPlant(catalogId) : undefined;

  return (
    <button onClick={() => onSelect(entry)} className="ios-tap leaf-card p-3 flex items-center gap-3 w-full text-left">
      {catalogPlant ? (
        <PlantThumb
          emoji={catalogPlant.emoji}
          gradient={catalogPlant.gradient}
          className="h-11 w-11 rounded-xl text-xl [&>span]:text-xl shrink-0"
        />
      ) : (
        <SpeciesThumb
          scientificName={entry.scientificNameWithoutAuthor}
          lazy
          className="h-11 w-11 rounded-xl bg-secondary grid place-items-center shrink-0"
          fallback={<Sprout className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />}
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium italic truncate">{entry.scientificNameWithoutAuthor}</p>
        <p className="text-xs text-muted-foreground truncate">
          {entry.commonNames.length ? entry.commonNames.slice(0, 2).join(", ") : entry.family}
        </p>
      </div>
      {catalogPlant && (
        <Link
          to="/plant/$id"
          params={{ id: catalogPlant.id }}
          onClick={(e) => e.stopPropagation()}
          className="ios-tap shrink-0 h-8 w-8 rounded-full bg-secondary grid place-items-center"
          aria-label={t("explore.openCareGuide", { name: catalogPlant.name })}
        >
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
        </Link>
      )}
    </button>
  );
}

function SpeciesTab({ onSelect }: { onSelect: (entry: ProjectSpeciesEntry) => void }) {
  const t = useT();
  const [query, setQuery] = useState("");

  // Fetched once and cached indefinitely (world flora doesn't change during
  // a session) — Pl@ntNet has no server-side text search, so filtering is
  // done locally against this full dump.
  const speciesQuery = useQuery({
    queryKey: ["plantnet-species", "en"],
    queryFn: async () => {
      const res = await getSpecies({ data: { lang: "en" } });
      if (res.status !== "ok") throw new Error("Could not load species database.");
      return res.data;
    },
    staleTime: Infinity,
    enabled: normalize(query).length >= MIN_QUERY_LENGTH,
  });

  const results = useMemo(() => {
    const q = normalize(query);
    if (q.length < MIN_QUERY_LENGTH || !speciesQuery.data) return [];
    const matches: ProjectSpeciesEntry[] = [];
    for (const entry of speciesQuery.data) {
      if (matches.length >= MAX_RESULTS) break;
      if (!entry?.scientificNameWithoutAuthor) continue;
      const haystack =
        `${entry.scientificNameWithoutAuthor} ${entry.commonNames.join(" ")}`.toLowerCase();
      if (haystack.includes(q)) matches.push(entry);
    }
    return matches;
  }, [query, speciesQuery.data]);

  return (
    <>
      <div className="leaf-card flex items-center gap-2 px-4 h-12 mb-5">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("explore.searchSpecies")}
          className="flex-1 bg-transparent outline-none text-[15px]"
        />
      </div>

      {normalize(query).length < MIN_QUERY_LENGTH && (
        <p className="text-sm text-muted-foreground text-center mt-10">
          {t("explore.typeToSearch", { min: MIN_QUERY_LENGTH })}
        </p>
      )}

      {speciesQuery.isLoading && normalize(query).length >= MIN_QUERY_LENGTH && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-10">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("explore.loadingSpecies")}
        </div>
      )}

      {speciesQuery.isError && (
        <p className="text-sm text-muted-foreground text-center mt-10">
          {t("explore.loadErrorSpecies")}
        </p>
      )}

      {!speciesQuery.isLoading && normalize(query).length >= MIN_QUERY_LENGTH && (
        <>
          {results.length === 0 && speciesQuery.data && (
            <p className="text-sm text-muted-foreground text-center mt-10">
              {t("explore.noMatch", { query })}
            </p>
          )}
          <div className="space-y-2">
            {results.map((entry, i) => (
              <SpeciesRow
                key={`${entry.scientificNameWithoutAuthor}-${i}`}
                entry={entry}
                onSelect={onSelect}
              />
            ))}
          </div>
          {results.length === MAX_RESULTS && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              {t("explore.showingFirst", { max: MAX_RESULTS })}
            </p>
          )}
        </>
      )}
    </>
  );
}

// Diseases tab — /v2/diseases is a flat {label, name, categories} list
// (~2500 rows), fetched once and filtered client-side.
function DiseasesTab() {
  const t = useT();
  const [query, setQuery] = useState("");
  const [selectedDisease, setSelectedDisease] = useState<PlantNetDisease | null>(null);
  const listQuery = useDiseasesQuery();
  const icon = <Bug className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />;

  const results = useMemo(() => {
    const q = normalize(query);
    if (!listQuery.data) return [];
    const items = q.length
      ? listQuery.data.filter((d) => normalize(d.label).includes(q))
      : listQuery.data;
    return items.slice(0, MAX_RESULTS);
  }, [query, listQuery.data]);

  return (
    <>
      <div className="leaf-card flex items-center gap-2 px-4 h-12 mb-5">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("explore.searchDiseases")}
          className="flex-1 bg-transparent outline-none text-[15px]"
        />
      </div>

      {listQuery.isLoading && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-10">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("explore.loading")}
        </div>
      )}

      {listQuery.isError && (
        <p className="text-sm text-muted-foreground text-center mt-10">
          {t("explore.loadErrorList")}
        </p>
      )}

      {!listQuery.isLoading && !listQuery.isError && (
        <>
          {results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center mt-10">
              {t("explore.noDiseasesMatch")}
            </p>
          )}
          <div className="space-y-2">
            {results.map((entry, i) => (
              <button
                key={`${entry.label}-${i}`}
                onClick={() => setSelectedDisease(entry)}
                className="ios-tap leaf-card p-3 flex items-center gap-3 w-full text-left"
              >
                <div className="h-11 w-11 rounded-xl bg-secondary grid place-items-center shrink-0">
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.label}</p>
                  {entry.categories.length > 0 && (
                    <p className="text-xs text-muted-foreground truncate">
                      {entry.categories.join(", ")}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
          {listQuery.data &&
            listQuery.data.length > MAX_RESULTS &&
            results.length === MAX_RESULTS && (
              <p className="text-xs text-muted-foreground text-center mt-3">
                {t("explore.showingFirst", { max: MAX_RESULTS })}
              </p>
            )}
        </>
      )}

      {selectedDisease && (
        <DiseaseDetailSheet entry={selectedDisease} onClose={() => setSelectedDisease(null)} />
      )}
    </>
  );
}

// Detail sheet for a disease/pest row — same fixed-bottom-sheet pattern as
// SpeciesDetailSheet. The disease catalog itself has no treatment info (just
// {label, name, categories}), so the primary action deep-links to Doctor
// with a pre-composed question instead of showing static/fabricated advice.
function DiseaseDetailSheet({
  entry,
  onClose,
}: {
  entry: PlantNetDisease;
  onClose: () => void;
}) {
  const t = useT();

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={onClose}>
      <div
        className="w-full max-w-md mx-auto bg-card rounded-t-3xl overflow-hidden pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-secondary grid place-items-center shrink-0">
                <Bug className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="font-display text-lg">{entry.label}</h3>
                {entry.categories.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {entry.categories.join(", ")}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="ios-tap h-8 w-8 rounded-full bg-secondary grid place-items-center shrink-0"
              aria-label={t("explore.closeDetail")}
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>

          <Link
            to="/doctor"
            search={{ ask: t("explore.askDoctorAboutDisease", { name: entry.label }) }}
            className="ios-tap w-full h-12 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"
          >
            {t("explore.askDoctorAboutDiseaseCta")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function useDiseasesQuery() {
  return useQuery<PlantNetDisease[]>({
    queryKey: ["plantnet-diseases"],
    queryFn: async () => {
      const res = await getDiseases();
      if (res.status !== "ok") throw new Error("Could not load diseases list.");
      return res.data;
    },
    staleTime: Infinity,
  });
}

function useVarietiesQuery() {
  return useQuery<PlantNetVariety[]>({
    queryKey: ["plantnet-varieties"],
    queryFn: async () => {
      const res = await getVarieties();
      if (res.status !== "ok") throw new Error("Could not load varieties list.");
      return res.data;
    },
    staleTime: Infinity,
  });
}

// Converts a variety's nested `species` (PlantNetVariety's shape) into a
// ProjectSpeciesEntry so tapping a variety can open the same species detail
// sheet as the Species tab — the two shapes carry the same taxonomy fields,
// just under different parent types.
function varietySpeciesToEntry(species: PlantNetVariety["species"]): ProjectSpeciesEntry {
  return {
    id: species.gbif?.id ?? species.scientificNameWithoutAuthor,
    commonNames: species.commonNames ?? [],
    genus: species.genus,
    family: species.family,
    scientificNameWithoutAuthor: species.scientificNameWithoutAuthor,
    scientificNameAuthorship: species.scientificNameAuthorship,
  };
}

// Varieties tab — /v2/varieties is a cultivar name plus its parent species
// (~137 rows), distinct from the flat {label, categories} shape diseases
// use. Rendered as "variety name — parent species (common names)".
function VarietiesTab({ onSelectSpecies }: { onSelectSpecies: (entry: ProjectSpeciesEntry) => void }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const listQuery = useVarietiesQuery();

  const results = useMemo(() => {
    const q = normalize(query);
    if (!listQuery.data) return [];
    const items = q.length
      ? listQuery.data.filter(
          (d) =>
            normalize(d.name).includes(q) ||
            normalize(d.species.scientificNameWithoutAuthor).includes(q) ||
            (d.species.commonNames ?? []).some((c) => normalize(c).includes(q)),
        )
      : listQuery.data;
    return items.slice(0, MAX_RESULTS);
  }, [query, listQuery.data]);

  return (
    <>
      <div className="leaf-card flex items-center gap-2 px-4 h-12 mb-5">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("explore.searchVarieties")}
          className="flex-1 bg-transparent outline-none text-[15px]"
        />
      </div>

      {listQuery.isLoading && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-10">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("explore.loading")}
        </div>
      )}

      {listQuery.isError && (
        <p className="text-sm text-muted-foreground text-center mt-10">
          {t("explore.loadErrorList")}
        </p>
      )}

      {!listQuery.isLoading && !listQuery.isError && (
        <>
          {results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center mt-10">
              {t("explore.noVarietiesMatch")}
            </p>
          )}
          <div className="space-y-2">
            {results.map((entry, i) => (
              <button
                key={`${entry.name}-${i}`}
                onClick={() => onSelectSpecies(varietySpeciesToEntry(entry.species))}
                className="ios-tap leaf-card p-3 flex items-center gap-3 w-full text-left"
              >
                <SpeciesThumb
                  scientificName={entry.species.scientificNameWithoutAuthor}
                  lazy
                  className="h-11 w-11 rounded-xl bg-secondary grid place-items-center shrink-0"
                  fallback={<Tag className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.name}</p>
                  <p className="text-xs text-muted-foreground truncate italic">
                    {entry.species.scientificNameWithoutAuthor}
                    {entry.species.commonNames?.length
                      ? ` — ${entry.species.commonNames.slice(0, 2).join(", ")}`
                      : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>
          {listQuery.data &&
            listQuery.data.length > MAX_RESULTS &&
            results.length === MAX_RESULTS && (
              <p className="text-xs text-muted-foreground text-center mt-3">
                {t("explore.showingFirst", { max: MAX_RESULTS })}
              </p>
            )}
        </>
      )}
    </>
  );
}

// Bottom sheet shown when tapping a species (directly, or via a variety's
// parent species link). Shows what Pl@ntNet actually gives us — scientific
// name, common names, family/genus — plus "Add to garden" via
// buildPlantFromSpecies(), following the same
// canAddPlant -> addToMyGarden -> navigate pattern scan.tsx uses for a
// freshly-identified plant.
function SpeciesDetailSheet({
  entry,
  onClose,
}: {
  entry: ProjectSpeciesEntry;
  onClose: () => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const catalogId = catalogBySciName.get(normalize(entry.scientificNameWithoutAuthor));
  const catalogPlant = catalogId ? getPlant(catalogId) : undefined;

  const photoQuery = useSpeciesPhoto(entry.scientificNameWithoutAuthor, true);
  const photo = photoQuery.data;

  const handleAdd = async () => {
    setAdding(true);
    setLimitReached(false);
    try {
      if (!(await canAddPlant(user?.uid))) {
        setLimitReached(true);
        return;
      }
      const plant = buildPlantFromSpecies(entry, photo?.url);
      const savedId = addToMyGarden(plant);
      navigate({ to: "/plant/$id", params: { id: savedId } });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={onClose}>
      <div
        className="w-full max-w-md mx-auto bg-card rounded-t-3xl overflow-hidden pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        {photo && (
          <div className="relative h-40 w-full">
            <img src={photo.url} alt="" className="h-full w-full object-cover" />
            <a
              href={photo.attributionUrl}
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-1.5 right-2 text-[10px] text-white/90 bg-black/40 px-1.5 py-0.5 rounded"
            >
              {t("explore.photoCredit")}
            </a>
          </div>
        )}
        <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-display text-lg italic">{entry.scientificNameWithoutAuthor}</h3>
            {entry.commonNames.length > 0 && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {entry.commonNames.slice(0, 3).join(", ")}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ios-tap h-8 w-8 rounded-full bg-secondary grid place-items-center shrink-0"
            aria-label={t("explore.closeDetail")}
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-3 mb-4 text-sm">
          {entry.family && (
            <div>
              <dt className="text-xs text-muted-foreground">{t("explore.family")}</dt>
              <dd>{entry.family}</dd>
            </div>
          )}
          {entry.genus && (
            <div>
              <dt className="text-xs text-muted-foreground">{t("explore.genus")}</dt>
              <dd>{entry.genus}</dd>
            </div>
          )}
        </dl>

        {limitReached && (
          <p className="text-sm text-destructive mb-3">{t("explore.limitReached")}</p>
        )}

        {catalogPlant ? (
          <Link
            to="/plant/$id"
            params={{ id: catalogPlant.id }}
            className="ios-tap w-full h-12 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"
          >
            <Check className="h-4 w-4" strokeWidth={1.75} /> {t("explore.viewCareGuide")}
          </Link>
        ) : (
          <button
            onClick={handleAdd}
            disabled={adding}
            className="ios-tap w-full h-12 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            {adding ? t("explore.adding") : t("explore.addToGarden")}
          </button>
        )}
        </div>
      </div>
    </div>
  );
}

function Explore() {
  const t = useT();
  const [selectedSpecies, setSelectedSpecies] = useState<ProjectSpeciesEntry | null>(null);
  return (
    <AppShell>
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {t("explore.eyebrow")}
        </p>
        <h1 className="text-3xl font-display mt-1">{t("explore.heading")}</h1>
        <p className="text-xs text-muted-foreground mt-1">{t("explore.subtitle")}</p>
      </header>

      <Tabs defaultValue="species">
        <TabsList className="mb-5">
          <TabsTrigger value="species">{t("explore.tab.species")}</TabsTrigger>
          <TabsTrigger value="varieties">{t("explore.tab.varieties")}</TabsTrigger>
          <TabsTrigger value="diseases">{t("explore.tab.diseases")}</TabsTrigger>
        </TabsList>

        <TabsContent value="species">
          <SpeciesTab onSelect={setSelectedSpecies} />
        </TabsContent>

        <TabsContent value="varieties">
          <VarietiesTab onSelectSpecies={setSelectedSpecies} />
        </TabsContent>

        <TabsContent value="diseases">
          <DiseasesTab />
        </TabsContent>
      </Tabs>

      {selectedSpecies && (
        <SpeciesDetailSheet entry={selectedSpecies} onClose={() => setSelectedSpecies(null)} />
      )}
    </AppShell>
  );
}
