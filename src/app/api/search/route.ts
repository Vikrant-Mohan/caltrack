import { NextRequest } from "next/server";
import { fetchOff } from "@/lib/off-proxy";

/**
 * Same-origin proxy for the OpenFoodFacts text-search endpoint.
 *
 * The upstream search endpoint does not send CORS headers, so browsers cannot
 * call it directly — fetching here lets the Next server make the request.
 * Multiple hosts are tried in order because the world.openfoodfacts.org front
 * has been serving intermittent 503s for search traffic.
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const pageSize = req.nextUrl.searchParams.get("page_size") ?? "30";

  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: pageSize,
  });

  try {
    const res = await fetchOff(`/cgi/search.pl?${params.toString()}`);
    const body = await res.json();
    return Response.json(body, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
    });
  } catch {
    return Response.json(
      {
        count: 0,
        products: [],
        error:
          "OpenFoodFacts search is temporarily unavailable. Please try again in a moment.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
