/** Limpa o nome digitado: sem caracteres invisíveis/de controle, espaços normalizados, até 40 letras. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = [
    ...raw
      .slice(0, 400)
      .normalize("NFC")
      .replace(/[\p{Cc}\p{Cf}\p{Co}\p{Cn}<>]/gu, " ")
      .replace(/\p{M}{3,}/gu, "")
      .replace(/\s+/g, " ")
      .trim(),
  ]
    .slice(0, 40)
    .join("")
    .trim();
  return [...name].length >= 2 && /\p{L}/u.test(name) ? name : null;
}

/** Chave para comparar nomes (sem acentos, maiúsculas nem pontuação); aceita alfabetos não latinos. */
export function quizNameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
