/**
 * Runs the Lusha pipeline once, or continuously with --watch.
 *   npm run pipeline                    one run
 *   npm run pipeline -- --watch         every LUSHA_WATCH_MINUTES (default 60)
 *   npm run pipeline -- --watch --every 30 --max-credits 20
 *   npm run pipeline -- --rescore       no Lusha calls, just score what is stored
 */
import { config } from "../lib/config";
import { createLushaClient, LushaApiError, LushaNotConfiguredError, type LushaClient } from "../lib/connectors/lusha";
import { runPipeline } from "../lib/pipeline";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: the client reports the missing key
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const watch = process.argv.includes("--watch");
const rescore = process.argv.includes("--rescore");
const everyMinutes = Number(flag("every") ?? config.lusha.watchMinutes);
const maxCredits = flag("max-credits") !== undefined ? Number(flag("max-credits")) : undefined;

function stamp(line: string) {
  console.log(`[${new Date().toLocaleTimeString("en-GB")}] ${line}`);
}

async function once(): Promise<boolean> {
  let client: LushaClient | null = null;
  if (!rescore) {
    try {
      client = createLushaClient();
    } catch (error) {
      if (error instanceof LushaNotConfiguredError) {
        stamp(error.message);
        return false;
      }
      throw error;
    }
  }
  try {
    const s = await runPipeline({ client, maxCredits, log: stamp });
    stamp(
      `Done: ${s.pagesFetched} pages fetched, ${s.pagesFromCache} from cache, ${s.creditsSpent} credits spent` +
        `${s.creditsRemaining !== null ? ` (${s.creditsRemaining} left)` : ""}, ${s.newCompanies} new, ${s.companiesKnown} known` +
        `${s.totalInSearch !== null ? ` of ${s.totalInSearch} in the search` : ""}, ${s.companiesScored} scored, ${s.skipped} without a staff count. Stopped: ${s.stoppedBecause}.`,
    );
    if (s.resultsPath) stamp(`Wrote ${s.resultsPath}`);
    return true;
  } catch (error) {
    if (error instanceof LushaApiError) {
      stamp(`Lusha error ${error.status}: ${error.message}`);
      return error.status !== 401 && error.status !== 403;
    }
    throw error;
  }
}

async function main() {
  const ok = await once();
  if (!watch) process.exit(ok ? 0 : 1);
  if (!ok) {
    stamp("Not watching: fix the error above first.");
    process.exit(1);
  }
  stamp(`Watching: next run in ${everyMinutes} minutes. Ctrl+C to stop.`);
  const timer = setInterval(async () => {
    const good = await once().catch((error: unknown) => {
      stamp(`Run failed: ${error instanceof Error ? error.message : String(error)}`);
      return true;
    });
    if (!good) {
      clearInterval(timer);
      process.exit(1);
    }
    stamp(`Next run in ${everyMinutes} minutes.`);
  }, everyMinutes * 60 * 1000);
  process.on("SIGINT", () => {
    clearInterval(timer);
    stamp("Stopped.");
    process.exit(0);
  });
}

void main();
