import { quizPosterPdf } from "@/lib/server/quiz/poster";
import { quizUrl } from "@/lib/server/quiz/qr";

export async function GET() {
  const pdf = await quizPosterPdf(await quizUrl());
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="cartaz-quiz-da-alana.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
