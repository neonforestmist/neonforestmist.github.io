const aiRoot = document.querySelector("[data-ai-tabs]");
const aiTabs = Array.from(aiRoot.querySelectorAll("[data-ai-tab]"));
const aiPanels = Array.from(aiRoot.querySelectorAll("[data-ai-panel]"));
function activateAI(key) {
  if (!aiTabs.some((tab) => tab.dataset.aiTab === key)) {
    key = "models";
    if (location.hash) history.replaceState(null, "", "#models");
  }
  if (location.hash !== `#${key}`) history.replaceState(null, "", `#${key}`);
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
