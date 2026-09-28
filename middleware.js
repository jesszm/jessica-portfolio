/* JM · pt-BR share previews.
   The site is one HTML file per page; Portuguese is applied in the browser.
   Link previews (LinkedIn, WhatsApp, Slack…) don't run JavaScript, so for
   ?lang=pt this swaps the head's title, description and Open Graph tags for
   their Portuguese versions. Everything else passes straight through. */

export const config = {
  matcher: ['/', '/index.html', '/work/:path*', '/guidelines.html'],
};

const SITE = 'https://www.jessmonteiro.com';

const PT = {
  '/': {
    title: 'Jessica Monteiro · Designer de UI/UX',
    description: 'Jessica Monteiro é designer de UI/UX para e-commerce, apps mobile, sistemas web e fintech. Design guiado por pesquisa, com visão de sistema e feito lado a lado com devs.',
    ogTitle: 'Jessica Monteiro · Designer de UI/UX',
    ogDescription: 'Interfaces que você usa sem precisar pensar. Design de UI/UX guiado por pesquisa para e-commerce, mobile, sistemas web e fintech.',
    imageAlt: 'Jessica Monteiro, designer de UI/UX: uma mesa em 3D ensolarada, com um laptop aberto num arquivo de design.',
  },
  '/work/muvr.html': {
    title: 'Muvr, o dia da mudança pelas duas pontas · Jessica Monteiro',
    description: 'Um marketplace de mudanças tem duas pontas: quem se muda e o motorista que faz a mudança. Para o Muvr, em 2025, refiz do zero os fluxos principais dos dois apps, como única designer.',
    ogTitle: 'Muvr, o dia da mudança pelas duas pontas',
    ogDescription: 'Um marketplace de mudanças tem duas pontas: quem se muda e o motorista que faz a mudança. Para o Muvr, em 2025, refiz do zero os fluxos principais dos dois apps, como única designer.',
    imageAlt: 'O logotipo do Muvr em branco sobre roxo, ao lado da home do app do usuário e da central de ajuda do app do motorista.',
  },
  '/work/crypex.html': {
    title: 'Crypex, pagar com cripto tão fácil quanto um Pix · Jessica Monteiro',
    description: 'Um app mobile 0→1 que permite pagar um Pix direto do saldo em cripto. UI/UX solo, do arquivo em branco ao pronto para o dev.',
    ogTitle: 'Crypex, pagar com cripto tão fácil quanto um Pix',
    ogDescription: 'Um app mobile 0→1 que permite pagar um Pix direto do saldo em cripto. UI/UX solo, do arquivo em branco ao pronto para o dev.',
    imageAlt: 'O logotipo da Crypex ao lado de três telas do app: pagar, início e revisão do pagamento.',
  },
  '/guidelines.html': {
    title: 'Diretrizes de design · Jessica Monteiro',
    description: 'O design system e o processo de UI/UX por trás do portfólio de Jessica Monteiro: princípios, processo, fundamentos, componentes, acessibilidade, pesquisa, handoff e governança.',
    ogTitle: 'Diretrizes de design · Jessica Monteiro',
    ogDescription: 'O design system por trás deste portfólio: tokens, tipografia, cor, componentes, movimento e acessibilidade.',
    imageAlt: 'Jessica Monteiro, designer de UI/UX: uma mesa em 3D ensolarada, com um laptop aberto num arquivo de design.',
  },
};

/* same as next() from @vercel/functions, without a dependency (the site has no build step) */
const passThrough = () => new Response(null, { headers: { 'x-middleware-next': '1' } });

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const setMeta = (html, attr, name, value) => {
  const re = new RegExp(`(<meta ${attr}="${name}" content=")[^"]*(")`);
  return re.test(html) ? html.replace(re, `$1${esc(value)}$2`) : html;
};

export default async function middleware(request) {
  const url = new URL(request.url);
  if (url.searchParams.get('lang') !== 'pt') return passThrough();
  const path = url.pathname === '/index.html' ? '/' : url.pathname;
  const pt = PT[path];
  if (!pt) return passThrough();

  /* fetch the same page without ?lang (this middleware lets that request through);
     forward cookies and headers so protected preview deployments still answer */
  const source = new URL(url.pathname, url.origin);
  const res = await fetch(source, { headers: request.headers, redirect: 'manual' });
  if (res.status !== 200 || !(res.headers.get('content-type') || '').includes('text/html')) return passThrough();

  let html = await res.text();
  const ptUrl = `${SITE}${path}?lang=pt`;
  html = html.replace(/<html lang="en"/, '<html lang="pt-BR"');
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(pt.title)}</title>`);
  html = setMeta(html, 'name', 'description', pt.description);
  html = setMeta(html, 'property', 'og:title', pt.ogTitle);
  html = setMeta(html, 'property', 'og:description', pt.ogDescription);
  html = setMeta(html, 'property', 'og:image:alt', pt.imageAlt);
  html = setMeta(html, 'property', 'og:url', ptUrl);
  html = setMeta(html, 'property', 'og:locale', 'pt_BR');
  html = setMeta(html, 'property', 'og:locale:alternate', 'en_US');
  html = setMeta(html, 'name', 'twitter:title', pt.ogTitle);
  html = setMeta(html, 'name', 'twitter:description', pt.ogDescription);
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${ptUrl}$2`);

  const headers = new Headers(res.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('etag');
  headers.set('content-type', 'text/html; charset=utf-8');
  return new Response(html, { status: 200, headers });
}
