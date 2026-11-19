import { rmSync } from "node:fs";
import path from "node:path";

/** Começa cada execução com um banco local vazio. */
export default function globalSetup() {
  rmSync(path.resolve(".data-test"), { recursive: true, force: true });
}
