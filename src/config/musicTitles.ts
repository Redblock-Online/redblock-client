// Mapping of internal track identifiers / filenames to display titles.
// Keep keys in lowercase to match how tracks are referenced in the code.
export const MUSIC_TRACK_TITLES: Record<string, string> = {
  // calm playlist
  // -------------
  // canonical internal id (matches PLAYLISTS in UIRoot.tsx)
  uncausal: "unCasual",
  voices: "Voices",

  // energy playlist
  // ---------------
  signal: "Signal",

  // test songs
  test1: "song_test1",
  test2: "song_test2",
  test3: "song_test3",
};

/**
 * Return a human-friendly title for a track identifier (or null if none supplied).
 */
export function getTrackTitle(
  trackName: string | null | undefined
): string | null {
  if (!trackName) return null;

  // Normalize input: strip query/hash, take basename, remove extension
  let name = String(trackName);
  name = name.split(/[?#]/)[0]; // remove query params or fragments
  const parts = name.split(/[/\\]/); // split on / or \ for paths
  let base = parts[parts.length - 1] || name;
  base = base.replace(/\.[^.]+$/, ""); // remove extension like .ogg
  const key = base.toLowerCase();
  const musicMapped = MUSIC_TRACK_TITLES[key];

  if (musicMapped) return musicMapped;

  // Fallback: humanize the base name (replace separators, title-case words)
  const human = base
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!human) return base;

  const title = human
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return title;
}

export default MUSIC_TRACK_TITLES;
