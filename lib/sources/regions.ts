/** Is a place in the niche (Berlin and Brandenburg)? Used to filter wide lists like the Needle CSV. */

const STATES = new Set(["berlin", "brandenburg"]);

const BRANDENBURG_TOWNS = [
  "potsdam", "cottbus", "brandenburg an der havel", "frankfurt (oder)", "frankfurt oder", "oranienburg", "falkensee",
  "eberswalde", "bernau", "bernau bei berlin", "königs wusterhausen", "fürstenwalde", "neuruppin", "schwedt",
  "senftenberg", "strausberg", "ludwigsfelde", "teltow", "hennigsdorf", "rathenow", "spremberg", "prenzlau",
  "finsterwalde", "wittenberge", "luckenwalde", "zossen", "werder", "werder (havel)", "kleinmachnow",
  "blankenfelde-mahlow", "hoppegarten", "erkner", "velten", "stahnsdorf", "wildau", "schönefeld", "panketal",
  "hohen neuendorf", "glienicke", "michendorf", "beelitz", "jüterbog", "lübben", "lübbenau", "guben", "forst",
  "eisenhüttenstadt", "angermünde", "templin", "perleberg", "kyritz", "wittstock", "gransee", "zehdenick",
  "nauen", "dallgow-döberitz", "schwielowsee", "mittenwalde", "rangsdorf", "fredersdorf-vogelsdorf", "neuenhagen",
];

/** Postcode ranges of Berlin (10115–14199) and Brandenburg. */
const ZIP_RANGES: Array<[number, number]> = [
  [1940, 1998],
  [3000, 3253],
  [4895, 4938],
  [10115, 16949],
  [17268, 17291],
  [19300, 19357],
];

export function inNiche(place: { state?: string; city?: string; zip?: string }): boolean {
  const state = place.state?.trim().toLowerCase();
  if (state && STATES.has(state)) return true;
  const city = place.city?.trim().toLowerCase() ?? "";
  if (city === "berlin" || city.startsWith("berlin-") || city.startsWith("berlin ")) return true;
  if (BRANDENBURG_TOWNS.some((t) => city === t || city.startsWith(`${t} `))) return true;
  const zip = Number(place.zip?.trim());
  if (Number.isInteger(zip) && zip > 0) return ZIP_RANGES.some(([lo, hi]) => zip >= lo && zip <= hi);
  return false;
}
