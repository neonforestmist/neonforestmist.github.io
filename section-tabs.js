// Give every section rail the same keyboard navigation, including App Store filters.
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".section-tabs").forEach((rail) => {
    const buttons = Array.from(rail.querySelectorAll("button"));
    const sync = () => buttons.forEach((button) => {
      button.tabIndex = button.classList.contains("is-active") ? 0 : -1;
    });
    sync();
    rail.addEventListener("click", () => queueMicrotask(sync));
    rail.addEventListener("keydown", (event) => {
      const current = buttons.indexOf(document.activeElement);
      if (current < 0) return;
      let next;
      if (["ArrowRight", "ArrowDown"].includes(event.key)) next = (current + 1) % buttons.length;
      if (["ArrowLeft", "ArrowUp"].includes(event.key)) next = (current - 1 + buttons.length) % buttons.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = buttons.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      buttons[next].click();
      buttons[next].focus();
      sync();
    });
  });
});
