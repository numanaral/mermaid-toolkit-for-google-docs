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
        howTabs.forEach((t) => t.classList.remove("active"));
        howPanels.forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        const panel = document.getElementById(`how-panel-${target}`);
        if (panel) panel.classList.add("active");
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
