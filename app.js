/* =========================================
   MEBLOVE — High-end interactions (JS)
   File: app.js
   Features:
   - Mobile nav with outside-click + ESC
   - Reveal-on-scroll (IntersectionObserver)
   - Hero counters (count-up)
   - Projects filters
   - Reviews carousel controls
   - Modal (quote) with focus trap + ESC + body lock
   - Forms validation + mailto builder (no backend needed)
   - Smooth scroll to anchors (safe)
   - Scroll-to-top
   - Subtle parallax / pointer tilt for hero (optional, reduced motion aware)
   ========================================= */

(() => {
  "use strict";

  /* ----------------------------
     Helpers
  ---------------------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

  const lockBodyScroll = (lock) => {
    const body = document.body;
    if (lock) {
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      body.dataset.scrollLock = "1";
      body.style.overflow = "hidden";
      body.style.paddingRight = scrollBarWidth > 0 ? `${scrollBarWidth}px` : "";
    } else {
      delete body.dataset.scrollLock;
      body.style.overflow = "";
      body.style.paddingRight = "";
    }
  };

  const isEmailValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(email || "").trim());

  const serializeForm = (form) => {
    const data = new FormData(form);
    const obj = {};
    for (const [k, v] of data.entries()) obj[k] = String(v).trim();
    // checkbox fields (consent) won't appear if unchecked; handle separately when needed
    return obj;
  };

  const setNote = (el, msg, tone = "neutral") => {
    if (!el) return;
    el.textContent = msg || "";
    el.dataset.tone = tone; // CSS not necessary; left for extensibility
  };

  const markInvalid = (input, state) => {
    if (!input) return;
    if (state) input.classList.add("is-invalid");
    else input.classList.remove("is-invalid");
  };

  const closeOnEscape = (onEscape) => {
    const handler = (e) => {
      if (e.key === "Escape") onEscape(e);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  };

  const onOutsideClick = (rootEl, onOutside) => {
    const handler = (e) => {
      if (!rootEl.contains(e.target)) onOutside(e);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  };

  /* ----------------------------
     Year
  ---------------------------- */
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ----------------------------
     Smooth anchor scroll (safe)
     - Keeps native behavior for external links
  ---------------------------- */
  const enableSmoothAnchors = () => {
    $$('a[href^="#"]').forEach((a) => {
      const href = a.getAttribute("href");
      if (!href || href === "#") return;

      a.addEventListener("click", (e) => {
        const id = href.slice(1);
        const target = document.getElementById(id);
        if (!target) return;

        e.preventDefault();

        // account for sticky topbar+header height
        const topbar = $(".topbar");
        const header = $(".header");
        const offset =
          (topbar ? topbar.getBoundingClientRect().height : 0) +
          (header ? header.getBoundingClientRect().height : 0) +
          14;

        const y = window.scrollY + target.getBoundingClientRect().top - offset;
        window.scrollTo({ top: y, behavior: prefersReducedMotion ? "auto" : "smooth" });

        // close nav if open
        closeMobileNav();
      });
    });
  };

  /* ----------------------------
     Mobile navigation
  ---------------------------- */
  const navToggle = $(".nav__toggle");
  const navMenu = $("#navMenu");
  let removeNavEsc = null;
  let removeNavOutside = null;

  const openMobileNav = () => {
    if (!navToggle || !navMenu) return;

    navToggle.classList.add("is-open");
    navMenu.classList.add("is-open");
    navToggle.setAttribute("aria-expanded", "true");

    if (!removeNavEsc) {
      removeNavEsc = closeOnEscape(() => closeMobileNav());
    }
    if (!removeNavOutside) {
      removeNavOutside = onOutsideClick(navMenu, (e) => {
        // allow clicking the toggle itself without closing before it toggles
        if (navToggle.contains(e.target)) return;
        closeMobileNav();
      });
    }
  };

  const closeMobileNav = () => {
    if (!navToggle || !navMenu) return;

    navToggle.classList.remove("is-open");
    navMenu.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");

    if (removeNavEsc) {
      removeNavEsc();
      removeNavEsc = null;
    }
    if (removeNavOutside) {
      removeNavOutside();
      removeNavOutside = null;
    }
  };

  const toggleMobileNav = () => {
    if (!navToggle || !navMenu) return;
    const open = navMenu.classList.contains("is-open");
    if (open) closeMobileNav();
    else openMobileNav();
  };

  if (navToggle) {
    navToggle.addEventListener("click", toggleMobileNav);
  }

  // Close mobile nav on resize to desktop
  window.addEventListener("resize", () => {
    if (window.innerWidth > 760) closeMobileNav();
  });

  /* ----------------------------
     Reveal-on-scroll
  ---------------------------- */
  const enableReveals = () => {
    const nodes = $$(".reveal");
    if (!nodes.length) return;

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      nodes.forEach((n) => n.classList.add("is-visible"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { root: null, threshold: 0.12 }
    );

    nodes.forEach((n) => io.observe(n));
  };

  /* ----------------------------
     Hero counters
  ---------------------------- */
  const enableCounters = () => {
    const counters = $$("[data-count]");
    if (!counters.length) return;

    const animateCount = (el, to) => {
      const duration = prefersReducedMotion ? 1 : 1200;
      const start = performance.now();
      const from = 0;

      const tick = (now) => {
        const t = clamp((now - start) / duration, 0, 1);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
        const val = Math.round(from + (to - from) * eased);

        el.textContent = String(val);

        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = String(to);
      };

      requestAnimationFrame(tick);
    };

    const run = () => counters.forEach((el) => animateCount(el, Number(el.dataset.count || "0")));

    // Only run when hero visible
    const hero = $(".hero");
    if (!hero || !("IntersectionObserver" in window) || prefersReducedMotion) {
      run();
      return;
    }

    let ran = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (!ran && entries.some((e) => e.isIntersecting)) {
          ran = true;
          run();
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(hero);
  };

  /* ----------------------------
     Projects filter
  ---------------------------- */
  const enableProjectFilter = () => {
    const grid = $("#projectGrid");
    if (!grid) return;

    const filters = $$(".filter");
    const items = $$(".project", grid);
    if (!filters.length || !items.length) return;

    const setActive = (btn) => {
      filters.forEach((b) => {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
    };

    const applyFilter = (key) => {
      items.forEach((card) => {
        const tags = String(card.dataset.tags || "").split(",").map((s) => s.trim()).filter(Boolean);
        const show = key === "all" ? true : tags.includes(key);
        card.classList.toggle("is-hidden", !show);
      });
    };

    filters.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.filter || "all";
        setActive(btn);
        applyFilter(key);
      });
    });
  };

  /* ----------------------------
     Reviews carousel controls
  ---------------------------- */
  const enableCarousel = () => {
    const carousel = $("[data-carousel]");
    if (!carousel) return;

    const track = $("[data-carousel-track]", carousel);
    const prev = $("[data-carousel-prev]", carousel);
    const next = $("[data-carousel-next]", carousel);
    if (!track) return;

    const scrollByCard = (dir) => {
      const firstCard = track.children[0];
      const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : 340;
      const gap = 16;
      const step = cardWidth + gap;
      track.scrollBy({ left: dir * step, behavior: prefersReducedMotion ? "auto" : "smooth" });
    };

    if (prev) prev.addEventListener("click", () => scrollByCard(-1));
    if (next) next.addEventListener("click", () => scrollByCard(1));

    // Optional: keyboard support when track focused
    track.setAttribute("tabindex", "0");
    track.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") scrollByCard(-1);
      if (e.key === "ArrowRight") scrollByCard(1);
    });
  };

  /* ----------------------------
     Modal with focus trap
  ---------------------------- */
  const modal = $("#modalQuote");
  const modalPanel = modal ? $(".modal__panel", modal) : null;
  const quoteForm = $("#quoteForm");
  const quoteServiceSelect = $("#quoteService");
  let removeModalEsc = null;
  let lastActiveEl = null;

  const getFocusable = (root) =>
    $$(
      [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(","),
      root
    ).filter((el) => el.offsetParent !== null);

  const trapFocus = (root) => {
    const handler = (e) => {
      if (e.key !== "Tab") return;

      const focusable = getFocusable(root);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener("keydown", handler);
    return () => root.removeEventListener("keydown", handler);
  };

  let removeFocusTrap = null;

  const openModal = (servicePrefill = "") => {
    if (!modal || !modalPanel) return;

    lastActiveEl = document.activeElement;

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    lockBodyScroll(true);

    // prefill service if provided
    if (quoteServiceSelect && servicePrefill) {
      // try to match option by includes
      const options = Array.from(quoteServiceSelect.options);
      const found = options.find((o) => o.textContent.trim().toLowerCase().includes(servicePrefill.trim().toLowerCase()));
      if (found) quoteServiceSelect.value = found.value;
      else quoteServiceSelect.value = servicePrefill;
    }

    // focus first focusable element in modal
    const focusable = getFocusable(modalPanel);
    (focusable[0] || modalPanel).focus?.();

    // focus trap + esc
    if (!removeFocusTrap) removeFocusTrap = trapFocus(modalPanel);
    if (!removeModalEsc) removeModalEsc = closeOnEscape(() => closeModal());

    // close on backdrop click
    const backdrop = $("[data-close-modal]", modal);
    if (backdrop) {
      // already handled by attribute for both close buttons/backdrop in binding below
    }
  };

  const closeModal = () => {
    if (!modal) return;

    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    lockBodyScroll(false);

    if (removeModalEsc) {
      removeModalEsc();
      removeModalEsc = null;
    }
    if (removeFocusTrap) {
      removeFocusTrap();
      removeFocusTrap = null;
    }

    // return focus
    if (lastActiveEl && typeof lastActiveEl.focus === "function") {
      lastActiveEl.focus();
    }
    lastActiveEl = null;
  };

  // Bind modal open triggers
  $$("[data-open-modal='quote']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const service = btn.dataset.service || "";
      openModal(service);
    });
  });

  // Bind close triggers (backdrop and X and Cancel)
  if (modal) {
    $$("[data-close-modal]", modal).forEach((el) => el.addEventListener("click", closeModal));
    // prevent panel clicks from closing (only backdrop has data-close-modal)
    modal.addEventListener("click", (e) => {
      // no-op; backdrop is explicit
    });
  }

  /* ----------------------------
     Accordion behavior (FAQ)
     - Optional: only one open at a time
  ---------------------------- */
  const enableAccordion = () => {
    const acc = $("[data-accordion]");
    if (!acc) return;

    const items = $$("details", acc);
    items.forEach((d) => {
      d.addEventListener("toggle", () => {
        if (!d.open) return;
        items.forEach((other) => {
          if (other !== d) other.removeAttribute("open");
        });
      });
    });
  };

  /* ----------------------------
     Forms: validation + mailto
  ---------------------------- */
  const buildMailto = ({ subject, body }) => {
    const to = "biuro@meblove.com.pl";
    const params = new URLSearchParams();
    params.set("subject", subject);
    params.set("body", body);
    return `mailto:${to}?${params.toString()}`;
  };

  const validateContactForm = (form) => {
    const note = $("#formNote");
    setNote(note, "");

    const name = form.elements.namedItem("name");
    const phone = form.elements.namedItem("phone");
    const email = form.elements.namedItem("email");
    const topic = form.elements.namedItem("topic");
    const message = form.elements.namedItem("message");
    const consent = form.elements.namedItem("consent");

    let ok = true;

    // reset invalid styles
    [name, phone, email, topic, message].forEach((el) => markInvalid(el, false));

    if (!name || String(name.value).trim().length < 2) {
      markInvalid(name, true);
      ok = false;
    }

    if (!email || !isEmailValid(email.value)) {
      markInvalid(email, true);
      ok = false;
    }

    if (!topic || !String(topic.value || "").trim()) {
      markInvalid(topic, true);
      ok = false;
    }

    if (!message || String(message.value).trim().length < 10) {
      markInvalid(message, true);
      ok = false;
    }

    const consentOk = consent && consent.checked;
    if (!consentOk) ok = false;

    if (!ok) {
      setNote(note, "Uzupełnij wymagane pola i zaznacz zgodę na kontakt.", "error");
    }

    return ok;
  };

  const validateQuoteForm = (form) => {
    const note = $("#quoteNote");
    setNote(note, "");

    const service = form.elements.namedItem("service");
    const city = form.elements.namedItem("city");
    const name = form.elements.namedItem("name");
    const email = form.elements.namedItem("email");
    const details = form.elements.namedItem("details");
    const consent = form.elements.namedItem("consent");

    let ok = true;
    [service, city, name, email, details].forEach((el) => markInvalid(el, false));

    if (!service || !String(service.value || "").trim()) {
      markInvalid(service, true);
      ok = false;
    }

    if (!name || String(name.value).trim().length < 2) {
      markInvalid(name, true);
      ok = false;
    }

    if (!email || !isEmailValid(email.value)) {
      markInvalid(email, true);
      ok = false;
    }

    if (!details || String(details.value).trim().length < 10) {
      markInvalid(details, true);
      ok = false;
    }

    const consentOk = consent && consent.checked;
    if (!consentOk) ok = false;

    if (!ok) {
      setNote(note, "Uzupełnij wymagane pola i zaznacz zgodę na kontakt.", "error");
    }

    return ok;
  };

  const attachFormUX = (form) => {
    if (!form) return;

    // Remove invalid class as user edits
    const inputs = $$("input, select, textarea", form);
    inputs.forEach((el) => {
      el.addEventListener("input", () => el.classList.remove("is-invalid"));
      el.addEventListener("change", () => el.classList.remove("is-invalid"));
    });
  };

  // Contact form
  const contactForm = $("#contactForm");
  if (contactForm) {
    attachFormUX(contactForm);

    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const note = $("#formNote");
      if (!validateContactForm(contactForm)) return;

      const data = serializeForm(contactForm);
      const consent = contactForm.elements.namedItem("consent")?.checked ? "TAK" : "NIE";

      const subject = `Meblove — zapytanie: ${data.topic || "Kontakt"} (${data.name || ""})`.trim();

      const bodyLines = [
        "Dzień dobry,",
        "",
        "Chciałbym/chciałabym zapytać o:",
        `- Temat: ${data.topic || "-"}`,
        `- Imię: ${data.name || "-"}`,
        `- Telefon: ${data.phone || "-"}`,
        `- E-mail: ${data.email || "-"}`,
        `- Zgoda na kontakt: ${consent}`,
        "",
        "Wiadomość:",
        data.message || "-",
        "",
        "—",
        "Wysłano ze strony meblove (formularz kontaktowy).",
      ];

      const href = buildMailto({ subject, body: bodyLines.join("\n") });

      setNote(note, "Otwieram Twoją pocztę z przygotowaną wiadomością…", "ok");

      // Open mail client
      window.location.href = href;

      // Optional: reset form after a short delay
      setTimeout(() => {
        contactForm.reset();
        setNote(note, "Jeśli mail się nie otworzył, skopiuj treść i wyślij na biuro@meblove.com.pl.", "neutral");
      }, 800);
    });
  }

  // Quote form (modal)
  if (quoteForm) {
    attachFormUX(quoteForm);

    quoteForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const note = $("#quoteNote");
      if (!validateQuoteForm(quoteForm)) return;

      const data = serializeForm(quoteForm);
      const consent = quoteForm.elements.namedItem("consent")?.checked ? "TAK" : "NIE";

      const subject = `Meblove — bezpłatna wycena: ${data.service || "Zapytanie"} (${data.name || ""})`.trim();

      const bodyLines = [
        "Dzień dobry,",
        "",
        "Proszę o bezpłatną wycenę:",
        `- Usługa: ${data.service || "-"}`,
        `- Miasto: ${data.city || "-"}`,
        `- Imię: ${data.name || "-"}`,
        `- E-mail: ${data.email || "-"}`,
        `- Zgoda na kontakt: ${consent}`,
        "",
        "Opis / wymiary / inspiracje:",
        data.details || "-",
        "",
        "—",
        "Wysłano ze strony meblove (szybka wycena).",
      ];

      const href = buildMailto({ subject, body: bodyLines.join("\n") });

      setNote(note, "Otwieram Twoją pocztę z przygotowaną wiadomością…", "ok");
      window.location.href = href;

      setTimeout(() => {
        quoteForm.reset();
        setNote(note, "Jeśli mail się nie otworzył, wyślij ręcznie na biuro@meblove.com.pl.", "neutral");
        closeModal();
      }, 900);
    });
  }

  /* ----------------------------
     Scroll to top
  ---------------------------- */
  const enableScrollTop = () => {
    $$("[data-scroll-top]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
      });
    });
  };

  /* ----------------------------
     Hero subtle parallax / tilt
     (only if not reduced motion)
  ---------------------------- */
  const enableHeroTilt = () => {
    if (prefersReducedMotion) return;

    const hero = $(".hero");
    const frame = $(".showcase__frame");
    if (!hero || !frame) return;

    // disable on small screens where layout changes
    const isDesktop = () => window.innerWidth > 980;

    let raf = 0;
    const onMove = (e) => {
      if (!isDesktop()) return;

      const rect = hero.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      const ry = (x - 0.5) * -10; // -5..5
      const rx = (y - 0.5) * 7;   // -3.5..3.5

      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        frame.style.transform = `perspective(1200px) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg) translateY(-2px)`;
      });
    };

    const onLeave = () => {
      cancelAnimationFrame(raf);
      frame.style.transform = "";
    };

    hero.addEventListener("mousemove", onMove);
    hero.addEventListener("mouseleave", onLeave);

    window.addEventListener("resize", () => {
      if (!isDesktop()) onLeave();
    });
  };

  /* ----------------------------
     Offer -> modal prefill (already via data-service)
     Plus: map offer "Poproś o wycenę" click to open modal
  ---------------------------- */
  const enableServicePrefillButtons = () => {
    $$("[data-open-modal='quote'][data-service]").forEach((btn) => {
      btn.addEventListener("click", () => {
        // handled by global open binding above; this is here for future expansion
      });
    });
  };

  /* ----------------------------
     Init
  ---------------------------- */
  const init = () => {
    enableSmoothAnchors();
    enableReveals();
    enableCounters();
    enableProjectFilter();
    enableCarousel();
    enableAccordion();
    enableScrollTop();
    enableHeroTilt();
    enableServicePrefillButtons();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
