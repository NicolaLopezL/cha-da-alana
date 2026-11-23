"use client";

import { useState } from "react";
import { resetQuizAction, saveQuizConfigAction, saveQuizTextsAction } from "@/app/admin/quiz-actions";
import { quizDict } from "@/lib/quiz/i18n";
import { TEXT_KEYS, type AdminQuizState, type QuizTextKey } from "@/lib/quiz/types";
import { Panel } from "../parts";
import { btnClass, Switch, useQuizAction } from "./kit";

const LABELS: Record<QuizTextKey, string> = {
  title: "Título do quiz",
  intro: "Texto de boas-vindas",
  notOpen: "Mensagem antes de abrir",
  thanksTitle: "Título do agradecimento",
  thanksText: "Texto do agradecimento",
  ended: "Mensagem de quiz encerrado",
};

export function QuizSettings({ state: s }: { state: AdminQuizState }) {
  const { run, pending } = useQuizAction();
  const [texts, setTexts] = useState<Record<string, string>>({ ...s.texts });
  const [points, setPoints] = useState(String(s.defaultPoints));
  const [confirmText, setConfirmText] = useState("");
  const base = { pt: quizDict("pt"), es: quizDict("es") };

  return (
    <div className="space-y-6">
      <Panel title="Regras">
        <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <Switch
            label="Ao encerrar, quem já começou pode terminar"
            hint="Desligado: o encerramento bloqueia novas respostas na hora."
            checked={s.closePolicy === "finish"}
            onChange={(v) => saveQuizConfigAction({ closePolicy: v ? "finish" : "block" })}
            testId="close-policy"
          />
          <Switch
            label="Permitir mais de uma pessoa no mesmo aparelho"
            hint="Útil para famílias que dividem o celular. Desligado: uma participação por aparelho."
            checked={s.allowSameDevice}
            onChange={(v) => saveQuizConfigAction({ allowSameDevice: v })}
            testId="same-device"
          />
        </div>
        <div className="mt-3 flex items-end gap-3">
          <label className="block w-48 text-[0.8rem] font-semibold text-cocoa-700">
            Pontos de novas perguntas
            <input type="number" min={1} max={100} value={points} onChange={(e) => setPoints(e.target.value)} className="admin-field mt-1" />
          </label>
          <button type="button" disabled={pending} onClick={() => run(() => saveQuizConfigAction({ defaultPoints: Number(points) }))} className={btnClass("ghost")}>
            Salvar
          </button>
        </div>
      </Panel>

      <Panel title="Textos em português e espanhol" description="Deixe em branco para usar o texto padrão (mostrado em cinza).">
        <div className="space-y-5">
          {TEXT_KEYS.map((key) => (
            <div key={key} className="grid gap-3 sm:grid-cols-2">
              {(["pt", "es"] as const).map((lang) => (
                <label key={lang} className="block text-[0.8rem] font-semibold text-cocoa-700">
                  {LABELS[key]} ({lang === "pt" ? "português" : "espanhol"})
                  <textarea
                    rows={key === "title" || key === "thanksTitle" ? 2 : 4}
                    maxLength={400}
                    lang={lang === "pt" ? "pt-BR" : "es-CO"}
                    placeholder={base[lang][key]}
                    value={texts[`${key}_${lang}`] ?? ""}
                    onChange={(e) => setTexts((t) => ({ ...t, [`${key}_${lang}`]: e.target.value }))}
                    className="admin-field mt-1"
                  />
                </label>
              ))}
            </div>
          ))}
        </div>
        <button type="button" disabled={pending} onClick={() => run(() => saveQuizTextsAction(texts))} className={`${btnClass("primary")} mt-5`}>
          Salvar textos
        </button>
      </Panel>

      <Panel
        title="Zerar participações (para ensaios)"
        description="Apaga todas as participações, respostas e rodadas de desempate do quiz e volta para rascunho. Perguntas, gabarito e configurações ficam. Convidados, presentes e confirmações não são afetados. Não dá para desfazer."
      >
        {s.status === "open" ? (
          <p className="text-sm text-cocoa-500">Encerre o quiz antes de zerar.</p>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block text-[0.8rem] font-semibold text-cocoa-700">
              Digite ZERAR para confirmar
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" className="admin-field mt-1" />
            </label>
            <button
              type="button"
              disabled={pending || confirmText.trim().toUpperCase() !== "ZERAR"}
              onClick={() => run(() => resetQuizAction(confirmText), (r) => r.ok && setConfirmText(""))}
              className={btnClass("danger")}
              data-testid="quiz-reset"
            >
              Zerar participações
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}
