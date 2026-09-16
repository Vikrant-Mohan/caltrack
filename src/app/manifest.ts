import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CalTrack — Free Calorie Tracker",
    short_name: "CalTrack",
    description:
      "A free, mobile-first calorie tracker: log meals by search or barcode, hit your macro goals, and check in your weight.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f0f7f4",
    theme_color: "#00b06b",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
