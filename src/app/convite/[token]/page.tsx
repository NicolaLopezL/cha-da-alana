import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InviteExperience } from "@/components/invite/InviteExperience";
import { SkipEnvelopeScript } from "@/components/invite/SkipEnvelopeScript";
import { loadInvite } from "@/lib/server/invite";

export const metadata: Metadata = {
  title: "Chá da Alana — seu convite",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Convite pessoal: /convite/[token] — o nome do convidado aparece no envelope. */
export default async function PersonalInvite({ params }: PageProps<"/convite/[token]">) {
  const { token } = await params;
  const data = await loadInvite(token);
  if (!data) notFound();
  return (
    <>
      <SkipEnvelopeScript token={token} />
      <InviteExperience {...data} />
    </>
  );
}
