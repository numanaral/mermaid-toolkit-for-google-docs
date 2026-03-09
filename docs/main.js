document.addEventListener("DOMContentLoaded", function () {
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      links.classList.toggle("open");
    });
  }

  var tabs = document.querySelectorAll(".showcase-tabs button");
  var img = document.getElementById("ss");
  if (tabs.length && img) {
    tabs[0].classList.add("active");
    tabs.forEach(function (btn) {
      btn.addEventListener("click", function () {
        tabs.forEach(function (b) {
          b.classList.remove("active");
        });
        btn.classList.add("active");
        img.src = "assets/" + btn.getAttribute("data-img") + ".png";
      });
    });
  }

  var navLinks = document.querySelectorAll(".nav-links a");
  var page = location.pathname.split("/").pop() || "index.html";

  navLinks.forEach(function (a) {
    var href = a.getAttribute("href");
    if (href && !href.startsWith("#") && href === page) {
      a.classList.add("active");
    }
  });

  var sections = document.querySelectorAll("section[id]");
  if (sections.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var id = entry.target.id;
          var link = document.querySelector('.nav-links a[href="#' + id + '"]');
          if (!link) return;
          if (entry.isIntersecting) {
            navLinks.forEach(function (a) {
              if (a.getAttribute("href").startsWith("#"))
                a.classList.remove("active");
            });
            link.classList.add("active");
          }
        });
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );

    sections.forEach(function (s) {
      observer.observe(s);
    });
  }
});
