import { promises as fs } from "node:fs";
import path from "node:path";
import { isSupabaseConfigured } from "@/lib/server/env";
import { localDataDir } from "@/lib/server/store/local";

/** Serve arquivos enviados no modo local (em produção as mídias ficam no Supabase Storage). */
const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
};

export async function GET(_req: Request, ctx: RouteContext<"/api/media/[file]">) {
  if (isSupabaseConfigured()) return new Response("Not found", { status: 404 });
  const { file } = await ctx.params;
  const name = path.basename(decodeURIComponent(file));
  const type = TYPES[path.extname(name).toLowerCase()];
  if (!type || !/^[\w.-]+$/.test(name)) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(path.join(localDataDir(), "media", name));
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
