import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Performance OS",
    short_name: "Performance",
    description: "Plan, execute, track, review, improve.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f8fa",
    theme_color: "#f7f8fa",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
