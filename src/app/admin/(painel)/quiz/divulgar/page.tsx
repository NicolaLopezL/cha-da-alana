import { Panel } from "@/components/admin/parts";
import { CopyButton } from "@/components/admin/ui";
import { quizQrSvg, quizUrl } from "@/lib/server/quiz/qr";

const link = "inline-flex min-h-11 items-center rounded-xl border border-blush-300 px-4 text-sm font-semibold text-cocoa-700 hover:bg-blush-50";

export default async function QuizSharePage() {
  const url = await quizUrl();
  const svg = await quizQrSvg(url);
  return (
    <Panel title="🧸 QR Code do quiz" description="Mostre na televisão, imprima o cartaz ou envie o link. O endereço nunca muda.">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <div
          role="img"
          aria-label="QR Code para abrir o quiz"
          className="rounded-3xl border border-champagne-400/50 bg-white p-4 [&_svg]:block [&_svg]:h-56 [&_svg]:w-56"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="w-full min-w-0 flex-1">
          <p className="break-all rounded-xl bg-blush-50 px-4 py-3 font-mono text-sm text-cocoa-900" data-testid="quiz-link">
            {url}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <CopyButton text={url} label="Copiar link" className="!min-h-11 !text-sm" />
            <a href="/quiz/qr" target="_blank" rel="noopener" className={link}>
              Exibir em tela cheia ↗
            </a>
            <a href="/quiz/qr/png" download className={link} data-testid="qr-png">
              Baixar PNG
            </a>
            <a href="/quiz/qr/cartaz" download className={link} data-testid="qr-pdf">
              Baixar cartaz PDF
            </a>
          </div>
          <p className="mt-4 text-xs text-cocoa-500">
            O endereço vem da variável <code>SITE_URL</code> (domínio oficial). Se trocar de domínio, gere o cartaz de novo.
          </p>
        </div>
      </div>
    </Panel>
  );
}
