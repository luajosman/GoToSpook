# Lusha: what the pipeline calls

Source: Lusha's public API docs, read on 2026-10-31. Pages: https://docs.lusha.com/ (overview), https://docs.lusha.com/api-reference/prospecting/prospecting-companies.md, https://docs.lusha.com/filters/company-filters.md, https://docs.lusha.com/api-reference/filters/get-company-filter-values.md, https://docs.lusha.com/api-reference/account/get-account-usage.md.

## Basics
- Base URL `https://api.lusha.com/v3/`, HTTPS, JSON.
- Auth: header `api_key: <LUSHA_API_KEY>` on every call, server-side only.
- Errors: 400 malformed, 401 missing or invalid key, 402 insufficient credits, 403 account inactive, 429 rate limit or daily quota, 5xx retry with exponential backoff. Body: `{ "statusCode": 400, "message": "…" }`.
- Rate limits vary by plan and are reported in `x-*-requests-left` headers.
- Data from the API may not be used to train or develop AI/ML systems.

## Calls we make

### Company search: `POST /v3/companies/prospecting`
```jsonc
{
  "pagination": { "page": 0, "size": 25 },           // page 0–1000, size 10–100
  "filters": { "companies": { "include": {
    "locations": [ { "country": "Germany", "state": "Berlin" } ],
    "keywords": ["Heizung", "Sanitär"],                // free-text keywords
    "sizes": [ { "min": 1, "max": 200 } ]
  } } }
}
```
Response: `pagination { page, size, total }`, `results[]` with `id`, `name`, `domain`, `employeeCount { exact | min, max }`, `industry`, `location { city, state, country, countryIso2 }`, `socialLinks.linkedin`; `billing { creditsCharged, resultsReturned }`. Charged per result (`api_search`). Results paginate up to 50,000.

### Filter values: `GET /v3/companies/prospecting/filters/{filterType}?query=…`
`filterType` is one of `names, sizes, revenues, locations, sics, naics, industriesLabels, intentTopics, technologies`; `query` (2–256 chars) is required for `names, technologies, locations`. Response `{ values, total, truncated }`. "Passing values outside the API's taxonomy causes searches to return no results", so check location values with:

```bash
npm run lusha:filters -- locations Berlin
```

### Credits: `GET /v3/account/usage`
`credits { total, used, remaining }`, `rateLimits`, `plan`, and `pricing` (action → `{ credits, perQuantity }`). Limited to 5 requests per minute. The pipeline reads it before spending and uses `pricing.api_search` when present, otherwise assumes 1 credit per result.

## Not verified yet
- The exact shape of a `locations` value (the docs give no example). The default filter in `lib/config.ts` follows the prospecting example `{ "country": … }` with `state`; confirm with the command above on the first live run.
- The price per search result on our plan (read live from `/v3/account/usage`).
- Enrichment (`POST /v3/companies/enrich`) is not used: it costs per revealed field and the search preview already has name, domain, size and location.
