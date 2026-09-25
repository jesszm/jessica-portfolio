/* JM · i18n — English is the source (the HTML itself); Brazilian Portuguese is
   a dictionary loaded only when chosen. Keys are a hash of each text block's
   markup, so the HTML stays plain English with no attributes to maintain. A
   block with no translation simply stays in English.
   Choose with ?lang=pt | ?lang=en (remembered) or the EN / PT switch. */
(function () {
  var d = document, html = d.documentElement;
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var param = (location.search.match(/[?&]lang=(pt|en)\b/) || [])[1];
  if (param) store.set('jm-lang', param);
  var lang = param || store.get('jm-lang') || 'en';
  window.JM_LANG = lang;

  /* FNV-1a over the whitespace-collapsed markup, base 36 */
  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }
  function hash(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
  }
  var INLINE = /^(A|ABBR|B|BR|CODE|EM|I|KBD|MARK|S|SMALL|SPAN|STRONG|SUB|SUP|U|TIME)$/;
  var SKIP = /^(SCRIPT|STYLE|SVG|CANVAS|PRE|CODE|NOSCRIPT|TEMPLATE|TEXTAREA)$/;
  function isUnit(el) {
    var hasText = false;
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) { if (/[A-Za-zÀ-ÿ]/.test(n.nodeValue)) hasText = true; }
      else if (n.nodeType === 1 && !INLINE.test(n.tagName)) return false;
    }
    return hasText;
  }
  /* walk the static markup and yield [element, key, markup] for each text block */
  function blocks(root, cb) {
    (function walk(el) {
      for (var c = el.firstElementChild; c; c = c.nextElementSibling) {
        if (SKIP.test(c.tagName.toUpperCase()) || c.hasAttribute('data-no-i18n')) continue;
        if (isUnit(c)) { var m = norm(c.innerHTML); cb(c, hash(m), m); }
        else walk(c);
      }
    })(root);
  }
  var ATTRS = ['alt', 'aria-label', 'title', 'placeholder'];
  function attrs(root, cb) {
    var all = root.querySelectorAll('[alt],[aria-label],[title],[placeholder]');
    for (var i = 0; i < all.length; i++) {
      for (var j = 0; j < ATTRS.length; j++) {
        var v = all[i].getAttribute(ATTRS[j]);
        if (v && /[A-Za-z]/.test(v)) cb(all[i], ATTRS[j], hash(norm(v)), norm(v));
      }
    }
  }
  window.JMI18N = { hash: hash, norm: norm, blocks: blocks, attrs: attrs };

  function markSwitch() {
    var links = d.querySelectorAll('.lang-switch a[data-lang]');
    for (var i = 0; i < links.length; i++) {
      var on = links[i].getAttribute('data-lang') === lang;
      links[i].setAttribute('aria-current', on ? 'true' : 'false');
      /* keep the section the reader is on when switching */
      links[i].addEventListener('click', function (e) {
        e.preventDefault();
        var l = this.getAttribute('data-lang');
        store.set('jm-lang', l);
        var q = location.search.replace(/[?&]lang=(pt|en)\b/, '').replace(/^&/, '?');
        location.href = location.pathname + (q ? q + '&' : '?') + 'lang=' + l + location.hash;
      });
    }
  }

  if (lang !== 'pt') { window.jmApplyI18n = markSwitch; return; }

  html.setAttribute('lang', 'pt-BR');
  html.classList.add('i18n-pending');
  var me = d.currentScript && d.currentScript.src;
  var base = me ? me.replace(/assets\/js\/i18n\.js.*$/, '') : '';
  var pageMeta = d.querySelector('meta[name="i18n-page"]');
  var page = pageMeta ? pageMeta.getAttribute('content') : 'index';
  window.JM_PT = {};
  d.write('<script src="' + base + 'assets/i18n/pt/common.js?v=1"><\/script>');
  d.write('<script src="' + base + 'assets/i18n/pt/' + page + '.js?v=1"><\/script>');

  /* called by an inline script at the end of <body>, before deferred scripts touch the DOM */
  window.jmApplyI18n = function () {
    markSwitch();
    var T = window.JM_PT || {};
    blocks(d.body, function (el, k) { if (T[k] != null) el.innerHTML = T[k]; });
    attrs(d.body, function (el, a, k) { if (T[k] != null) el.setAttribute(a, T[k]); });
    var t = T[hash(norm(d.title))]; if (t) d.title = t;
    var md = d.querySelector('meta[name="description"]');
    if (md) { var v = T[hash(norm(md.getAttribute('content') || ''))]; if (v) md.setAttribute('content', v); }
    html.classList.remove('i18n-pending');
  };
  setTimeout(function () { html.classList.remove('i18n-pending'); }, 1500);
})();
