# Company sources

`npm run pipeline` (or `npm run pipeline:watch`) reads every source, merges companies (by Lusha id, otherwise by name without legal form plus city or postcode), scores them and writes `data/results/scored.json`. Everything under `data/` is git-ignored.

| Source | Where | What it gives |
|---|---|---|
| Lusha company search | API, when `LUSHA_API_KEY` is set (see `docs/lusha.md`) | name, domain, city, staff count |
| Needle lead list | `data/raw/needle/leads.csv` (copy the export there) | name, domain, city, headcount, LinkedIn company page, Lusha id. Only rows in Berlin/Brandenburg unless `NEEDLE_ALL_REGIONS=1`; person names, emails and phones are not read |
| Guild exports | every CSV in `data/raw/innung/` | name, street, postcode, city, phone, website, staff if present. German or English headers; the file name is the guild name |
| SHK directory Brandenburg | https://www.brandenburg-shk.de/de/firmensuche/ | name, street, postcode, city and guild for about 380 member businesses in 13 guilds |

## The directory scrape
- robots.txt (`Disallow: /admin/`, `/de/admin/`) allows the search page; the site's terms contain no scraping ban.
- One GET plus one POST per guild, three seconds apart, user agent `ACV-Router/0.1 (GoToSpook, github.com/luajosman/GoToSpook)`. Only the result list is read, never the detail pages with contact data. Pages are cached for `SCRAPE_CACHE_DAYS` (7); `npm run pipeline -- --rescore` uses the cache without any request. Turn it off with `SCRAPE_BRANDENBURG_SHK=0`.
- The site's imprint forbids using published contact data to send unsolicited information. Letters and calls to these companies need a legal check first.
- The Berlin guild has no members in this directory. The national SHK search (wasserwaermeluft.de) is not used: its terms forbid reading out the data for commercial use.

## Without a team size
Guild entries have no headcount. Following the brief, such companies are estimated as small from their legal form and website (low confidence, with the reason in the evidence), and the High-touch threshold never drops below `MIN_THRESHOLD` (default €6,000), so unmeasured companies go to Automated until a source adds their size.
