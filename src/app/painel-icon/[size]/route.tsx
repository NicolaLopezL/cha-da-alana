import { ImageResponse } from "next/og";

/** Ícone do app do painel (tela de início do celular). Desenhado na hora, sem arquivos binários. */
const SIZES = new Set([96, 180, 192, 512]);

export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size: raw } = await ctx.params;
  const size = Number(raw);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  const heart = Math.round(size * 0.5);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #fcf4f2 0%, #efcfcf 100%)",
        }}
      >
        <svg width={heart} height={heart} viewBox="0 0 24 24">
          <path
            fill="#9c6266"
            d="M12 21s-8.5-5.2-8.5-11.5A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 2.9C20.5 15.8 12 21 12 21Z"
          />
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
