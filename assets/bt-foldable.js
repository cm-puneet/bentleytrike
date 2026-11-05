/* Foldable Trike PDP (bt-foldable-* sections). Loaded with defer; each section may include it, so it guards itself. */
(() => {
  if (window.btFoldableLoaded) return;
  window.btFoldableLoaded = true;

  const root = (window.Shopify && Shopify.routes && Shopify.routes.root) || '/';

  // Adds items and hands the result to the theme's cart drawer, like the theme's own product form does.
  async function addItems(items) {
    const detail = { sections: [] };
    document.documentElement.dispatchEvent(new CustomEvent('cart:prepare-bundled-sections', { bubbles: true, detail }));
    const res = await fetch(root + 'cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ items, sections: detail.sections.join(',') })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.description || json.message || 'Could not add to cart. Please try again.');
    const cart = await (await fetch(root + 'cart.js')).json();
    cart.sections = json.sections;
    if (window.themeVariables && themeVariables.settings.cartType === 'page') return (window.location.href = root + 'cart');
    document.dispatchEvent(new CustomEvent('variant:add', { bubbles: true, detail: { items: json.items || items, cart } }));
    document.documentElement.dispatchEvent(new CustomEvent('cart:change', { bubbles: true, detail: { baseEvent: 'variant:add', cart } }));
  }

  customElements.define('btf-buy-box', class extends HTMLElement {
    connectedCallback() {
      this.form = this.querySelector('form');
      this.button = this.querySelector('[data-cta]');
      this.error = this.querySelector('[data-error]');
      this.addEventListener('change', (e) => {
        if (e.target.name !== 'btf-set') return;
        this.update(e.target);
        // Sets whose accessories have options (e.g. helmet size) open their popup straight away.
        const dialog = e.target.hasAttribute('data-auto-open') && this.querySelector('#btf-addons-' + e.target.value);
        if (dialog) dialog.showModal();
      });
      // Finish tiles from variants: keep the current query (view, preview) and only swap the variant.
      this.addEventListener('click', (e) => {
        const a = e.target.closest('[data-variant-link]');
        if (!a || e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        const url = new URL(window.location.href);
        url.searchParams.set('variant', new URL(a.href).searchParams.get('variant'));
        window.location.href = url;
      });
      this.form.addEventListener('submit', (e) => this.submit(e));
      // Accessory popup: opening it picks that set; option changes swap the accessory's variant in every set.
      this.addEventListener('click', (e) => {
        const b = e.target.closest('[data-addon-open]');
        if (!b) return;
        e.preventDefault();
        const input = this.querySelector(`input[name="btf-set"][value="${b.dataset.addonOpen}"]`);
        if (input && !input.disabled && !input.checked) { input.checked = true; this.update(input); }
        const dialog = this.querySelector('#btf-addons-' + b.dataset.addonOpen);
        if (dialog) dialog.showModal();
      });
      this.addEventListener('change', (e) => {
        const box = e.target.closest('.btf-addon');
        if (box && e.target.matches('[data-option]')) this.pickAddon(box);
      });
      const checked = this.querySelector('input[name="btf-set"]:checked');
      if (checked) this.update(checked);
    }
    pickAddon(box) {
      const pid = box.dataset.product;
      const values = [...box.querySelectorAll('[data-option]')].map((s) => s.value);
      const v = JSON.parse(box.querySelector('[data-variants]').textContent).find((x) => x.o.every((o, i) => o === values[i]));
      const ok = Boolean(v && v.a);
      this.querySelectorAll(`.btf-addon[data-product="${pid}"]`).forEach((other) => {
        other.querySelectorAll('[data-option]').forEach((s, i) => { s.value = values[i]; });
        other.querySelector('[data-addon-error]').hidden = ok;
        const img = other.querySelector('img');
        if (img && v && v.img) { img.removeAttribute('srcset'); img.src = v.img; }
      });
      if (!ok) return;
      this.querySelectorAll('input[name="btf-set"]').forEach((input) => {
        const pids = input.dataset.addonProducts.split(','), ids = input.dataset.addons.split(',');
        pids.forEach((p, i) => { if (p === pid) ids[i] = String(v.id); });
        input.dataset.addons = ids.join(',');
      });
    }
    update(input) {
      const d = input.dataset;
      const price = this.querySelector('[data-cta-price]');
      if (price) price.textContent = d.price;
      const inst = this.querySelector('[data-installment]');
      if (inst) inst.textContent = d.installment;
      const note = this.querySelector('[data-set-note]');
      if (note) { note.textContent = d.note; note.hidden = !d.note; }
    }
    async submit(e) {
      e.preventDefault();
      if (this.button.getAttribute('aria-busy') === 'true') return;
      const set = this.querySelector('input[name="btf-set"]:checked');
      // Main item is built from the form like the theme's product form, so properties and selling plans added by apps (Globo pre-order) and theme blocks are kept.
      const fd = new FormData(this.form), main = { id: Number(fd.get('id')), quantity: Number(fd.get('quantity')) || 1 }, props = {};
      for (const [k, v] of fd) {
        const m = k.match(/^properties\[(.+)\]$/);
        if (m && typeof v === 'string' && v !== '') props[m[1]] = v;
      }
      if (Object.keys(props).length) main.properties = props;
      if (fd.get('selling_plan')) main.selling_plan = Number(fd.get('selling_plan'));
      const items = [main];
      if (set && set.dataset.addons) set.dataset.addons.split(',').filter(Boolean).forEach((id) => items.push({ id: Number(id), quantity: 1 }));
      this.button.setAttribute('aria-busy', 'true');
      this.error.hidden = true;
      try {
        await addItems(items);
      } catch (err) {
        this.error.textContent = err.message;
        this.error.hidden = false;
      }
      this.button.removeAttribute('aria-busy');
    }
  });

  // Mobile gallery: thumbnails scroll the strip, and follow the image in view.
  customElements.define('btf-gallery', class extends HTMLElement {
    connectedCallback() {
      const strip = this.querySelector('.btf-gallery');
      const items = [...strip.children], thumbs = [...this.querySelectorAll('.btf-thumb')];
      if (!thumbs.length) return;
      this.addEventListener('click', (e) => {
        const t = e.target.closest('.btf-thumb');
        if (t) strip.scrollTo({ left: items[Number(t.dataset.index)].offsetLeft - strip.offsetLeft, behavior: 'smooth' });
      });
      const io = new IntersectionObserver((entries) => entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const i = items.indexOf(en.target);
        thumbs.forEach((t, k) => t.setAttribute('aria-current', String(k === i)));
      }), { root: strip, threshold: .6 });
      items.forEach((it) => io.observe(it));
    }
  });

  customElements.define('btf-hotspots', class extends HTMLElement {
    connectedCallback() {
      this.panels = [...this.querySelectorAll('[data-panel]')];
      this.addEventListener('click', (e) => {
        const t = e.target.closest('[data-go], [data-step]');
        if (!t) return;
        const n = this.panels.length, cur = this.panels.findIndex((p) => !p.hidden);
        this.show(t.dataset.go != null ? Number(t.dataset.go) : (cur + Number(t.dataset.step) + n) % n);
      });
    }
    show(i) {
      this.panels.forEach((p, j) => {
        p.hidden = i !== j;
        const v = p.querySelector('video');
        if (v) i === j ? v.play().catch(() => {}) : v.pause();
      });
      this.querySelectorAll('[data-go]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.go) === i)));
    }
  });

  // Finish carousel: 5 tiles in view, arrows page through, the current finish starts in view.
  customElements.define('btf-finish-rail', class extends HTMLElement {
    connectedCallback() {
      const rail = this.querySelector('.btf-finishes'), [prev, next] = this.querySelectorAll('[data-step]');
      const sync = () => {
        prev.disabled = rail.scrollLeft < 2;
        next.disabled = rail.scrollLeft + rail.clientWidth > rail.scrollWidth - 2;
      };
      const cur = rail.querySelector('[aria-current="true"]');
      if (cur && cur.offsetLeft - rail.offsetLeft >= rail.clientWidth) rail.scrollLeft = cur.offsetLeft - rail.offsetLeft;
      this.addEventListener('click', (e) => {
        const b = e.target.closest('[data-step]');
        if (b) rail.scrollBy({ left: Number(b.dataset.step) * rail.clientWidth, behavior: 'smooth' });
      });
      rail.addEventListener('scroll', sync, { passive: true });
      sync();
    }
  });

  // Mobile stat bar: moves to the next stat on a timer, pauses while touched, off for reduced motion.
  customElements.define('btf-autoscroll', class extends HTMLElement {
    connectedCallback() {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      let paused = false;
      const pause = () => { paused = true; clearTimeout(this.resume); this.resume = setTimeout(() => { paused = false; }, 5000); };
      this.addEventListener('pointerdown', pause, { passive: true });
      this.addEventListener('touchstart', pause, { passive: true });
      this.timer = setInterval(() => {
        if (paused || this.scrollWidth <= this.clientWidth + 2) return;
        const end = this.scrollLeft + this.clientWidth >= this.scrollWidth - 2;
        this.scrollTo({ left: end ? 0 : this.scrollLeft + this.clientWidth + (parseFloat(getComputedStyle(this).columnGap) || 0), behavior: 'smooth' });
      }, (Number(this.dataset.interval) || 3) * 1000);
    }
    disconnectedCallback() { clearInterval(this.timer); clearTimeout(this.resume); }
  });

  customElements.define('btf-rail', class extends HTMLElement {
    connectedCallback() {
      const rail = this.querySelector('.btf-rail');
      this.addEventListener('click', (e) => {
        const b = e.target.closest('[data-step]');
        if (!b) return;
        const card = rail.querySelector('article');
        rail.scrollBy({ left: Number(b.dataset.step) * (card ? card.offsetWidth + 16 : rail.clientWidth * .8), behavior: 'smooth' });
      });
      // Arrows only show when the cards don't all fit (e.g. 4 cards on desktop: hidden; on mobile: shown).
      const arrows = this.querySelector('.btf-arrows');
      if (arrows && 'ResizeObserver' in window) {
        const fit = () => {
          const last = rail.querySelector('article:last-of-type');
          // The rail's end padding doesn't count: hidden when the last card is fully in view without scrolling.
          arrows.hidden = !last || last.getBoundingClientRect().right + rail.scrollLeft <= rail.getBoundingClientRect().right + 1;
        };
        new ResizeObserver(fit).observe(rail);
      }
    }
  });

  customElements.define('btf-section-nav', class extends HTMLElement {
    connectedCallback() {
      const links = [...this.querySelectorAll('a[href^="#"]')];
      const targets = links.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean);
      if (!targets.length || !('IntersectionObserver' in window)) return;
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          links.forEach((a) => a.setAttribute('aria-current', String(a.hash === '#' + en.target.id)));
        });
      }, { rootMargin: '-30% 0px -60% 0px' });
      targets.forEach((t) => io.observe(t));
    }
  });

  // Muted loop videos (fold, stages) play only while on screen, so nothing downloads or runs out of view.
  const videoObserver = 'IntersectionObserver' in window && new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) en.target.play().catch(() => {}); else en.target.pause();
  }), { threshold: .25 });
  const watchVideos = (root) => videoObserver && root.querySelectorAll('video.btf-autovideo').forEach((v) => videoObserver.observe(v));
  watchVideos(document);
  document.addEventListener('shopify:section:load', (e) => watchVideos(e.target));

  // Quick add buttons (cross-sell)
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-btf-quick-add]');
    if (!b || b.getAttribute('aria-busy') === 'true') return;
    b.setAttribute('aria-busy', 'true');
    try {
      await addItems([{ id: Number(b.dataset.btfQuickAdd), quantity: 1 }]);
      b.setAttribute('aria-pressed', 'true');
      b.textContent = b.dataset.addedLabel;
    } catch (err) {
      b.textContent = err.message;
    }
    b.removeAttribute('aria-busy');
  });

  // "Add to cart" links elsewhere on the page jump to the finish picker and flash it.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href="#choose-finish"]');
    const el = a && document.getElementById('choose-finish');
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ block: 'center' });
    el.classList.remove('btf-flash');
    void el.offsetWidth;
    el.classList.add('btf-flash');
  });
})();
