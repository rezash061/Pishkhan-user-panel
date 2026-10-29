import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "پیشخوان",
    short_name: "پیشخوان",
    description: "دایرکت‌ها، پاسخ خودکار و فروش اینستاگرام در یک جا.",
    lang: "fa",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbfbfd",
    theme_color: "#6a3fd0",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "دایرکت‌ها", short_name: "دایرکت", url: "/?go=inbox", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] }],
  };
}
