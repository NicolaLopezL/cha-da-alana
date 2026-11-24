"use client";

import { saveQuizConfigAction, setMysteryAction } from "@/app/admin/quiz-actions";
import type { AdminQuizState } from "@/lib/quiz/types";
import { Panel } from "../parts";
import { CopyButton } from "../ui";
import { btnClass, QuizStatusBadge, Switch, usePolled } from "./kit";

export function LiveControl({ initial, url }: { initial: AdminQuizState; url: string }) {
  const s = usePolled("/admin/quiz/dados", initial);
  const { live } = s;
  const set = (patch: Parameters<typeof saveQuizConfigAction>[0]) => saveQuizConfigAction(patch);
  const situation = !live.enabled
    ? "Desligado: quem abre o link vê que a transmissão está desligada."
    : s.status === "draft"
      ? "Ligado: o ranking aparece assim que o quiz abrir."
      : live.hidden && s.status !== "published"
        ? "Oculto: o público vê uma tela de suspense."
        : s.status === "published"
          ? "No ar com o resultado final."
          : live.mystery
            ? "No ar em modo misterioso: só vocês veem a classificação verdadeira, na Visão geral."
            : "No ar: o público vê a classificação provisória.";

  return (
    <div className="space-y-6">
      <Panel title="🏆 Ranking ao Vivo" description="Página pública, sem login, para a televisão, o projetor e os celulares.">
        <div className="flex flex-wrap items-center gap-3">
          <QuizStatusBadge status={s.status} />
          <p className="text-sm font-semibold text-cocoa-700" data-testid="live-situation">
            {situation}
          </p>
        </div>
        <p className="mt-4 break-all rounded-xl bg-blush-50 px-4 py-3 font-mono text-sm text-cocoa-900" data-testid="live-link">
          {url}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyButton text={url} label="Copiar link do ranking ao vivo" className="!min-h-11 !text-sm" />
          <a href={url} target="_blank" rel="noopener" className={btnClass("ghost")} data-testid="open-live">
            Abrir ranking ao vivo ↗
          </a>
          <a href={`${url}?tv=1`} target="_blank" rel="noopener" className={btnClass("primary")} data-testid="open-tv">
            Exibir na televisão ↗
          </a>
        </div>
      </Panel>

      <Panel title="Modo misterioso" description="Suspense na televisão e nos celulares, sem mexer na pontuação de ninguém.">
        <Switch
          testId="live-mystery"
          label="Modo misterioso"
          hint="Ligue e desligue quando quiser. Ao desligar, as telas fazem 3, 2, 1 e revelam a classificação verdadeira."
          checked={live.mystery}
          onChange={setMysteryAction}
        />
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-cocoa-700">
          <li>Os primeiros colocados ficam trocando de lugar, sempre bem próximos, e os pontos viram “???”.</li>
          <li>A posição mostrada entre eles é só suspense. A verdadeira continua em <strong>Visão geral</strong>.</li>
          <li>Para revelar o resultado oficial, use <strong>Publicar Resultados</strong>: funciona direto, mesmo com o modo ligado.</li>
        </ul>
      </Panel>

      <Panel title="Controles" description="Cada mudança vale na hora e chega às telas em poucos segundos.">
        <div className="grid gap-x-8 sm:grid-cols-2">
          <Switch testId="live-enabled" label="Transmissão ativada" hint="Liga ou desliga a página pública do ranking." checked={live.enabled} onChange={(v) => set({ liveEnabled: v })} />
          <Switch testId="live-hidden" label="Ocultar classificação temporariamente" hint="Mostra uma tela de suspense até a revelação final." checked={live.hidden} onChange={(v) => set({ liveHidden: v })} />
          <Switch testId="live-scores" label="Mostrar pontuações" checked={live.showScores} onChange={(v) => set({ liveShowScores: v })} />
          <Switch testId="live-progress" label="Mostrar progresso dos participantes" hint="Exemplo: 12/20." checked={live.showProgress} onChange={(v) => set({ liveShowProgress: v })} />
          <Switch testId="live-top10" label="Mostrar só os 10 primeiros" hint="Desligado, mostra todos." checked={live.top10} onChange={(v) => set({ liveTop10: v })} />
        </div>
        <p className="mt-4 rounded-2xl bg-champagne-200/40 p-4 text-sm leading-relaxed text-cocoa-700" data-testid="live-warning">
          <strong>Atenção:</strong> o gabarito nunca é enviado ao público, mas, com o ranking provisório visível, alguém pode descobrir uma resposta
          observando quando a própria pontuação sobe. Para evitar isso, ligue <em>Ocultar classificação temporariamente</em> (ou desative a transmissão)
          até o fim do quiz.
        </p>
      </Panel>
    </div>
  );
}
