import { NextRequest } from "next/server";

/**
 * Same-origin proxy for the USDA FoodData Central per-food detail endpoint.
 *
 * Search responses don't include `foodPortions` (household measures like
 * "1 slice" = 29 g) for generic foods, but /v1/food/{id} does. The add-food
 * dialog fetches this lazily when the user opens a USDA food.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const apiKey = process.env.FDC_API_KEY;
  const { id } = await params;

  if (!apiKey) {
    return Response.json({ error: "FDC_API_KEY not configured" }, { status: 404 });
  }

  const url = `https://api.nal.usda.gov/fdc/v1/food/${encodeURIComponent(
    id,
  )}?api_key=${encodeURIComponent(apiKey)}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "CalTrack/0.1 (free calorie tracker)",
        },
        next: { revalidate: 604800 }, // Food details change rarely.
      });
      if (res.ok) {
        const body = await res.json();
        return Response.json(body, {
          headers: {
            "Cache-Control": "public, max-age=604800, s-maxage=604800",
          },
        });
      }
    } catch {
      // Transient network error — retry.
    }
  }

  return Response.json(
    { error: "USDA FoodData Central is temporarily unavailable." },
    { status: 502, headers: { "Cache-Control": "no-store" } },
  );
}