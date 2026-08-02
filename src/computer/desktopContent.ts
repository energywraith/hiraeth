// What's on the desktop once you're "up close" to the screen — the single
// source of truth for src/computer/desktopView.ts's icons and the window
// each one opens. Same pattern as ../hotspots/content.ts: the one file to
// touch to change what the computer "says" when clicked.
export interface DesktopIcon {
  id: string;
  label: string;
  /** Inline SVG markup (16x16 viewBox, `currentColor` fill/stroke) — a
   * small hand-drawn icon rather than a photo crop, to match the
   * light-phosphor "positive" CRT look (see .desktop-icon-art in
   * style.css). Kept inline rather than as image assets: no new binary to
   * manage, and it inherits the screen's ink color for free. */
  glyph: string;
  windowTitle: string;
  /** HTML shown in the opened window — `<b>` labels a field, the rest is
   * its value (see .desktop-window-body's field-row styling). */
  body: string;
}

export const DESKTOP_ICONS: DesktopIcon[] = [
  {
    id: "observations",
    label: "OBSERVATIONS",
    glyph: `<svg viewBox="0 0 16 16"><polygon points="2,13 8,15 14,13" fill="none" stroke="currentColor" stroke-width="1"/><line x1="8" y1="15" x2="8.5" y2="8.5" stroke="currentColor" stroke-width="1"/><rect x="7.7" y="5.6" width="7.4" height="2.2" transform="rotate(-32 7.7 5.6)" fill="currentColor"/><circle cx="7.3" cy="6.3" r="1.7" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="12.5" cy="2.3" r="0.5" fill="currentColor"/><circle cx="2.5" cy="4" r="0.4" fill="currentColor"/></svg>`,
    windowTitle: "OBSERVATION LOG",
    body: "<p><b>TARGET</b> THE MOON</p><p><b>TIME</b> 23:47</p><p><b>SKY</b> CLEAR</p>",
  },
  {
    id: "galaxies",
    label: "GALAXIES",
    glyph: `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="1.3" fill="currentColor"/><path d="M8 8 C 11 6.5, 13 9, 10.5 11.5 C 8 13.5, 4 12, 4.5 8.5" fill="none" stroke="currentColor" stroke-width="1"/><path d="M8 8 C 5 9.5, 3 7, 5.5 4.5 C 8 2.5, 12 4, 11.5 7.5" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="2.5" cy="2.5" r="0.5" fill="currentColor"/><circle cx="13.5" cy="13" r="0.5" fill="currentColor"/><circle cx="13" cy="3" r="0.4" fill="currentColor"/></svg>`,
    windowTitle: "DEEP SKY CATALOG",
    body: "<p><b>M31</b> ANDROMEDA, 2.5M LY</p><p><b>M33</b> TRIANGULUM, 2.7M LY</p><p><b>M81</b> BODE'S, 12M LY</p>",
  },
  {
    id: "solar-system",
    label: "SOLAR SYSTEM",
    glyph: `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="3.2" fill="currentColor"/><ellipse cx="8" cy="8" rx="7" ry="1.8" fill="none" stroke="currentColor" stroke-width="1"/></svg>`,
    windowTitle: "SOLAR SYSTEM",
    body: "<p><b>MERCURY</b> 0.39 AU</p><p><b>VENUS</b> 0.72 AU</p><p><b>SATURN</b> 9.58 AU</p>",
  },
  {
    id: "apollo",
    label: "APOLLO MISSION",
    glyph: `<svg viewBox="0 0 16 16"><polygon points="8,2 5,5.5 11,5.5" fill="currentColor"/><rect x="5" y="5.5" width="6" height="4.5" fill="currentColor"/><line x1="5.5" y1="10" x2="2.5" y2="14" stroke="currentColor" stroke-width="1"/><line x1="10.5" y1="10" x2="13.5" y2="14" stroke="currentColor" stroke-width="1"/><line x1="6.5" y1="10" x2="5.5" y2="14" stroke="currentColor" stroke-width="1"/><line x1="9.5" y1="10" x2="10.5" y2="14" stroke="currentColor" stroke-width="1"/><rect x="1.5" y="14" width="2" height="1" fill="currentColor"/><rect x="12.5" y="14" width="2" height="1" fill="currentColor"/></svg>`,
    windowTitle: "MISSION DATA",
    body: "<p><b>DATE</b> 07.20.1969</p><p><b>SITE</b> SEA OF TRANQUILITY</p><p><b>STATUS</b> THE EAGLE HAS LANDED</p>",
  },
];
