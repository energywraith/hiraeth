// What each hotspot shows in the overlay when clicked, keyed by Hotspot.id
// (see ./config.ts). Placeholder flavor text — edit freely, this is the
// only file you need to touch to change what the room "says" when clicked.
export interface HotspotContent {
  title: string;
  body: string;
}

export const HOTSPOT_CONTENT: Record<string, HotspotContent> = {
  "poster-moon": {
    title: "Moon phases",
    body: "<p>A moon phase chart, curling at the corners. Blu-tacked up sometime in third grade and never taken down.</p>",
  },
  "poster-chart": {
    title: "Star chart",
    body: "<p>A constellation map, mostly memorized by now. The pushpin holding it up is slightly rusted.</p>",
  },
  "poster-map": {
    title: "Moon map",
    body: "<p>A printed lunar surface map — every crater labeled in tiny type nobody's actually read.</p>",
  },
  computer: {
    title: "The computer",
    body: "<p>An old beige tower, humming quietly. The screen's been showing the same thing for years.</p>",
  },
  "floppy-disk-1": {
    title: "Floppy disk",
    body: "<p>Unlabeled. Could be anything — homework, a game, a mixtape of MIDI files.</p>",
  },
  "floppy-disk-2": {
    title: "Floppy disk",
    body: "<p>A sliver of masking tape still clings to it, where a label used to be.</p>",
  },
  "floppy-disk-3": {
    title: "Floppy disk",
    body: "<p>The write-protect tab snapped off years ago. Nobody remembers why.</p>",
  },
  "floppy-disk-4": {
    title: "Floppy disk",
    body: "<p>The good one — the one that actually still boots.</p>",
  },
  telescope: {
    title: "Telescope",
    body: "<p>Pointed at the moon, same as every clear night. The finder scope's been slightly misaligned for years.</p>",
  },
  moon: {
    title: "The moon",
    body: "<p>Full tonight. Close enough through the glass to make out the maria.</p>",
  },
};
