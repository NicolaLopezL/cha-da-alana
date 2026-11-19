import { InviteExperience } from "@/components/invite/InviteExperience";
import { SkipEnvelopeScript } from "@/components/invite/SkipEnvelopeScript";
import { loadInvite } from "@/lib/server/invite";

/** Convite geral (sem nome). A confirmação só aparece se o convite aberto estiver habilitado no painel. */
export default async function Home() {
  const data = (await loadInvite())!;
  return (
    <>
      <SkipEnvelopeScript />
      <InviteExperience {...data} />
    </>
  );
}
