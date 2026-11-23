import { quizQrPng, quizUrl } from "@/lib/server/quiz/qr";

export async function GET() {
  const png = await quizQrPng(await quizUrl());
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": 'attachment; filename="qr-code-quiz-da-alana.png"',
      "Cache-Control": "no-store",
    },
  });
}
