import type { Plant, TimelineEntry } from "@/lib/plants";

// Builds a print-friendly HTML document for a plant's full care history —
// profile + growth timeline — and opens it in a new tab so the browser's
// native print dialog ("Save as PDF") produces the actual file. No PDF
// library needed: every browser already ships a PDF-capable print engine,
// and this keeps the export honest about being a formatted printout rather
// than a pixel-perfect design document.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function entryRow(entry: TimelineEntry): string {
  return `
    <tr>
      <td>${escapeHtml(entry.date)}</td>
      <td>${escapeHtml(entry.headline)}</td>
      <td>${entry.health}%</td>
      <td>${escapeHtml(entry.detail)}</td>
    </tr>`;
}

export function buildCareHistoryHtml(plant: Plant): string {
  const generated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(plant.name)} — Care History</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1a1a1a; margin: 2.5rem; }
  h1 { font-size: 1.6rem; margin-bottom: 0.15rem; }
  .scientific { font-style: italic; color: #666; margin: 0 0 1.5rem; }
  .meta { color: #666; font-size: 0.85rem; margin-bottom: 2rem; }
  .care-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem 2rem; margin-bottom: 2rem; }
  .care-item dt { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: #888; }
  .care-item dd { margin: 0.15rem 0 0; font-size: 0.95rem; }
  h2 { font-size: 1.15rem; margin-top: 2rem; border-bottom: 1px solid #ddd; padding-bottom: 0.4rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; }
  th, td { text-align: left; padding: 0.5rem 0.6rem; font-size: 0.85rem; vertical-align: top; }
  th { border-bottom: 2px solid #333; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.04em; color: #555; }
  tr:not(:last-child) td { border-bottom: 1px solid #eee; }
  @media print {
    body { margin: 1.2cm; }
    @page { margin: 1.5cm; }
  }
</style>
</head>
<body>
  <h1>${escapeHtml(plant.name)}</h1>
  <p class="scientific">${escapeHtml(plant.scientific)}</p>
  <p class="meta">Care history exported from Verdant on ${generated}</p>

  <dl class="care-grid">
    <div class="care-item"><dt>Watering</dt><dd>${escapeHtml(plant.water)}</dd></div>
    <div class="care-item"><dt>Sunlight</dt><dd>${escapeHtml(plant.sunlight)}</dd></div>
    <div class="care-item"><dt>Soil</dt><dd>${escapeHtml(plant.soil)}</dd></div>
    <div class="care-item"><dt>Toxicity</dt><dd>${escapeHtml(plant.toxicity)}</dd></div>
    <div class="care-item"><dt>Origin</dt><dd>${escapeHtml(plant.origin)}</dd></div>
    <div class="care-item"><dt>Current health</dt><dd>${plant.health}%</dd></div>
  </dl>

  <h2>Growth timeline</h2>
  <table>
    <thead>
      <tr><th>Date</th><th>Update</th><th>Health</th><th>Notes</th></tr>
    </thead>
    <tbody>
      ${plant.timeline.map(entryRow).join("")}
    </tbody>
  </table>
</body>
</html>`;
}

// Opens the printout in a new tab and triggers the print dialog once the
// document has rendered. Falls back to just leaving the tab open (no
// window.print) if popups are blocked, since the content is still there.
export function printCareHistory(plant: Plant): void {
  const html = buildCareHistoryHtml(plant);
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}
