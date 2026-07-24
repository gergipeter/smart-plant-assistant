import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PlantThumb } from "@/components/AppShell";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, ExternalLink, Sprout, Bug, Tag } from "lucide-react";
import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getSpecies,
  getDiseases,
  getVarieties,
  type ProjectSpeciesEntry,
  type PlantNetDisease,
  type PlantNetVariety,
} from "@/lib/plantnet.server";
import { getPlant, plants, speciesCatalog } from "@/lib/plants";
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

// Narrowed shape guaranteed by the filter in `results` below — only entries
// with a resolved `species.scientificNameWithoutAuthor` make it into this
// list, so downstream rendering doesn't need to re-check for undefined.
type ResolvedSpeciesEntry = ProjectSpeciesEntry & {
  species: NonNullable<ProjectSpeciesEntry["species"]>;
};

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

// Species already curated in the local catalog get a direct link to their
// care guide instead of just a name — a search hit that happens to be a
// plant Verdant already knows about is worth surfacing as such.
const catalogBySciName = new Map(
  [...plants, ...speciesCatalog].map((p) => [normalize(p.scientific), p.id]),
);

function SpeciesRow({ entry }: { entry: ResolvedSpeciesEntry }) {
  const t = useT();
  const { species } = entry;
  const catalogId = catalogBySciName.get(normalize(species.scientificNameWithoutAuthor));
  const catalogPlant = catalogId ? getPlant(catalogId) : undefined;

  return (
    <div className="leaf-card p-3 flex items-center gap-3">
      {catalogPlant ? (
        <PlantThumb
          emoji={catalogPlant.emoji}
          gradient={catalogPlant.gradient}
          className="h-11 w-11 rounded-xl text-xl [&>span]:text-xl shrink-0"
        />
      ) : (
        <div className="h-11 w-11 rounded-xl bg-secondary grid place-items-center shrink-0">
          <Sprout className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium italic truncate">{species.scientificNameWithoutAuthor}</p>
        <p className="text-xs text-muted-foreground truncate">
          {species.commonNames?.length
            ? species.commonNames.slice(0, 2).join(", ")
            : species.family}
        </p>
      </div>
      {catalogPlant && (
        <Link
          to="/plant/$id"
          params={{ id: catalogPlant.id }}
          className="ios-tap shrink-0 h-8 w-8 rounded-full bg-secondary grid place-items-center"
          aria-label={t("explore.openCareGuide", { name: catalogPlant.name })}
        >
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
        </Link>
      )}
    </div>
  );
}

function SpeciesTab() {
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
    const matches: ResolvedSpeciesEntry[] = [];
    for (const entry of speciesQuery.data) {
      if (matches.length >= MAX_RESULTS) break;
      // Some rows in Pl@ntNet's project-species response omit `species`
      // (e.g. entries with no resolved taxon match) — skip those rather
      // than assume every row is fully populated.
      const species = entry?.species;
      if (!species?.scientificNameWithoutAuthor) continue;
      const commonNames = species.commonNames ?? [];
      const haystack =
        `${species.scientificNameWithoutAuthor} ${commonNames.join(" ")}`.toLowerCase();
      if (haystack.includes(q)) matches.push(entry as ResolvedSpeciesEntry);
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
              <SpeciesRow key={`${entry.species.scientificNameWithoutAuthor}-${i}`} entry={entry} />
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

// Shared by the Varieties and Diseases tabs — both are flat labeled lists
// (~600-plus rows) fetched once and filtered client-side, same pattern as
// species search but without the ProjectSpeciesEntry nesting.
function LabelListTab({
  icon,
  placeholder,
  emptyHint,
  useListQuery,
}: {
  icon: React.ReactNode;
  placeholder: string;
  emptyHint: string;
  useListQuery: () => {
    data?: { label: string; name: string; categories: string[] }[];
    isLoading: boolean;
    isError: boolean;
  };
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const listQuery = useListQuery();

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
          placeholder={placeholder}
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
            <p className="text-sm text-muted-foreground text-center mt-10">{emptyHint}</p>
          )}
          <div className="space-y-2">
            {results.map((entry, i) => (
              <div key={`${entry.label}-${i}`} className="leaf-card p-3 flex items-center gap-3">
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
              </div>
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

function Explore() {
  const t = useT();
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
          <SpeciesTab />
        </TabsContent>

        <TabsContent value="varieties">
          <LabelListTab
            icon={<Tag className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />}
            placeholder={t("explore.searchVarieties")}
            emptyHint={t("explore.noVarietiesMatch")}
            useListQuery={useVarietiesQuery}
          />
        </TabsContent>

        <TabsContent value="diseases">
          <LabelListTab
            icon={<Bug className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />}
            placeholder={t("explore.searchDiseases")}
            emptyHint={t("explore.noDiseasesMatch")}
            useListQuery={useDiseasesQuery}
          />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
