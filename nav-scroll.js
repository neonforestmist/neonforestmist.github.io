(() => {
  const menu = document.querySelector(".menu-bar");

  if (!menu) {
    return;
  }

  const sentinel = document.createElement("span");
  sentinel.className = "menu-scroll-sentinel";
  sentinel.setAttribute("aria-hidden", "true");
  document.body.prepend(sentinel);

  const setScrolledState = (isScrolled) => {
    menu.classList.toggle("is-scrolled", isScrolled);
  };

  setScrolledState(window.scrollY > 24);

  const observer = new IntersectionObserver(([entry]) => {
    setScrolledState(!entry.isIntersecting);
  });

  observer.observe(sentinel);
})();
