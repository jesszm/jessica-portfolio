/* JM · Case 02 · Crypex — page behaviours
   1. A click-through prototype built on the real exported screens, with
      hotspots like Figma's prototype mode.
   2. Numbered lists that open the matching comment pin on hover (the pins
      themselves are the keyboard targets, wired in main.js).
   Everything here is progressive: without JS the prototype is hidden and the
   static screens below tell the same story. */
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const IMG = '../assets/img/crypex/';
  const W = 786, H = 1704; // export size, hotspot boxes are in these pixels

  /* ---------- 1. Prototype ---------- */
  const root = document.querySelector('[data-proto]');
  if (root) {
    const tabHome = { box: [222, 1515, 338, 1630], to: 'home', label: 'Home tab' };
    const screens = {
      home: { src: 'home.webp', step: 0, alt: 'Home screen: AI insights, services and the crypto market.',
        hint: 'Start with the Pay button in the tab bar, or the Pix card.',
        spots: [{ box: [340, 1515, 446, 1630], to: 'amount0', label: 'Pay tab', primary: true },
                { box: [48, 716, 300, 932], to: 'amount0', label: 'Pix card' }] },
      amount0: { src: 'pay-amount-empty.webp', step: 1, alt: 'Pay screen with ETH and Pix at zero; Continue is disabled.',
        hint: 'Type an amount on the keypad. Continue stays off until you do.',
        spots: [{ box: [56, 774, 728, 1235], to: 'amount', label: 'Type an amount on the keypad', primary: true }, tabHome] },
      amount: { src: 'pay-amount.webp', step: 1, alt: 'Pay screen: 0.13 ETH converts to R$ 2,500.00 at the live rate; Continue is on.',
        hint: 'Both sides of the trade, one screen. Now Continue wakes up.',
        spots: [{ box: [392, 1238, 726, 1354], to: 'recipient', label: 'Continue', primary: true }, tabHome] },
      recipient: { src: 'pay-recipient.webp', step: 2, alt: 'Recipient screen: Pix key entered, with the name, masked CPF and bank of Marina Alves Costa.',
        hint: 'The Pix key shows who is receiving before anything is sent.',
        spots: [{ box: [48, 1514, 738, 1614], to: 'review', label: 'Continue', primary: true }] },
      review: { src: 'pay-review.webp', step: 3, alt: 'Review screen: value, 10% fee, totals in reais and ETH, the wallet address and the time left.',
        hint: 'Every number in the open. Copy the address to send the ETH.',
        spots: [{ box: [68, 1234, 718, 1306], to: 'result', label: 'Copy the address and send the ETH', primary: true }, tabHome] },
      success: { src: 'pay-success.webp', step: 4, alt: 'Payment complete, with a link to payment history.',
        hint: 'A calm ending with one way forward.',
        spots: [{ box: [250, 930, 536, 978], to: 'history', label: 'See payment history', primary: true }, tabHome] },
      failure: { src: 'pay-failure.webp', step: 4, alt: 'Payment failed, with an explanation and a link to payment history.',
        hint: 'Same calm layout when it goes wrong: what happened and where to go.',
        spots: [{ box: [250, 1054, 536, 1102], to: 'history', label: 'See payment history', primary: true }, tabHome] },
      history: { src: 'history.webp', step: 5, alt: 'Payment history with the total for the period and a list of payments.',
        hint: 'Where the money went. Close to start again.',
        spots: [{ box: [676, 180, 766, 264], to: 'home', label: 'Close and go home', primary: true }] },
    };
    const stepNames = ['Home', 'Amount', 'Recipient', 'Review', 'Result', 'History'];

    const img = root.querySelector('[data-proto-screen]');
    const layer = root.querySelector('[data-proto-hotspots]');
    const phone = root.querySelector('[data-proto-phone]');
    const hint = root.querySelector('[data-proto-hint]');
    const live = root.querySelector('[data-proto-live]');
    const timer = root.querySelector('[data-proto-timer]');
    const clock = root.querySelector('[data-proto-clock]');
    const fail = root.querySelector('[data-proto-fail]');
    const steps = [...root.querySelectorAll('[data-go]')];
    let current = 'home', tick = 0, left = 600, flashT = 0;

    // warm the cache so every tap swaps instantly
    Object.values(screens).forEach(s => { const i = new Image(); i.src = IMG + s.src; });

    const resolve = (to) => (to === 'result' ? (fail.checked ? 'failure' : 'success') : to);
    const fmt = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

    const runClock = (on) => {
      clearInterval(tick); timer.hidden = !on;
      if (!on) return;
      left = 600; clock.textContent = fmt(left);
      tick = setInterval(() => { left = left > 0 ? left - 1 : 600; clock.textContent = fmt(left); }, 1000);
    };

    const go = (to, { focus = false } = {}) => {
      const id = resolve(to), s = screens[id];
      current = id;
      img.src = IMG + s.src; img.alt = s.alt;
      if (!reduced) img.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
      layer.replaceChildren(...s.spots.map((sp) => {
        const b = document.createElement('button');
        const [x0, y0, x1, y1] = sp.box;
        b.type = 'button';
        b.className = 'cx-hotspot' + (sp.primary ? ' cx-hotspot--primary' : '');
        b.style.cssText = `left:${x0 / W * 100}%;top:${y0 / H * 100}%;width:${(x1 - x0) / W * 100}%;height:${(y1 - y0) / H * 100}%`;
        b.setAttribute('aria-label', sp.label);
        b.addEventListener('click', (e) => { e.stopPropagation(); go(sp.to, { focus: true }); });
        return b;
      }));
      steps.forEach((b, i) => { if (i === s.step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      hint.textContent = s.hint;
      live.textContent = `Step ${s.step + 1} of 6, ${stepNames[s.step]}. ${s.alt}`;
      runClock(id === 'review');
      if (focus) layer.querySelector('.cx-hotspot--primary')?.focus({ preventScroll: true });
    };

    // Figma habit: clicking outside a hotspot flashes where you can click
    phone.addEventListener('click', () => {
      phone.classList.add('is-flash'); clearTimeout(flashT);
      flashT = setTimeout(() => phone.classList.remove('is-flash'), 700);
    });
    steps.forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
    root.querySelector('[data-proto-restart]').addEventListener('click', () => go('home'));
    fail.addEventListener('change', () => { if (current === 'success' || current === 'failure') go('result'); });
    // pause the clock when the prototype is off screen
    new IntersectionObserver(([e]) => { if (current === 'review') runClock(e.isIntersecting); }).observe(root);

    go('home');
  }

  /* ---------- 2. Numbered lists ↔ comment pins ---------- */
  document.querySelectorAll('.cx-list--pins [data-pin]').forEach((li) => {
    const pin = document.getElementById(li.dataset.pin);
    if (!pin) return;
    const on = () => { document.querySelectorAll('.pin[data-open="true"]').forEach(p => p.setAttribute('data-open', 'false')); pin.setAttribute('data-open', 'true'); };
    const off = () => pin.setAttribute('data-open', 'false');
    li.addEventListener('mouseenter', on); li.addEventListener('mouseleave', off);
  });
})();
