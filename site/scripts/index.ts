document.documentElement.classList.add("js");

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector<HTMLButtonElement>(".nav-toggle");
  const links = document.querySelector<HTMLElement>(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
  }

  const howTabs = document.querySelectorAll<HTMLButtonElement>(".how-tab");
  const howPanels = document.querySelectorAll<HTMLElement>(".how-panel");
  if (howTabs.length && howPanels.length) {
    howTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.getAttribute("data-tab");
        howTabs.forEach((t) => {
          t.classList.remove("active");
          t.setAttribute("aria-selected", "false");
        });
        howPanels.forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        tab.setAttribute("aria-selected", "true");
        const panel = document.getElementById(`how-panel-${target}`);
        if (panel) {
          panel.classList.add("active");
          const gifPlayer = panel.querySelector(".gif-player");
          if (gifPlayer) {
            gifPlayer.classList.remove("gif-slide-in");
            void (gifPlayer as HTMLElement).offsetWidth;
            gifPlayer.classList.add("gif-slide-in");
            const img = gifPlayer.querySelector<HTMLImageElement>("img");
            if (img) {
              const src = img.src;
              img.src = "";
              img.src = src;
            }
          }
        }
      });
    });
  }

  const pendingModal = document.createElement("div");
  pendingModal.className = "pending-modal";
  pendingModal.innerHTML = `
    <div class="pending-modal-card">
      <div class="pending-modal-icon">\u23F3</div>
      <h3>Awaiting Google Verification</h3>
      <p>Currently undergoing branding verification by Google\u2019s Trust & Safety team.
         The Marketplace listing will be submitted for review once verification is complete. Install link coming soon!</p>
      <button class="pending-modal-close">Got it</button>
    </div>`;
  document.body.appendChild(pendingModal);

  pendingModal.addEventListener("click", (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target === pendingModal ||
      target.classList.contains("pending-modal-close")
    ) {
      pendingModal.classList.remove("visible");
    }
  });

  document
    .querySelectorAll<HTMLElement>(".nav-cta, .btn-accent")
    .forEach((btn) => {
      if (btn.getAttribute("href") === "#") {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          pendingModal.classList.add("visible");
        });
      }
    });

  const navLinks = document.querySelectorAll<HTMLAnchorElement>(".nav-links a");
  const path =
    location.pathname.replace(/\/index\.html$/, "/").replace(/\/$/, "") || "/";

  navLinks.forEach((a) => {
    const href = a.getAttribute("href");
    if (href && !href.startsWith("#") && !href.startsWith("/#")) {
      const hrefNorm = href.replace(/\/$/, "") || "/";
      if (hrefNorm === path) a.classList.add("active");
    }
  });

  const sections = document.querySelectorAll<HTMLElement>("section[id]");
  if (sections.length) {
    const observer = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        entries.forEach((entry) => {
          const { id } = entry.target;
          const link =
            document.querySelector<HTMLAnchorElement>(
              `.nav-links a[href="#${id}"]`,
            ) ||
            document.querySelector<HTMLAnchorElement>(
              `.nav-links a[href="/#${id}"]`,
            );
          if (!link) return;
          if (entry.isIntersecting) {
            navLinks.forEach((a) => {
              const h = a.getAttribute("href")!;
              if (h.startsWith("#") || h.startsWith("/#"))
                a.classList.remove("active");
            });
            link.classList.add("active");
          }
        });
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );

    sections.forEach((s) => observer.observe(s));
  }

  document
    .querySelectorAll(".gallery-item")
    .forEach((el) => el.classList.add("reveal"));

  const gifModal = document.createElement("div");
  gifModal.className = "gif-modal-overlay";
  gifModal.innerHTML = `<img src="" alt="">
    <div class="gif-modal-controls">
      <button class="gif-modal-reset" title="Replay"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></button>
      <button class="gif-modal-close" title="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>`;
  document.body.appendChild(gifModal);

  const modalImg = gifModal.querySelector<HTMLImageElement>("img")!;
  const modalReset =
    gifModal.querySelector<HTMLButtonElement>(".gif-modal-reset")!;
  const modalClose =
    gifModal.querySelector<HTMLButtonElement>(".gif-modal-close")!;

  const closeGifModal = () => gifModal.classList.remove("visible");

  modalClose.addEventListener("click", closeGifModal);
  gifModal.addEventListener("click", (e) => {
    if (e.target === gifModal) closeGifModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && gifModal.classList.contains("visible"))
      closeGifModal();
  });
  modalReset.addEventListener("click", () => {
    const s = modalImg.src;
    modalImg.src = "";
    modalImg.src = s;
  });

  document.querySelectorAll<HTMLElement>(".gif-player").forEach((player) => {
    const img = player.querySelector<HTMLImageElement>("img");
    if (!img) return;

    const skeleton = document.createElement("div");
    skeleton.className = "gif-skeleton";
    if (!img.complete) {
      img.setAttribute("data-loading", "true");
      player.insertBefore(skeleton, img);
      img.addEventListener(
        "load",
        () => {
          img.removeAttribute("data-loading");
          skeleton.remove();
        },
        { once: true },
      );
    }

    const resetBtn = player.querySelector<HTMLButtonElement>(".gif-reset");
    const fsBtn = player.querySelector<HTMLButtonElement>(".gif-fullscreen");

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        const src = img.src;
        img.src = "";
        img.src = src;
      });
    }
    if (fsBtn) {
      fsBtn.addEventListener("click", () => {
        modalImg.src = "";
        modalImg.src = img.src;
        modalImg.alt = img.alt;
        gifModal.classList.add("visible");
      });
    }
  });

  const reveals = document.querySelectorAll(".reveal, .reveal-stagger");
  if (reveals.length) {
    const revealObserver = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    reveals.forEach((el) => revealObserver.observe(el));
  }
});
