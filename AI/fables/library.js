const DATASET = "neonforestmist/smolgpt-markdown-stories";
const DATASET_API = "https://datasets-server.huggingface.co/rows";
const CATALOG_BASE = "../../assets/ai/fables/catalog/";
const STUDIO_EXAMPLES = "../../assets/ai/fables/studio-examples.json";
const PAGE_SIZE = 20;

const elements = {
  list: document.querySelector("#library-list"),
  reader: document.querySelector("#story-reader"),
  results: document.querySelector("#story-results"),
  status: document.querySelector("#library-status"),
  filters: document.querySelector("#genre-filters"),
  prev: document.querySelector("#page-prev"),
  next: document.querySelector("#page-next"),
  pageLabel: document.querySelector("#page-label"),
  pageJump: document.querySelector("#page-jump"),
  pageNumber: document.querySelector("#page-number"),
  back: document.querySelector("#story-back"),
  title: document.querySelector("#story-title"),
  meta: document.querySelector("#story-meta"),
  body: document.querySelector("#story-body"),
  source: document.querySelector("#story-source"),
  sourceButtons: [...document.querySelectorAll("[data-source]")],
  readerView: document.querySelector("#reader-view"),
  readerViewButtons: [...document.querySelectorAll("[data-reader-view]")],
};

const state = {
  manifest: null,
  studio: null,
  source: "archive",
  genre: "all",
  page: 0,
  request: 0,
  genreCatalogs: new Map(),
  rowCache: new Map(),
  readerText: null,
};

function prettyGenre(genre) {
  return genre.split("-").map((word) => word === "noir" ? "Noir" : word[0].toUpperCase() + word.slice(1)).join(" ");
}

function setStatus(message) {
  elements.status.textContent = message;
}

function showEmpty(message, retry = false) {
  elements.results.replaceChildren();
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = message;
  if (retry) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "empty-retry";
    button.textContent = "Try again";
    button.addEventListener("click", renderResults);
    empty.append(document.createElement("br"), button);
  }
  elements.results.append(empty);
}

async function getJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}

async function getDatasetRows(split, offset, length) {
  const query = new URLSearchParams({ dataset: DATASET, config: "stories", split, offset: String(offset), length: String(length) });
  const data = await getJSON(`${DATASET_API}?${query}`);
  return data.rows.map(({ row, row_idx: rowIndex }) => ({ ...row, split, rowIndex }));
}

async function getGenreCatalog(genre) {
  if (!state.genreCatalogs.has(genre)) {
    const entry = state.manifest.genres.find((item) => item.id === genre);
    if (!entry) throw new Error("Unknown genre");
    state.genreCatalogs.set(genre, getJSON(`${CATALOG_BASE}${entry.file}`));
  }
  return state.genreCatalogs.get(genre);
}

function archiveLocation(globalIndex) {
  let offset = globalIndex;
  for (const split of state.manifest.splits) {
    const count = state.manifest.splitCounts[split];
    if (offset < count) return { split, offset, available: count - offset };
    offset -= count;
  }
  throw new Error("Story index is outside the archive");
}

async function getArchivePage() {
  if (state.genre !== "all") {
    const all = await getGenreCatalog(state.genre);
    const pageRows = all.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE);
    return {
      total: all.length,
      stories: pageRows.map(([splitIndex, rowIndex, storyId, title, sceneCount, words]) => ({
        kind: "archive",
        split: state.manifest.splits[splitIndex], rowIndex, storyId, title,
        genre: state.genre, sceneCount, words,
      })),
    };
  }

  const total = state.manifest.total;
  const stories = [];
  let globalIndex = state.page * PAGE_SIZE;
  while (stories.length < PAGE_SIZE && globalIndex < total) {
    const { split, offset, available } = archiveLocation(globalIndex);
    const rows = await getDatasetRows(split, offset, Math.min(PAGE_SIZE - stories.length, available));
    if (rows.length === 0) break;
    rows.forEach((row) => {
      state.rowCache.set(row.story_id, row);
      stories.push({
        kind: "archive", split, rowIndex: row.rowIndex, storyId: row.story_id,
        title: row.title, genre: row.genre, sceneCount: row.scene_count, words: row.words,
      });
    });
    globalIndex += rows.length;
  }
  return { total, stories };
}

function getStudioPage() {
  const all = state.studio.filter((story) => state.genre === "all" || story.genre === state.genre);
  return {
    total: all.length,
    stories: all.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE).map((story, index) => ({
      ...story,
      kind: "studio",
      storyId: `studio-${state.page * PAGE_SIZE + index}`,
      sceneCount: story.scene_count,
    })),
  };
}

function updatePagination(total) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  elements.prev.disabled = state.page === 0;
  elements.next.disabled = state.page >= pages - 1;
  elements.pageLabel.textContent = `Page ${(state.page + 1).toLocaleString()} of ${pages.toLocaleString()}`;
  elements.pageNumber.max = String(pages);
  elements.pageNumber.value = String(state.page + 1);
}

function storyCard(story) {
  const article = document.createElement("article");
  article.className = "story-card";
  article.setAttribute("role", "listitem");
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", `Read ${story.title}`);
  const genre = document.createElement("span");
  genre.className = "story-genre";
  genre.textContent = prettyGenre(story.genre);
  const title = document.createElement("h3");
  title.textContent = story.title;
  const details = document.createElement("p");
  const scenes = Number(story.sceneCount);
  const pieces = [];
  if (scenes) pieces.push(`${scenes} ${scenes === 1 ? "scene" : "scenes"}`);
  if (story.words) pieces.push(`${Number(story.words).toLocaleString()} words`);
  if (story.kind === "studio") pieces.push("Captured Studio output");
  details.textContent = pieces.join(" · ");
  const action = document.createElement("span");
  action.className = "story-read";
  action.textContent = "Read story →";
  button.append(genre, title, details, action);
  button.addEventListener("click", () => openStory(story));
  article.append(button);
  return article;
}

async function renderResults() {
  const request = ++state.request;
  elements.results.replaceChildren();
  setStatus("Loading stories…");
  elements.prev.disabled = true;
  elements.next.disabled = true;
  try {
    const { total, stories } = state.source === "archive" ? await getArchivePage() : getStudioPage();
    if (request !== state.request) return;
    if (!stories.length) {
      showEmpty(state.source === "studio" ? "No captured Studio stories in this genre yet." : "No stories on this page.");
    } else {
      elements.results.replaceChildren(...stories.map(storyCard));
    }
    setStatus(`${total.toLocaleString()} ${total === 1 ? "story" : "stories"}${state.genre === "all" ? "" : ` in ${prettyGenre(state.genre)}`}`);
    updatePagination(total);
  } catch (error) {
    if (request !== state.request) return;
    setStatus("Stories could not load");
    showEmpty("The story source is unavailable right now.", true);
    console.error("Fables library:", error);
  }
}

function renderGenres() {
  let genres = state.manifest.genres;
  if (state.source === "studio") {
    const available = new Set(state.studio.map((story) => story.genre));
    genres = genres.filter((genre) => available.has(genre.id));
  }
  const choices = [{ id: "all", label: "All genres" }, ...genres];
  elements.filters.replaceChildren(...choices.map((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "genre-pill";
    button.dataset.genre = choice.id;
    button.textContent = choice.label;
    button.setAttribute("aria-pressed", String(state.genre === choice.id));
    button.addEventListener("click", () => {
      if (state.genre === choice.id) return;
      state.genre = choice.id;
      state.page = 0;
      renderGenres();
      renderResults();
    });
    return button;
  }));
}

function renderMarkdown(markdown) {
  const root = document.createDocumentFragment();
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let paragraph = [];
  let list = null;

  function flushParagraph() {
    if (!paragraph.length) return;
    const p = document.createElement("p");
    p.textContent = paragraph.join(" ").trim();
    root.append(p);
    paragraph = [];
  }
  function flushList() { list = null; }
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushParagraph(); flushList(); continue; }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph(); flushList();
      const h = document.createElement(`h${heading[1].length}`);
      h.textContent = heading[2];
      root.append(h);
      continue;
    }
    if (/^(?:---+|\*\*\*+)$/.test(line)) {
      flushParagraph(); flushList(); root.append(document.createElement("hr")); continue;
    }
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const numbered = /^\d+\.\s+(.+)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const type = bullet ? "ul" : "ol";
      if (!list || list.tagName.toLowerCase() !== type) {
        list = document.createElement(type);
        root.append(list);
      }
      const item = document.createElement("li");
      item.textContent = (bullet || numbered)[1];
      list.append(item);
      continue;
    }
    if (line.startsWith("> ")) {
      flushParagraph(); flushList();
      const block = document.createElement("blockquote");
      block.textContent = line.slice(2);
      root.append(block);
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  return root;
}

function setReaderView(view) {
  if (!state.readerText) return;
  elements.readerViewButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.readerView === view)));
  elements.body.replaceChildren(renderMarkdown(view === "markdown" ? state.readerText.full : state.readerText.story));
}

async function openStory(story) {
  elements.list.hidden = true;
  elements.reader.hidden = false;
  elements.title.textContent = story.title;
  elements.meta.replaceChildren();
  elements.body.textContent = "Loading story…";
  elements.readerView.hidden = true;
  elements.source.hidden = true;
  window.scrollTo({ top: 0, behavior: "instant" });
  elements.reader.focus();

  try {
    let text;
    let storyText;
    if (story.kind === "studio") {
      text = story.text;
      storyText = text;
      elements.source.href = story.source_url || "https://huggingface.co/spaces/neonforestmist/SmolGPT-Fable-Studio";
      elements.source.firstChild.textContent = "View Studio source ";
    } else {
      let row = state.rowCache.get(story.storyId);
      if (!row || row.split !== story.split || row.rowIndex !== story.rowIndex) {
        [row] = await getDatasetRows(story.split, story.rowIndex, 1);
      }
      if (!row || row.story_id !== story.storyId) throw new Error("Archive row changed since this catalog was built");
      state.rowCache.set(row.story_id, row);
      text = row.text;
      storyText = row.completion || text;
      elements.source.href = `https://huggingface.co/datasets/${DATASET}/viewer/stories/${story.split}?row=${story.rowIndex}`;
      elements.source.firstChild.textContent = "View dataset row ";
    }
    const metadata = [prettyGenre(story.genre), `${story.sceneCount} ${Number(story.sceneCount) === 1 ? "scene" : "scenes"}`];
    if (story.words) metadata.push(`${Number(story.words).toLocaleString()} words`);
    if (story.kind === "studio") metadata.push("SmolGPT Fables Studio output");
    elements.meta.replaceChildren(...metadata.map((label) => {
      const span = document.createElement("span");
      span.textContent = label;
      return span;
    }));
    state.readerText = { full: text, story: storyText };
    elements.readerView.hidden = story.kind === "studio";
    setReaderView("story");
    elements.source.hidden = false;
  } catch (error) {
    elements.body.textContent = "This story could not be loaded. Please return to the list and try again.";
    console.error("Fables reader:", error);
  }
}

elements.back.addEventListener("click", () => {
  elements.reader.hidden = true;
  elements.list.hidden = false;
  document.querySelector("#stories-title").scrollIntoView({ block: "start" });
});
elements.readerViewButtons.forEach((button) => button.addEventListener("click", () => setReaderView(button.dataset.readerView)));
elements.prev.addEventListener("click", () => { if (state.page > 0) { state.page--; renderResults(); document.querySelector("#stories-title").scrollIntoView(); } });
elements.next.addEventListener("click", () => { state.page++; renderResults(); document.querySelector("#stories-title").scrollIntoView(); });
elements.pageJump.addEventListener("submit", (event) => {
  event.preventDefault();
  const target = Number(elements.pageNumber.value);
  const maximum = Number(elements.pageNumber.max);
  if (!Number.isInteger(target) || target < 1 || target > maximum) return;
  state.page = target - 1;
  renderResults();
  document.querySelector("#stories-title").scrollIntoView();
});
elements.sourceButtons.forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.source === state.source) return;
  state.source = button.dataset.source;
  state.genre = "all";
  state.page = 0;
  elements.sourceButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  renderGenres();
  renderResults();
}));

async function initialize() {
  try {
    [state.manifest, state.studio] = await Promise.all([
      getJSON(`${CATALOG_BASE}manifest.json`),
      getJSON(STUDIO_EXAMPLES),
    ]);
    renderGenres();
    renderResults();
  } catch (error) {
    setStatus("Library could not load");
    showEmpty("The library index is unavailable right now.");
    console.error("Fables library:", error);
  }
}

initialize();
