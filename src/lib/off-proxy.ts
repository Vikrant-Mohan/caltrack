/**
 * Shared OpenFoodFacts proxy plumbing.
 *
 * OFF has two generations of hosts — world.openfoodfacts.org (legacy) and
 * world.openfoodfacts.net (newer canonical). The .org front has been serving
 * intermittent 503s for search traffic, so the proxies try hosts in order
 * until one answers with a clean JSON response.
 */

export const OFF_USER_AGENT = "CalTrack/0.1 (free calorie tracker)";

export const OFF_HOSTS = [
  "world.openfoodfacts.net",
  "fr.openfoodfacts.org",
  "world.openfoodfacts.org",
];

/**
 * Fetch an OFF API path (e.g. "/api/v2/product/123.json") from the first
 * healthy host. Throws when every host fails.
 */
export async function fetchOff(path: string): Promise<Response> {
  let lastError: unknown = null;
  for (const host of OFF_HOSTS) {
    try {
      const res = await fetch(`https://${host}${path}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": OFF_USER_AGENT,
        },
        // Long enough for the slowest host, short enough to fail over quickly.
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return res;
      lastError = new Error(`upstream ${host} -> HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
