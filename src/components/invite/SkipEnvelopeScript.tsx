/**
 * Script mínimo executado antes da pintura:
 *  - se o convidado já abriu o envelope nesta sessão, marca o <html> para escondê-lo
 *    imediatamente (evita "piscar" ao recarregar);
 *  - se o envelope vai aparecer, começa sempre do topo (o navegador não restaura a rolagem antiga);
 *  - guarda um toque no envelope feito antes do JavaScript carregar, para abrir assim que possível.
 * Também garante acesso ao conteúdo quando o JavaScript está desativado.
 */
export function SkipEnvelopeScript({ token }: { token?: string }) {
  const key = JSON.stringify(`alana-opened-${token ?? "geral"}`);
  const code = [
    "(function(){var d=document.documentElement,opened=false;",
    `try{opened=sessionStorage.getItem(${key})==="1"}catch(e){}`,
    'if(opened){d.dataset.opened="1";return}',
    'try{if("scrollRestoration" in history)history.scrollRestoration="manual"}catch(e){}',
    "window.scrollTo(0,0);",
    'document.addEventListener("click",function(e){var t=e.target;',
    'if(!window.__alanaHydrated&&t&&t.closest&&t.closest("[data-testid=envelope]"))window.__alanaOpenRequested=true},true);',
    "})();",
  ].join("");
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
