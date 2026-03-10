document.documentElement.classList.add("js");

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
  }

  const tabs = document.querySelectorAll(".showcase-tabs button");
  const img = document.getElementById("ss");
  if (tabs.length && img) {
    tabs[0].classList.add("active");
    tabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        tabs.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const name = btn.getAttribute("data-img");
        const source = img.parentElement.querySelector("source");
        if (source) source.srcset = `assets/${name}.webp`;
        img.src = `assets/${name}.png`;
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

  pendingModal.addEventListener("click", (e) => {
    if (
      e.target === pendingModal ||
      e.target.classList.contains("pending-modal-close")
    ) {
      pendingModal.classList.remove("visible");
    }
  });

  document.querySelectorAll(".nav-cta, .btn-accent").forEach((btn) => {
    if (btn.getAttribute("href") === "#") {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        pendingModal.classList.add("visible");
      });
    }
  });

  const navLinks = document.querySelectorAll(".nav-links a");
  const page = location.pathname.split("/").pop() || "index.html";

  navLinks.forEach((a) => {
    const href = a.getAttribute("href");
    if (href && !href.startsWith("#") && href === page) {
      a.classList.add("active");
    }
  });

  const sections = document.querySelectorAll("section[id]");
  if (sections.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const { id } = entry.target;
          const link = document.querySelector(`.nav-links a[href="#${id}"]`);
          if (!link) return;
          if (entry.isIntersecting) {
            navLinks.forEach((a) => {
              if (a.getAttribute("href").startsWith("#"))
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
      (entries) => {
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
