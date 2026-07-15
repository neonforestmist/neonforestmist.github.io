(() => {
  const menu = document.querySelector(".menu-bar");

  if (!menu) {
    return;
  }

  const toggle = menu.querySelector(".menu-toggle");
  const hamburger = menu.querySelector(".menu-hamburger");
  const links = menu.querySelector(".menu-links");

  if (!toggle || !hamburger || !links) {
    return;
  }

  if (!links.id) {
    links.id = "site-menu-links";
  }

  if (!links.querySelector("a.active")) {
    const normalizePath = (value) => {
      const path = new URL(value, window.location.origin).pathname
        .replace(/\/index\.html$/, "")
        .replace(/\/$/, "");

      return path || "/";
    };
    const currentPath = normalizePath(window.location.pathname);

    links.querySelectorAll("a[href]").forEach((link) => {
      if (normalizePath(link.href) === currentPath) {
        link.classList.add("active");
      }
    });
  }

  toggle.setAttribute("aria-controls", links.id);
  toggle.setAttribute("aria-expanded", "false");

  const setMenuOpen = (isOpen) => {
    toggle.checked = isOpen;
    menu.classList.toggle("menu-open", isOpen);
    document.body.classList.toggle("menu-open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
  };

  toggle.addEventListener("change", () => {
    setMenuOpen(toggle.checked);
  });

  links.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      setMenuOpen(false);
    }
  });

  document.addEventListener("click", (event) => {
    if (!toggle.checked || menu.contains(event.target)) {
      return;
    }

    setMenuOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && toggle.checked) {
      setMenuOpen(false);
      toggle.focus();
    }
  });

  const desktopQuery = window.matchMedia("(min-width: 901px)");

  desktopQuery.addEventListener("change", (event) => {
    if (event.matches) {
      setMenuOpen(false);
    }
  });

  setMenuOpen(toggle.checked);
})();
