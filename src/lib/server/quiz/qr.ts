import "server-only";
import QRCode from "qrcode";
import { baseUrl } from "../admin-data";

/** Endereço do quiz no domínio oficial (SITE_URL). */
export async function quizUrl(): Promise<string> {
  return `${await baseUrl()}/quiz`;
}

const color = { dark: "#4a3333ff", light: "#ffffffff" };

export const quizQrSvg = (url: string) => QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2, color });
export const quizQrPng = (url: string) => QRCode.toBuffer(url, { type: "png", errorCorrectionLevel: "M", margin: 4, width: 1200, color });

/** Matriz de quadradinhos, para desenhar o QR Code em vetor no PDF. */
export function quizQrMatrix(url: string) {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: "M" });
  return { size: modules.size, dark: (col: number, row: number) => Boolean(modules.get(row, col)) };
}
