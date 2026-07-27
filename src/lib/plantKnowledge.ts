// Curated plant-care knowledge base: answers common questions (watering,
// light, toxicity, soil, pests, propagation, humidity, fertilizing) without
// depending on a paid AI API. Matched by keyword against the user's
// question — a free, deterministic alternative to an LLM for factual
// plant-care basics. For symptom diagnosis on a specific garden plant,
// ai-doctor.server.ts (Claude) still handles that when configured; this
// covers the general-question gap it doesn't.

export type KnowledgeTopic = {
  id: string;
  keywords: RegExp;
  answer: string;
};

export const PLANT_KNOWLEDGE_BASE: KnowledgeTopic[] = [
  {
    id: "watering-frequency",
    keywords: /\bhow (often|frequently)\b.*\bwater|\bwater\b.*\bhow (often|frequently)|\bwatering (schedule|frequency)\b/i,
    answer:
      "Most houseplants want the top 1–2 inches of soil to dry out between waterings — check by pressing a finger into the soil rather than watering on a fixed schedule. Succulents and cacti need much less (every 2–3 weeks), while tropical foliage plants like pothos or monstera usually want water every 7–10 days. Overwatering (soggy, always-wet soil) kills more houseplants than underwatering.",
  },
  {
    id: "overwatering-signs",
    keywords: /\b(overwater|over-water|too much water|soggy|root rot)\b/i,
    answer:
      "Signs of overwatering: yellowing leaves that feel soft or mushy (not crispy), a musty smell from the soil, mold on the surface, and roots that look brown/black and mushy instead of white and firm. Let the soil dry out fully, check for root rot by gently removing the plant from its pot, and trim away any mushy roots. Make sure the pot has drainage holes.",
  },
  {
    id: "underwatering-signs",
    keywords: /\b(underwater|under-water|too little water|not enough water)\b/i,
    answer:
      "Signs of underwatering: dry, crispy brown leaf edges or tips, drooping/wilting leaves that perk back up soon after watering, and soil that pulls away from the pot's edges. Water thoroughly until it drains from the bottom, then let it dry appropriately before the next watering.",
  },
  {
    id: "light-needs",
    keywords: /\b(light|sun|sunlight|window|shade)\b.*\b(need|require|best|how much)|\bhow much (light|sun)\b/i,
    answer:
      "Most common houseplants (pothos, philodendron, peace lily, ZZ plant) do best in bright, indirect light — near a window but not in direct sun, which can scorch leaves. Succulents and cacti want several hours of direct sun. Low-light tolerant options include snake plant, ZZ plant, and pothos, though they'll still grow faster with more light.",
  },
  {
    id: "toxicity",
    keywords: /\b(toxic|poison|safe|dangerous)\b.*\b(pet|cat|dog|child|kid)|\bis\b.*\btoxic\b/i,
    answer:
      "Toxicity varies a lot by species — common toxic-to-pets plants include pothos, monstera, philodendron, and peace lily (mouth/throat irritation if chewed), while spider plants, Boston ferns, and most succulents like haworthia are generally pet-safe. Always check the specific species — ask me about a plant by name and I'll look up what's known, or check the ASPCA's toxic/non-toxic plant list for a definitive answer.",
  },
  {
    id: "yellow-leaves-general",
    keywords: /\byellow(ing)?\s+leaves?\b|\bleaves?\b.*\byellow(ing)?\b/i,
    answer:
      "Yellow leaves usually mean one of: overwatering (most common — soft, wilty yellow leaves), underwatering (dry, crispy yellow leaves), too little light, or natural aging of older lower leaves (normal, nothing to worry about if it's just one or two). Check the soil moisture first — that's the most common cause.",
  },
  {
    id: "brown-tips",
    keywords: /\bbrown\s+(tips?|edges?)\b/i,
    answer:
      "Brown, crispy leaf tips are most often caused by low humidity, inconsistent watering, or a buildup of salts/minerals from tap water and fertilizer. Try watering with filtered or distilled water, increase humidity (pebble tray or humidifier), and flush the soil thoroughly every few months to clear mineral buildup.",
  },
  {
    id: "humidity",
    keywords: /\bhumidity\b/i,
    answer:
      "Tropical plants (monstera, calathea, ferns, orchids) generally want 50-60%+ humidity — well above most indoor homes, especially in winter with heating on. Raise humidity with a humidifier, a pebble tray with water under the pot (not touching it), or grouping plants together. Misting helps only briefly and isn't a real long-term fix.",
  },
  {
    id: "pests",
    keywords: /\b(pests?|bugs?|insects?|mealybugs?|spider mites?|aphids?|scale|gnats?)\b/i,
    answer:
      "Common houseplant pests: spider mites (fine webbing, speckled leaves — thrive in dry air), mealybugs (white cottony clumps in leaf joints), scale (small brown bumps on stems), and fungus gnats (tiny flies from overly wet soil). Treat most with insecticidal soap or neem oil sprayed on all leaf surfaces weekly for a few weeks. For fungus gnats, let the soil dry out more between waterings — they breed in constantly damp soil.",
  },
  {
    id: "soil",
    keywords: /\b(what|which|best)\s+soil\b|\bsoil\s+(type|mix|should)\b|\bpotting mix\b/i,
    answer:
      "Most houseplants do well in a well-draining general potting mix. Succulents/cacti need a gritty, fast-draining mix (potting soil + perlite or sand). Orchids need a chunky bark-based mix, not regular soil. Adding perlite to any mix improves drainage and prevents root rot — a good default if you're unsure.",
  },
  {
    id: "propagation",
    keywords: /\bpropagat/i,
    answer:
      "Most vining plants (pothos, philodendron, monstera) propagate easily from stem cuttings with at least one node — place in water until roots form (a few weeks), then pot in soil. Succulents often propagate from a leaf laid on top of soil until it roots. Snake plants can be propagated by leaf cuttings or division at the root.",
  },
  {
    id: "fertilizing",
    keywords: /\bfertiliz|feed(ing)?\b.*\bplant/i,
    answer:
      "Fertilize most houseplants during active growth (spring/summer) every 4-6 weeks with a balanced liquid fertilizer diluted to half strength — full strength can burn roots. Skip fertilizing in fall/winter when growth naturally slows. Never fertilize a totally dry or stressed plant.",
  },
  {
    id: "repotting",
    keywords: /\brepot|repotting|new pot\b/i,
    answer:
      "Repot when roots are circling the pot, growing out of drainage holes, or the plant dries out unusually fast after watering — typically every 1-2 years for actively growing plants. Size up by only 1-2 inches in diameter; too large a jump holds excess moisture and risks root rot.",
  },
  {
    id: "leggy-stretching",
    keywords: /\bleggy|stretch(ing)?|sparse\b/i,
    answer:
      "Leggy growth (long gaps between leaves, plant leaning toward light) almost always means not enough light. Move it closer to a bright window or add a grow light. You can also prune leggy stems to encourage bushier new growth.",
  },
  {
    id: "leaf-drop",
    keywords: /\b(dropping|drops?|shedding|falling off|losing)\b.*\bleaves?\b|\bleaves?\b.*\b(dropping|falling|fell)\b/i,
    answer:
      "Leaf drop is usually a stress response to a recent change — overwatering/underwatering, a sudden move to a different light level or temperature, cold drafts, or transplant shock. It's normal to lose a few leaves after moving a plant or bringing it home; give it a few weeks to settle before changing care. If it's dropping many leaves rapidly, check the soil moisture first — that's the most common cause.",
  },
  {
    id: "wilting-drooping",
    keywords: /\b(wilt(ing)?|drooping|droopy|limp|sagging)\b/i,
    answer:
      "Wilting/drooping can mean either underwatering (soil is dry, leaves perk up within a day of watering) or overwatering (soil is wet, roots are suffocating/rotting, leaves stay droopy even after watering). Check the soil first: if it's bone dry, water thoroughly; if it's already wet, hold off and check the roots for rot.",
  },
  {
    id: "curling-leaves",
    keywords: /\bcurl(ing|ed)?\s+leaves?\b|\bleaves?\b.*\bcurl(ing|ed)?\b/i,
    answer:
      "Curling leaves are commonly caused by underwatering, low humidity, too much direct sun/heat, or occasionally pests (check the undersides of leaves for mites or bugs first). Check soil moisture and light exposure before assuming pests.",
  },
  {
    id: "root-bound",
    keywords: /\broot[\s-]?bound|\broots?\b.*\b(coming out|growing out|circling)\b/i,
    answer:
      "A plant is root-bound when roots fill the pot and start circling or growing out of the drainage holes — you'll also notice it drying out much faster than usual between waterings. Repot into a container 1-2 inches larger in diameter, gently loosening circled roots first so they grow outward instead of continuing to spiral.",
  },
  {
    id: "dormancy-winter",
    keywords: /\bdorman(t|cy)|\bwinter\b.*\b(care|water|grow|normal)|\bgrowth\b.*\bslow|\bslow(ed|ing)?\s+growth\b/i,
    answer:
      "Most houseplants slow down or go semi-dormant in fall/winter due to shorter days and less light — this is normal, not a problem. Water less often (the soil stays moist longer with less growth pulling water), stop fertilizing, and don't worry if growth pauses until spring.",
  },
  {
    id: "drainage",
    keywords: /\bdrainage\b|\bdrainage holes?\b|\bpot\b.*\bhole/i,
    answer:
      "Drainage holes matter — a pot without them traps water at the bottom, which is one of the most common causes of root rot even if you're watering correctly. If your decorative pot has no holes, keep the plant in a plastic nursery pot with holes and set that inside the decorative one, removing it to drain after watering.",
  },
  {
    id: "mold-fungus-soil",
    keywords: /\bmold\b|\bfung(us|al)\b.*\bsoil|\bwhite\s+(fuzz|stuff)\b.*\bsoil/i,
    answer:
      "White fuzzy mold on top of the soil is usually a harmless saprophytic fungus caused by overly damp, poorly ventilated soil — not usually a threat to the plant itself, but a sign you're watering too often or the pot lacks airflow/drainage. Scrape off the top layer, let the soil dry out more between waterings, and improve air circulation.",
  },
  {
    id: "tap-water",
    keywords: /\btap\s+water\b|\bfiltered\s+water\b|\bdistilled\s+water\b|\bwater\s+type\b/i,
    answer:
      "Most plants tolerate regular tap water fine. Sensitive plants (calathea, dracaena, spider plants) can react to chlorine/fluoride with brown tips — if that's happening, let tap water sit out uncovered for 24 hours before using it, or switch to filtered/distilled water.",
  },
  {
    id: "misting",
    keywords: /\bmist(ing)?\b/i,
    answer:
      "Misting gives a brief, small humidity boost that fades within minutes — it's not an effective long-term way to raise humidity. For a real difference, use a humidifier, a pebble tray with water under (not touching) the pot, or group humidity-loving plants together.",
  },
];

export function findKnowledgeAnswer(question: string): string | undefined {
  const match = PLANT_KNOWLEDGE_BASE.find((topic) => topic.keywords.test(question));
  return match?.answer;
}
