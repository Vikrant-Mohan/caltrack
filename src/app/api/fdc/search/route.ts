import { NextRequest } from "next/server";

/**
 * Same-origin proxy for the USDA FoodData Central food search.
 *
 * The FDC API key is read from the FDC_API_KEY environment variable
 * (see .env.local.example). Without a key the route returns an empty result
 * and the client falls back to OpenFoodFacts, so the app keeps working.
 */
export async function GET(req: NextRequest) {
  const apiKey = process.env.FDC_API_KEY;
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const pageSize = req.nextUrl.searchParams.get("page_size") ?? "20";

  if (!apiKey) {
    return Response.json({ foods: [], totalHits: 0, noApiKey: true });
  }

  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", pageSize);
  // Restrict to curated generic foods (per-100 g data) — branded foods from
  // FDC are per-serving and mostly duplicate OpenFoodFacts anyway.
  for (const dt of ["Foundation", "SR Legacy", "Survey (FNDDS)"]) {
    url.searchParams.append("dataType", dt);
  }
  // FDC's nginx rejects "+" in query strings (it is not decoded as a space),
  // so use %20-style encoding for multi-word dataType values. FDC also serves
  // intermittent HTTP 400s under load / rate limits, so retry with backoff
  // before giving up.
  const href = url.toString().replace(/\+/g, "%20");

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
    try {
      const res = await fetch(href, {
        headers: {
          Accept: "application/json",
          "User-Agent": "CalTrack/0.1 (free calorie tracker)",
        },
        // FDC changes rarely; cache upstream responses for an hour.
        next: { revalidate: 3600 },
      });
      if (res.ok) {
        const body = await res.json();
        return Response.json(body, {
          headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
        });
      }
      // 4xx here is usually a transient gateway hiccup, not a bad request.
    } catch {
      // Network error — retry.
    }
  }

  // Last resort: drop the dataType filters entirely. FDC still answers with
  // useful (mostly branded) foods, which the client dedupes against OFF.
  try {
    url.searchParams.delete("dataType");
    const fallback = url.toString().replace(/\+/g, "%20");
    const res = await fetch(fallback, {
      headers: {
        Accept: "application/json",
        "User-Agent": "CalTrack/0.1 (free calorie tracker)",
      },
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const body = await res.json();
      return Response.json(body, {
        headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
      });
    }
  } catch {
    // Fall through to the error response.
  }

  return Response.json(
    {
      foods: [],
      totalHits: 0,
      error: "USDA FoodData Central is temporarily unavailable.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}