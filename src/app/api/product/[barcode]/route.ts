import { NextRequest } from "next/server";
import { fetchOff } from "@/lib/off-proxy";

/**
 * Same-origin proxy for the OpenFoodFacts barcode endpoint so the browser can
 * look up scanned products without CORS issues. Falls back across OFF hosts
 * (world.openfoodfacts.org has been intermittently returning 503s).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ barcode: string }> },
) {
  const { barcode } = await params;
  const path = `/api/v2/product/${encodeURIComponent(barcode)}.json`;

  try {
    const res = await fetchOff(path);
    const body = await res.json();
    return Response.json(body, {
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch {
    return Response.json(
      {
        status: 0,
        status_verbose:
          "OpenFoodFacts is temporarily unavailable. Please try again in a moment.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
