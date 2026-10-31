/**
 * Look up valid Lusha filter values before putting them into config.lusha.include.
 *   npm run lusha:filters -- locations Berlin
 *   npm run lusha:filters -- industriesLabels
 */
import { createLushaClient } from "../lib/connectors/lusha";

try {
  process.loadEnvFile(".env.local");
} catch {
  // reported below
}

const [filterType, ...rest] = process.argv.slice(2);
if (!filterType) {
  console.error("Usage: npm run lusha:filters -- <filterType> [query]");
  process.exit(2);
}

async function main() {
  try {
    const result = await createLushaClient().filterValues(filterType, rest.join(" ") || undefined);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

void main();
