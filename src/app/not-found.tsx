import Link from "next/link";
import { HeartBalloon } from "@/components/invite/Ornaments";

export default function NotFound() {
  return (
    <main className="paper-ivory flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <HeartBalloon size={56} id="nf" className="animate-balloon mb-6" />
      <p className="eyebrow mb-3">Chá da Alana</p>
      <h1 className="display text-4xl text-cocoa-700">Convite não encontrado</h1>
      <p className="mt-4 max-w-[34ch] text-cocoa-500">
        Confira se o link foi copiado por completo. Se o problema continuar, fale com os papais da Alana.
      </p>
      <Link href="/" className="btn btn-ghost mt-8">
        Ver o convite
      </Link>
    </main>
  );
}
