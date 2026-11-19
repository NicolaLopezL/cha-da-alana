/**
 * Script mínimo executado antes da pintura: se o convidado já abriu o envelope nesta sessão,
 * marca o <html> para esconder o envelope imediatamente (evita "piscar" ao recarregar).
 * Também garante acesso ao conteúdo quando o JavaScript está desativado.
 */
export function SkipEnvelopeScript({ token }: { token?: string }) {
  const key = JSON.stringify(`alana-opened-${token ?? "geral"}`);
  const code = `try{if(sessionStorage.getItem(${key})==="1")document.documentElement.dataset.opened="1"}catch(e){}`;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: code }} />
      <style>{`html[data-opened] [data-testid="envelope-scene"]{display:none}`}</style>
      <noscript>
        <style>{`[data-testid="envelope-scene"]{display:none!important}html{overflow:auto!important}`}</style>
      </noscript>
    </>
  );
}
