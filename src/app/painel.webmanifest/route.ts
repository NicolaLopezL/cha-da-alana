/** Manifesto do app do painel: permite "Adicionar à Tela de Início" e notificações no iPhone. */
export function GET() {
  const manifest = {
    id: "/admin",
    name: "Chá da Alana — Painel",
    short_name: "Chá da Alana",
    description: "Confirmações e avisos do Chá da Alana",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf6f1",
    theme_color: "#faf6f1",
    lang: "pt-BR",
    icons: [
      { src: "/painel-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/painel-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/painel-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" },
  });
}
