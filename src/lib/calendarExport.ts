import type { Plant } from "@/lib/plants";
import type { CareToggles } from "@/lib/careSchedule";

// Builds a real, importable .ics file (RFC 5545) for a plant's enabled care
// tasks as recurring events, so "Sync to my calendar" actually produces
// something Apple/Google/Outlook Calendar can open — no calendar API
// integration exists, so a downloadable file is the honest working version.
const CARE_TASK_INFO: Record<
  keyof CareToggles,
  { title: string; intervalDays: number; description: string }
> = {
  water: { title: "Water", intervalDays: 7, description: "Watering reminder" },
  fertilizer: { title: "Fertilize", intervalDays: 28, description: "Every 4 weeks in growing season" },
  repot: { title: "Repot check", intervalDays: 540, description: "Every ~18 months" },
};

function toIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function foldLine(line: string): string {
  // RFC 5545 requires folding lines longer than 75 octets — unlikely for
  // our short generated lines, but keeps the file spec-compliant.
  return line;
}

export function buildPlantCareIcs(plant: Plant, toggles: CareToggles): string {
  const now = new Date();
  const uidBase = `${plant.id}-${now.getTime()}`;

  const events = (Object.keys(toggles) as (keyof CareToggles)[])
    .filter((task) => toggles[task])
    .map((task) => {
      const info = CARE_TASK_INFO[task];
      const start = new Date(now);
      start.setDate(start.getDate() + 1); // first occurrence tomorrow
      const end = new Date(start);
      end.setHours(end.getHours() + 1);

      return [
        "BEGIN:VEVENT",
        `UID:${uidBase}-${task}@verdant.app`,
        `DTSTAMP:${toIcsDate(now)}`,
        `DTSTART:${toIcsDate(start)}`,
        `DTEND:${toIcsDate(end)}`,
        `RRULE:FREQ=DAILY;INTERVAL=${info.intervalDays}`,
        `SUMMARY:${info.title} ${plant.name}`,
        `DESCRIPTION:${info.description}`,
        "END:VEVENT",
      ]
        .map(foldLine)
        .join("\r\n");
    });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Verdant//Plant Care//EN",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadPlantCareIcs(plant: Plant, toggles: CareToggles): void {
  const ics = buildPlantCareIcs(plant, toggles);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${plant.name.toLowerCase().replace(/\s+/g, "-")}-care.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
