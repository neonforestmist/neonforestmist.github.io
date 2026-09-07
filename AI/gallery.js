const aiRoot = document.querySelector("[data-ai-tabs]");
const aiTabs = Array.from(aiRoot.querySelectorAll("[data-ai-tab]"));
const aiPanels = Array.from(aiRoot.querySelectorAll("[data-ai-panel]"));
function activateAI(key) {
  if (!aiPanels.some((panel) => panel.dataset.aiPanel === key)) key = "models";
  aiTabs.forEach((tab) => {
    const active = tab.dataset.aiTab === key;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  aiPanels.forEach((panel) => {
    const active = panel.dataset.aiPanel === key;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
}
aiTabs.forEach((tab) => tab.addEventListener("click", () => activateAI(tab.dataset.aiTab)));
aiRoot.querySelectorAll("[data-ai-jump]").forEach((button) => {
  button.addEventListener("click", () => {
    activateAI(button.dataset.aiJump);
    aiTabs.find((tab) => tab.dataset.aiTab === button.dataset.aiJump)?.focus();
  });
});
activateAI(location.hash.slice(1) || "models");
window.addEventListener("hashchange", () => {
  activateAI(location.hash.slice(1) || "models");
});

const viewer = document.querySelector(".clover-viewer");
const galleryItems = [
  {
    image: "../assets/ai/clover-image-tiny/moonlit-greenhouse.png",
    title: "Moonlit greenhouse",
    prompt: "a tiny glass greenhouse glowing in a moonlit garden",
  },
  {
    image: "../assets/ai/clover-image-tiny/blue-flowers.png",
    title: "Blue flowers",
    prompt: "A bouquet of blue flowers",
  },
  {
    image: "../assets/ai/clover-image-tiny/stained-glass-night.png",
    title: "Stained-glass night",
    prompt: "A stain glass window of a starry night",
  },
  {
    image: "../assets/ai/clover-image-tiny/snowy-mountains.png",
    title: "Snowy mountains",
    prompt: "snowy mountains under a cloudy sky",
  },
  {
    image: "../assets/ai/clover-image-tiny/desert-moon.png",
    title: "Desert moon",
    prompt: "A desert with a big moon in the sky",
  },
  {
    image: "../assets/ai/clover-image-tiny/origami-heart.png",
    title: "Origami heart",
    prompt: "An origami heart",
  },
];
const viewerImage = viewer.querySelector(".clover-viewer-image");
let selected = 0;
let opener;
function showImage(index) {
  selected = (index + galleryItems.length) % galleryItems.length;
  const item = galleryItems[selected];
  viewerImage.src = item.image;
  viewerImage.alt = item.title;
  document.getElementById("clover-viewer-title").textContent = item.title;
  document.getElementById("clover-viewer-prompt").value = item.prompt;
  viewer.querySelector("[data-clover-count]").textContent = `${selected + 1} / ${galleryItems.length}`;
}
document.querySelectorAll("[data-clover-explore]").forEach((button) => button.addEventListener("click", () => {
  opener = button;
  showImage(0);
  viewer.showModal();
}));
viewer.querySelector("[data-clover-previous]").addEventListener("click", () => showImage(selected - 1));
viewer.querySelector("[data-clover-next]").addEventListener("click", () => showImage(selected + 1));
viewer.addEventListener("keydown", (event) => {
  if (event.target.tagName !== "TEXTAREA" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
    event.preventDefault();
    showImage(selected + (event.key === "ArrowRight" ? 1 : -1));
  }
});
viewer.addEventListener("click", (event) => {
  if (event.target !== viewer) return;
  const bounds = viewer.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) viewer.close();
});
viewer.addEventListener("close", () => opener?.focus({ preventScroll: true }));
let touchStart;
viewerImage.addEventListener("touchstart", (event) => {
  touchStart = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
}, { passive: true });
viewerImage.addEventListener("touchend", (event) => {
  if (!touchStart || !event.changedTouches.length) return;
  const dx = event.changedTouches[0].clientX - touchStart.x;
  const dy = event.changedTouches[0].clientY - touchStart.y;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) showImage(selected + (dx < 0 ? 1 : -1));
  touchStart = null;
}, { passive: true });
viewerImage.addEventListener("touchcancel", () => { touchStart = null; }, { passive: true });
