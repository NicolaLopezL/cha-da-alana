import { TEXT_KEYS, type QuizLang, type QuizTextOverrides } from "./types";

/** Textos do quiz. Os de TEXT_KEYS podem ser trocados pelo painel; os demais são fixos da interface. */
const pt = {
  // editáveis
  title: "Quem conhece melhor os papais?",
  intro: "Você conhece mesmo o Nicola e a Yasmin? Responda às perguntas e descubra se consegue conquistar o primeiro lugar no nosso ranking!",
  notOpen: "Nosso quiz ainda não começou! Aguarde a organizadora liberar a brincadeira.",
  thanksTitle: "Parabéns! Você concluiu o Quiz da Alana!",
  thanksText: "Suas respostas foram registradas com sucesso! Obrigado por participar desse momento tão especial com a gente! 💕",
  ended: "A brincadeira terminou! Obrigado pelo carinho. 💕",

  // geral
  brand: "Chá da Alana",
  language: "Idioma",
  backToInvite: "Voltar ao convite",
  questionsCount: (n: number) => (n === 1 ? "1 pergunta" : `${n} perguntas`),
  tieHint: "Em caso de empate, vence quem terminar primeiro.",

  // início
  nameLabel: "Qual é o seu nome?",
  namePlaceholder: "Nome e sobrenome",
  start: "Começar Quiz",
  starting: "Começando…",
  howTo: "É só tocar na resposta: ela é salva sozinha e a próxima pergunta aparece.",

  // perguntas
  questionOf: (i: number, n: number) => `Pergunta ${i} de ${n}`,
  progress: "Progresso do quiz",
  chooseOne: "Toque na sua resposta",
  back: "Voltar",
  next: "Próxima",
  hello: (name: string) => `Olá, ${name}!`,
  saving: "Salvando…",
  saved: "Resposta salva",
  offline: "Sem conexão. Sua resposta está guardada e vamos tentar de novo.",
  retryNow: "Tentar agora",

  // fim
  seeLive: "Ver ranking ao vivo",
  seeFinal: "Ver o ranking final",
  answerForOther: "Responder por outra pessoa neste aparelho",
  endedIncomplete: "O quiz foi encerrado antes de você terminar.",
  invalidated: "Esta participação foi cancelada pela organização. Fale com a família se achar que foi um engano.",
  invalidRestart: "Começar de novo",
  waitingResult: "Agora é só aguardar o resultado!",

  // desempate
  tiebreakTitle: "Rodada de desempate!",
  tiebreakText: "Você empatou! Responda às perguntas extras para decidir a classificação.",
  tiebreakStart: "Responder ao desempate",
  tiebreakDone: "Respostas do desempate registradas! Boa sorte! 💕",

  // ranking ao vivo
  liveTitle: "Ranking AO VIVO",
  provisional: "Classificação provisória",
  waitingOfficial: "Aguardando o resultado oficial",
  closedLive: "A brincadeira terminou!",
  liveOff: "A transmissão do ranking está desligada no momento.",
  liveHidden: "Suspense… A classificação volta já, já!",
  liveWaiting: "Nosso quiz ainda não começou!",
  liveEmpty: "Ainda não há participantes. Seja a primeira pessoa!",
  finalTitle: "Ranking final",
  winners: "Temos um resultado!",
  points: (n: number) => (n === 1 ? "1 ponto" : `${n} pontos`),
  participants: (n: number) => (n === 1 ? "1 participante" : `${n} participantes`),
  finishedCount: (n: number) => (n === 1 ? "1 concluiu" : `${n} concluíram`),
  answering: "respondendo",
  doneLabel: "concluiu",
  tied: "Empate",
  tieProvisional: "Empate provisório",
  tieRound: "Rodada de desempate em andamento!",
  connected: "Atualização automática",
  reconnecting: "Reconectando…",
  fullscreen: "Tela cheia",
  exitFullscreen: "Sair da tela cheia",
  tvMode: "Modo televisão",
  maxScore: (n: number) => `Pontuação máxima: ${n}`,

  // ranking final
  finalNotYet: "O resultado ainda não foi publicado.",
  finalNotYetHint: "Assim que a organizadora revelar os vencedores, o ranking aparece aqui.",
  noParticipants: "Nenhuma participação concluída.",

  // QR
  qrTitle: "Participe do Quiz da Alana!",
  qrText: "Escaneie o QR Code com seu celular e participe!",
  qrAlt: "QR Code para abrir o quiz",

  // convite
  gamesEyebrow: "Para se divertir",
  gamesTitle: "Brincadeiras",
  gamesName: "Quiz dos Papais",
  gamesOpen: "Participar do quiz",
  gamesEnded: "A brincadeira terminou! Obrigado pelo carinho.",

  errors: {
    not_open: "O quiz ainda não está aberto.",
    closed: "O quiz já foi encerrado.",
    finished: "Suas respostas já foram concluídas.",
    invalid: "Esta participação não é mais válida.",
    no_session: "Não encontramos sua participação neste aparelho. Comece novamente.",
    bad_question: "Esta pergunta mudou. Vamos atualizar a página.",
    name_required: "Escreva seu nome para começar.",
    name_taken: "Já tem alguém com esse nome no quiz. Acrescente seu sobrenome 💕",
    device_used: "Este aparelho já participou do quiz.",
    rate_limited: "Muitas tentativas seguidas. Aguarde um instante.",
    unavailable: "Não foi possível conectar. Tente de novo em instantes.",
    retry: "Não foi possível conectar. Tente de novo em instantes.",
  },
};

export type QuizDict = typeof pt;

const es: QuizDict = {
  title: "¿Quién conoce mejor a los papás?",
  intro: "¿De verdad conoces a Nicola y a Yasmin? ¡Responde las preguntas y descubre si logras el primer lugar en nuestro ranking!",
  notOpen: "¡Nuestro quiz todavía no ha empezado! Espera a que la organizadora abra el juego.",
  thanksTitle: "¡Felicitaciones! ¡Terminaste el Quiz de Alana!",
  thanksText: "¡Tus respuestas quedaron registradas! ¡Gracias por participar en este momento tan especial con nosotros! 💕",
  ended: "¡El juego terminó! Gracias por tu cariño. 💕",

  brand: "Baby shower de Alana",
  language: "Idioma",
  backToInvite: "Volver a la invitación",
  questionsCount: (n) => (n === 1 ? "1 pregunta" : `${n} preguntas`),
  tieHint: "En caso de empate, gana quien termine primero.",

  nameLabel: "¿Cuál es tu nombre?",
  namePlaceholder: "Nombre y apellido",
  start: "Empezar el Quiz",
  starting: "Empezando…",
  howTo: "Solo toca tu respuesta: se guarda sola y aparece la siguiente pregunta.",

  questionOf: (i, n) => `Pregunta ${i} de ${n}`,
  progress: "Progreso del quiz",
  chooseOne: "Toca tu respuesta",
  back: "Volver",
  next: "Siguiente",
  hello: (name) => `¡Hola, ${name}!`,
  saving: "Guardando…",
  saved: "Respuesta guardada",
  offline: "Sin conexión. Tu respuesta está guardada y lo intentaremos de nuevo.",
  retryNow: "Intentar ahora",

  seeLive: "Ver el ranking en vivo",
  seeFinal: "Ver el ranking final",
  answerForOther: "Responder por otra persona en este celular",
  endedIncomplete: "El quiz se cerró antes de que terminaras.",
  invalidated: "Esta participación fue cancelada por la organización. Habla con la familia si crees que fue un error.",
  invalidRestart: "Empezar de nuevo",
  waitingResult: "¡Ahora solo falta esperar el resultado!",

  tiebreakTitle: "¡Ronda de desempate!",
  tiebreakText: "¡Empataste! Responde las preguntas extra para definir la clasificación.",
  tiebreakStart: "Responder el desempate",
  tiebreakDone: "¡Respuestas del desempate registradas! ¡Buena suerte! 💕",

  liveTitle: "Ranking EN VIVO",
  provisional: "Clasificación provisional",
  waitingOfficial: "Esperando el resultado oficial",
  closedLive: "¡El juego terminó!",
  liveOff: "La transmisión del ranking está apagada por ahora.",
  liveHidden: "Suspenso… ¡La clasificación vuelve ya mismo!",
  liveWaiting: "¡Nuestro quiz todavía no ha empezado!",
  liveEmpty: "Todavía no hay participantes. ¡Anímate a ser la primera persona!",
  finalTitle: "Ranking final",
  winners: "¡Tenemos un resultado!",
  points: (n) => (n === 1 ? "1 punto" : `${n} puntos`),
  participants: (n) => (n === 1 ? "1 participante" : `${n} participantes`),
  finishedCount: (n) => (n === 1 ? "1 terminó" : `${n} terminaron`),
  answering: "respondiendo",
  doneLabel: "terminó",
  tied: "Empate",
  tieProvisional: "Empate provisional",
  tieRound: "¡Ronda de desempate en curso!",
  connected: "Actualización automática",
  reconnecting: "Reconectando…",
  fullscreen: "Pantalla completa",
  exitFullscreen: "Salir de pantalla completa",
  tvMode: "Modo televisión",
  maxScore: (n) => `Puntaje máximo: ${n}`,

  finalNotYet: "El resultado todavía no se ha publicado.",
  finalNotYetHint: "Cuando la organizadora revele a los ganadores, el ranking aparecerá aquí.",
  noParticipants: "Ninguna participación terminada.",

  qrTitle: "¡Participa en el Quiz de Alana!",
  qrText: "¡Escanea el código QR con tu celular y participa!",
  qrAlt: "Código QR para abrir el quiz",

  gamesEyebrow: "Para divertirse",
  gamesTitle: "Juegos",
  gamesName: "Quiz de los papás",
  gamesOpen: "Participar en el quiz",
  gamesEnded: "¡El juego terminó! Gracias por tu cariño.",

  errors: {
    not_open: "El quiz todavía no está abierto.",
    closed: "El quiz ya se cerró.",
    finished: "Tus respuestas ya quedaron registradas.",
    invalid: "Esta participación ya no es válida.",
    no_session: "No encontramos tu participación en este celular. Empieza de nuevo.",
    bad_question: "Esta pregunta cambió. Vamos a actualizar la página.",
    name_required: "Escribe tu nombre para empezar.",
    name_taken: "Ya hay alguien con ese nombre en el quiz. Agrega tu apellido 💕",
    device_used: "Este celular ya participó en el quiz.",
    rate_limited: "Demasiados intentos seguidos. Espera un momento.",
    unavailable: "No se pudo conectar. Intenta de nuevo en unos instantes.",
    retry: "No se pudo conectar. Intenta de nuevo en unos instantes.",
  },
};

const DICTS: Record<QuizLang, QuizDict> = { pt, es };

/** Dicionário do idioma, com os textos personalizados no painel aplicados por cima. */
export function quizDict(lang: QuizLang, overrides: QuizTextOverrides = {}): QuizDict {
  const out = { ...DICTS[lang] };
  for (const key of TEXT_KEYS) {
    const custom = overrides[`${key}_${lang}`]?.trim();
    if (custom) out[key] = custom;
  }
  return out;
}

/** Texto traduzido de pergunta/alternativa; sem tradução cadastrada, usa o português. */
export const pick = (item: { pt: string; es: string }, lang: QuizLang) => (lang === "es" && item.es ? item.es : item.pt);

export const isLang = (v: unknown): v is QuizLang => v === "pt" || v === "es";

export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1).replace(".", ",")} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(Math.floor(s % 60)).padStart(2, "0")} s`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}
