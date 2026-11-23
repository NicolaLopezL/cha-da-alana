import { describe, expect, it } from "vitest";
import { formatDuration, pick, quizDict } from "@/lib/quiz/i18n";
import { cleanName, quizNameKey } from "@/lib/quiz/name";

describe("nome do participante", () => {
  it("limpa espaços, caracteres invisíveis e limita o tamanho", () => {
    expect(cleanName("  Tia   Marta ")).toBe("Tia Marta");
    expect(cleanName("Ana\u202e\u200bBia")).toBe("Ana Bia");
    expect(cleanName("<b>Zé</b>")).toBe("b Zé /b");
    expect([...cleanName("a".repeat(90))!]).toHaveLength(40);
    expect(cleanName("José Ñandú 💕")).toBe("José Ñandú 💕");
  });
  it("recusa vazio, uma letra, só números ou outro tipo", () => {
    for (const v of ["", "   ", "A", "12345", "💕💕", null, 5, {}]) expect(cleanName(v)).toBeNull();
  });
  it("compara sem acento, maiúsculas e pontuação", () => {
    expect(quizNameKey("  JOÃO da-Silva ")).toBe(quizNameKey("joao da silva"));
    expect(quizNameKey("Ана")).toBe("ана");
  });
});

describe("idiomas", () => {
  it("espanhol tem todas as chaves do português", () => {
    const keys = (o: object) => Object.keys(o).sort();
    expect(keys(quizDict("es"))).toEqual(keys(quizDict("pt")));
    expect(keys(quizDict("es").errors)).toEqual(keys(quizDict("pt").errors));
  });
  it("textos do painel substituem o padrão; vazio volta ao padrão", () => {
    expect(quizDict("pt", { title_pt: "Novo" }).title).toBe("Novo");
    expect(quizDict("es", { title_pt: "Novo" }).title).toBe(quizDict("es").title);
    expect(quizDict("pt", { title_pt: "  " }).title).toBe(quizDict("pt").title);
  });
  it("sem tradução, usa o português", () => {
    expect(pick({ pt: "Os dois", es: "" }, "es")).toBe("Os dois");
    expect(pick({ pt: "Os dois", es: "Los dos" }, "es")).toBe("Los dos");
  });
  it("formata durações", () => {
    expect([formatDuration(null), formatDuration(1900), formatDuration(65_000), formatDuration(3_720_000)]).toEqual(["—", "1,9 s", "1 min 05 s", "1 h 02 min"]);
  });
});
