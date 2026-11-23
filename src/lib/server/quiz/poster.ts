import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { quizDict } from "@/lib/quiz/i18n";
import { quizQrMatrix } from "./qr";

/** Cartaz A4 para imprimir, todo em vetor, com as fontes e cores do convite. */

const W = 595.28;
const H = 841.89;
const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = {
  paper: hex("#fffdf9"),
  ivory: hex("#fbf7f1"),
  blush: hex("#efcfcf"),
  rose400: hex("#c98f92"),
  rose: hex("#9c6266"),
  gold: hex("#c6a66b"),
  cocoa: hex("#4a3333"),
  text: hex("#5b4040"),
  fur: hex("#d3b18a"),
  muzzle: hex("#fbf1e2"),
  nose: hex("#6b4a44"),
  white: rgb(1, 1, 1),
};

const fontFile = (pkg: string, file: string) => fs.readFile(path.join(process.cwd(), "node_modules/@fontsource", pkg, "files", file));

const HEART = "M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z";

function center(page: PDFPage, text: string, font: PDFFont, size: number, y: number, color = C.text) {
  page.drawText(text, { x: (W - font.widthOfTextAtSize(text, size)) / 2, y, size, font, color });
}

/** Quebra o texto em linhas que cabem na largura. */
function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/)) {
    const last = lines.at(-1);
    if (last !== undefined && font.widthOfTextAtSize(`${last} ${word}`, size) <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/** Mesma ursinha das telas, desenhada em vetor (caixa 200×200, canto superior esquerdo em x,y). */
function bear(page: PDFPage, x: number, y: number, scale: number) {
  const ell = (cx: number, cy: number, rx: number, ry: number, color: ReturnType<typeof rgb>, opacity = 1) =>
    page.drawEllipse({ x: x + cx * scale, y: y - cy * scale, xScale: rx * scale, yScale: ry * scale, color, opacity });
  const draw = (d: string, opts: Parameters<PDFPage["drawSvgPath"]>[1]) => page.drawSvgPath(d, { x, y, scale, ...opts });
  ell(48, 68, 27, 27, C.fur);
  ell(152, 68, 27, 27, C.fur);
  ell(48, 69, 14.5, 14.5, C.blush);
  ell(152, 69, 14.5, 14.5, C.blush);
  ell(100, 116, 72, 66, C.fur);
  ell(54, 132, 13, 9, C.rose400, 0.45);
  ell(146, 132, 13, 9, C.rose400, 0.45);
  ell(100, 141, 33, 27, C.muzzle);
  ell(100, 135, 12, 7.5, C.nose);
  draw("M100 143v7m0 0c-3 6-11 7-15 2m15-2c3 6 11 7 15 2", { borderColor: C.nose, borderWidth: 2.6 });
  for (const cx of [72, 128]) {
    ell(cx, 113, 7.6, 7.6, C.cocoa);
    ell(cx + 2.6, 110.4, 2.5, 2.5, C.white);
  }
  const bow = { color: C.blush, borderColor: C.gold, borderWidth: 1.1 };
  draw("M94 56c-8 8-13 17-12 25 6-2 12-9 16-19ZM106 56c8 8 13 17 12 25-6-2-12-9-16-19Z", bow);
  draw("M100 48C86 26 58 18 50 30s0 34 14 38c14 3 28-8 36-20Z", bow);
  draw("M100 48c14-22 42-30 50-18s0 34-14 38c-14 3-28-8-36-20Z", bow);
  ell(100, 49, 11, 11, C.rose400);
}

export async function quizPosterPdf(url: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const embed = async (pkg: string, file: string) => pdf.embedFont(await fontFile(pkg, file), { subset: true });
  const script = await embed("pinyon-script", "pinyon-script-latin-400-normal.woff");
  const display = await embed("cormorant-garamond", "cormorant-garamond-latin-500-normal.woff");
  const sans = await embed("manrope", "manrope-latin-600-normal.woff");
  pdf.setTitle("Quiz do Chá da Alana");
  pdf.setLanguage("pt-BR");
  const pt = quizDict("pt");
  const es = quizDict("es");

  const page = pdf.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.ivory });
  page.drawRectangle({ x: 24, y: 24, width: W - 48, height: H - 48, color: C.paper, borderColor: C.gold, borderWidth: 1.2 });
  page.drawRectangle({ x: 31, y: 31, width: W - 62, height: H - 62, borderColor: C.blush, borderWidth: 1 });
  const hearts: [number, number, number][] = [
    [58, 770, 1.1],
    [515, 776, 0.9],
    [78, 640, 0.7],
    [500, 650, 1.2],
    [60, 250, 1.1],
    [512, 232, 0.8],
    [86, 96, 0.8],
    [486, 92, 1.1],
  ];
  for (const [x, y, scale] of hearts) page.drawSvgPath(HEART, { x, y, scale, color: C.blush });

  bear(page, W / 2 - 68, 800, 0.68);
  center(page, "Alana", script, 74, 600, C.rose);
  let y = 552;
  for (const line of wrap(pt.qrTitle, display, 36, W - 130)) {
    center(page, line, display, 36, y, C.cocoa);
    y -= 38;
  }
  for (const line of wrap(pt.qrText, sans, 14.5, W - 150)) {
    center(page, line, sans, 14.5, y + 6, C.text);
    y -= 20;
  }

  const box = 290;
  const bx = (W - box) / 2;
  const by = y - box + 2;
  page.drawRectangle({ x: bx, y: by, width: box, height: box, color: C.white, borderColor: C.gold, borderWidth: 1.4 });
  const qr = quizQrMatrix(url);
  const cell = box / (qr.size + 8); // margem silenciosa de 4 módulos de cada lado
  // Um único traçado (unindo módulos vizinhos) para não surgirem linhas claras na impressão.
  let d = "";
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (!qr.dark(c, r) || (c > 0 && qr.dark(c - 1, r))) continue;
      let w = 1;
      while (c + w < qr.size && qr.dark(c + w, r)) w++;
      d += `M${c + 4} ${r + 4}h${w}v1.03h${-w}z`;
    }
  }
  page.drawSvgPath(d, { x: bx, y: by + box, scale: cell, color: C.cocoa });

  center(page, url.replace(/^https?:\/\//, ""), sans, 13, by - 28, C.rose);
  center(page, es.qrTitle, display, 21, by - 66, C.cocoa);
  center(page, es.qrText, sans, 11, by - 85, C.text);
  return pdf.save();
}
