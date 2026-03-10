document.documentElement.classList.add("js");

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector<HTMLButtonElement>(".nav-toggle");
  const links = document.querySelector<HTMLElement>(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
  }

  const tabs = document.querySelectorAll<HTMLButtonElement>(".showcase-tabs button");
  const showcaseWindow = document.querySelector<HTMLElement>(".showcase-window");
  const windowBar = showcaseWindow?.querySelector<HTMLElement>(".window-bar");
  if (tabs.length && showcaseWindow && windowBar) {
    const placeholderSvg = `<svg viewBox="0 0 1212 642" xmlns="http://www.w3.org/2000/svg" role="img" style="width:100%;display:block">
      <rect width="1212" height="642" fill="#111818"/>
      <text x="606" y="321" text-anchor="middle" fill="rgba(74,234,204,0.5)" font-family="Space Mono,monospace" font-size="18">TODO: screenshot</text>
    </svg>`;

    const setShowcaseContent = (name: string | null) => {
      const existing = showcaseWindow.querySelector("picture, .showcase-placeholder");
      if (existing) existing.remove();

      if (name) {
        const picture = document.createElement("picture");
        const source = document.createElement("source");
        source.srcset = `/assets/screenshots/${name}.webp`;
        source.type = "image/webp";
        const img = document.createElement("img");
        img.src = `/assets/screenshots/${name}.png`;
        img.alt = "Screenshot";
        img.width = 1212;
        img.height = 642;
        img.style.width = "100%";
        img.style.display = "block";
        picture.appendChild(source);
        picture.appendChild(img);
        showcaseWindow.appendChild(picture);
      } else {
        const div = document.createElement("div");
        div.className = "showcase-placeholder";
        div.innerHTML = placeholderSvg;
        showcaseWindow.appendChild(div);
      }
    };

    tabs[0].classList.add("active");
    const firstName = tabs[0].getAttribute("data-img");
    setShowcaseContent(firstName || null);

    tabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        tabs.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const name = btn.getAttribute("data-img");
        setShowcaseContent(name || null);
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

  document.querySelectorAll<HTMLElement>(".nav-cta, .btn-accent").forEach((btn) => {
    if (btn.getAttribute("href") === "#") {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        pendingModal.classList.add("visible");
      });
    }
  });

  const navLinks = document.querySelectorAll<HTMLAnchorElement>(".nav-links a");
  const path = location.pathname.replace(/\/index\.html$/, "/").replace(/\/$/, "") || "/";

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
          const link = document.querySelector<HTMLAnchorElement>(`.nav-links a[href="#${id}"]`);
          if (!link) return;
          if (entry.isIntersecting) {
            navLinks.forEach((a) => {
              if (a.getAttribute("href")!.startsWith("#"))
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
