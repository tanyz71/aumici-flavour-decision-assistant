const GOOGLE_SHEET_ID = "1Ao1cB5x5-d-PZZYORg7MsFDclcu8cQ0dXL18BGhJ8-c";
const GOOGLE_SHEET_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/edit`;
const GOOGLE_EMBED_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/preview`;
const GOOGLE_GVIZ_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq`;
const SAVED_CREATIONS_KEY = "aumici-saved-creations";
const FLAVOUR_SHEET_CANDIDATES = ["flavours", "Flavours", "flavor", "Flavor", "flavors", "Flavors", "flavour", "Flavour"];
const TOPPING_SHEET_CANDIDATES = ["toppings", "Toppings", "topping", "Topping"];

const OCCASIONS = [
  "Birthday, promotion, team win",
  "Date night, anniversary, sharing",
  "Weekend treat, slow afternoon",
  "Hot afternoon, outdoor event, after lunch",
  "Bazaar, kiosk, tropical weather",
  "Work break, study break",
  "Family outing, rainy day",
  "Social media dessert, tasting flight",
  "Corporate event, hotel dessert bar",
  "Wellness event, daytime dessert",
  "Chef's table, R&D tasting, workshop",
  "Birthday party, school event",
  "Networking, premium client hospitality",
  "Raya, CNY, Deepavali, Christmas",
  "Brunch, cafe pairing",
  "Multi-course meal, wedding dinner"
];

const MOODS = [
  "Happy / celebratory",
  "Romantic / intimate",
  "Relaxed / peaceful",
  "Tired / overheated",
  "Thirsty / heat-stressed",
  "Stressed / mentally drained",
  "Comfort / nostalgic",
  "Playful / adventurous",
  "Elegant / sophisticated",
  "Health-conscious / light",
  "Curious / experimental",
  "Kids / fun-loving",
  "Mature / business",
  "Festive / cultural",
  "Morning pick-me-up",
  "Cleanse-the-palate"
];

const TYPE_HINTS = {
  gelato: ["comfort", "nostalgic", "romantic", "indulgent", "celebration", "birthday", "business", "elegant"],
  sorbet: ["light", "refreshing", "healthy", "peaceful", "relaxed", "cleanse", "wellness", "fruit"],
  granita: ["hot", "heat", "thirsty", "outdoor", "tropical", "energising", "afternoon", "cooling"]
};

const elements = {
  workbookTitle: document.querySelector("#workbookTitle"),
  workbookPath: document.querySelector("#workbookPath"),
  openSheetButton: document.querySelector("#openSheetButton"),
  refreshEmbedButton: document.querySelector("#refreshEmbedButton"),
  embeddedSheet: document.querySelector("#embeddedSheet"),
  helpPrompt: document.querySelector("#helpPrompt"),
  engineModeSwitch: document.querySelector("#engineModeSwitch"),
  engineModeHint: document.querySelector("#engineModeHint"),
  startChoices: document.querySelector("#startChoices"),
  occasionStep: document.querySelector("#occasionStep"),
  moodStep: document.querySelector("#moodStep"),
  occasionInput: document.querySelector("#occasionInput"),
  moodInput: document.querySelector("#moodInput"),
  occasionOptions: document.querySelector("#occasionOptions"),
  moodOptions: document.querySelector("#moodOptions"),
  menuSection: document.querySelector("#menuSection"),
  menuTabs: document.querySelector("#menuTabs"),
  menuGrid: document.querySelector("#menuGrid"),
  toppingList: document.querySelector("#toppingList"),
  toppingSelectionMeta: document.querySelector("#toppingSelectionMeta"),
  recommendationSection: document.querySelector("#recommendationSection"),
  recommendationGrid: document.querySelector("#recommendationGrid"),
  recommendationLead: document.querySelector("#recommendationLead"),
  recommendationMeta: document.querySelector("#recommendationMeta"),
  customerNameInput: document.querySelector("#customerNameInput"),
  creationNameInput: document.querySelector("#creationNameInput"),
  saveCreationStatus: document.querySelector("#saveCreationStatus"),
  savedCreationsList: document.querySelector("#savedCreationsList")
};

const state = {
  flavours: [],
  toppings: [],
  selectedOccasion: "",
  selectedMood: "",
  activeMenuType: "gelato",
  selectedMenuToppings: [],
  openAiConfigured: false,
  engineMode: "local",
  recommendationRequestId: 0,
  currentRecommendationCards: [],
  savedCreations: loadSavedCreations()
};

bootstrap();

async function bootstrap() {
  elements.workbookTitle.textContent = "Aumici Ordering Assistant";
  elements.workbookPath.innerHTML = `Google Sheet: <a href="${GOOGLE_SHEET_URL}" target="_blank" rel="noreferrer">${GOOGLE_SHEET_URL}</a>`;
  elements.embeddedSheet.src = `${GOOGLE_EMBED_URL}?rm=minimal`;
  renderChoiceButtons();
  renderOptionGroup(elements.occasionOptions, OCCASIONS, "occasion");
  renderOptionGroup(elements.moodOptions, MOODS, "mood");
  bindBaseActions();
  bindTextInputs();
  await hydrateFromGoogleSheet();
  await hydrateOpenAiStatus();
  syncEngineModeUi();
  renderMenu();
}

function bindBaseActions() {
  elements.openSheetButton.addEventListener("click", () => {
    window.open(GOOGLE_SHEET_URL, "_blank", "noopener,noreferrer");
  });

  elements.menuTabs.querySelectorAll("[data-menu-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeMenuType = button.dataset.menuType;
      renderMenuTabs();
      renderMenu();
    });
  });

  elements.engineModeSwitch.addEventListener("change", () => {
    state.engineMode = elements.engineModeSwitch.checked && state.openAiConfigured ? "online" : "local";
    syncEngineModeUi();
    if (state.selectedOccasion && state.selectedMood) {
      maybeShowRecommendations();
    }
  });

  elements.refreshEmbedButton.addEventListener("click", async () => {
    const cacheBust = `ts=${Date.now()}`;
    elements.embeddedSheet.src = `${GOOGLE_EMBED_URL}?rm=minimal&${cacheBust}`;
    await hydrateFromGoogleSheet();
    renderMenu();
    maybeShowRecommendations();
  });
}

function renderChoiceButtons() {
  elements.startChoices.innerHTML = `
    <button class="mode-card" data-choice="yes" type="button">
      <strong>Guide me</strong>
      <p>Answer two quick questions and get five suggestions picked for you.</p>
    </button>
    <button class="mode-card" data-choice="no" type="button">
      <strong>Browse menu</strong>
      <p>See what is available right now and choose directly from the live menu.</p>
    </button>
  `;

  elements.startChoices.querySelectorAll("[data-choice]").forEach((button) => {
    button.addEventListener("click", () => handleInitialChoice(button.dataset.choice));
  });
}

function renderOptionGroup(container, options, type) {
  container.innerHTML = options
    .map(
      (option) => `
        <button class="choice-pill" data-${type}="${escapeHtml(option)}" type="button">
          ${escapeHtml(option)}
        </button>
      `
    )
    .join("");

  container.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      if (type === "occasion") {
        state.selectedOccasion = button.dataset.occasion;
        state.selectedMood = "";
        elements.occasionInput.value = state.selectedOccasion;
        elements.moodInput.value = "";
        highlightSelected(container, "occasion", state.selectedOccasion);
        highlightSelected(elements.moodOptions, "mood", "");
        elements.moodStep.classList.remove("hidden");
        elements.recommendationSection.classList.add("hidden");
      } else {
        state.selectedMood = button.dataset.mood;
        elements.moodInput.value = state.selectedMood;
        highlightSelected(container, "mood", state.selectedMood);
        maybeShowRecommendations();
      }
    });
  });
}

function bindTextInputs() {
  elements.occasionInput.addEventListener("input", () => {
    state.selectedOccasion = elements.occasionInput.value.trim();
    state.selectedMood = "";
    elements.moodInput.value = "";
    highlightSelected(elements.occasionOptions, "occasion", state.selectedOccasion);
    highlightSelected(elements.moodOptions, "mood", "");
    elements.moodStep.classList.toggle("hidden", !state.selectedOccasion);
    elements.recommendationSection.classList.add("hidden");
  });

  elements.moodInput.addEventListener("input", () => {
    state.selectedMood = elements.moodInput.value.trim();
    highlightSelected(elements.moodOptions, "mood", state.selectedMood);
    maybeShowRecommendations();
  });

  elements.customerNameInput.addEventListener("input", () => {
    renderSavedCreations();
  });
}

function highlightSelected(container, dataKey, selectedValue) {
  container.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset[dataKey] === selectedValue);
  });
}

function handleInitialChoice(choice) {
  setInitialChoiceState(choice);

  if (choice === "no") {
    state.activeMenuType = defaultMenuType();
    elements.menuSection.classList.remove("hidden");
    elements.occasionStep.classList.add("hidden");
    elements.moodStep.classList.add("hidden");
    elements.recommendationSection.classList.add("hidden");
    elements.helpPrompt.textContent = "Browse the live menu below and pick what sounds best.";
    renderMenuTabs();
    renderMenu();
    return;
  }

  elements.menuSection.classList.add("hidden");
  elements.recommendationSection.classList.add("hidden");
  elements.occasionStep.classList.remove("hidden");
  elements.helpPrompt.textContent = "Tell us the occasion and how you feel, and we will suggest your best matches.";
}

function setInitialChoiceState(choice) {
  elements.startChoices.querySelectorAll("[data-choice]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.choice === choice);
  });
}

async function hydrateFromGoogleSheet() {
  try {
    const [flavoursResult, toppingsResult] = await Promise.all([
      fetchSheetRows(FLAVOUR_SHEET_CANDIDATES),
      fetchSheetRows(TOPPING_SHEET_CANDIDATES)
    ]);

    const flavoursRows = flavoursResult.rows;
    const toppingsRows = toppingsResult.rows;

    state.flavours = flavoursRows.length > 1 ? mapFlavours(flavoursRows) : [];
    state.toppings = toppingsRows.length > 1 ? mapToppings(toppingsRows) : [];
  } catch (error) {
    state.flavours = [];
    state.toppings = [];
  }
}

async function hydrateOpenAiStatus() {
  try {
    const response = await fetch("/api/openai-status");
    if (!response.ok) {
      syncEngineModeUi();
      return;
    }
    const payload = await response.json();
    state.openAiConfigured = Boolean(payload.configured);
    if (state.openAiConfigured) {
      state.engineMode = "online";
    } else {
      state.engineMode = "local";
    }
  } catch {}
  syncEngineModeUi();
}

function syncEngineModeUi() {
  const onlineEnabled = state.openAiConfigured;
  if (!onlineEnabled) {
    state.engineMode = "local";
  }

  elements.engineModeSwitch.disabled = !onlineEnabled;
  elements.engineModeSwitch.checked = onlineEnabled && state.engineMode === "online";

  if (onlineEnabled && state.engineMode === "online") {
    elements.engineModeHint.textContent = "Online mode is active and uses OpenAI with a local fallback.";
    return;
  }

  if (onlineEnabled) {
    elements.engineModeHint.textContent = "Local mode is active. Switch on Online to use OpenAI-assisted recommendations.";
    return;
  }

  elements.engineModeHint.textContent = "Local mode is active. Online mode will appear when the OpenAI API is configured.";
}

async function fetchSheetRows(candidateNames) {
  const attempts = [];
  for (const name of candidateNames) {
    try {
      const response = await fetch(`/api/google-sheet?sheet=${encodeURIComponent(name)}`);
      if (!response.ok) {
        attempts.push({ sheet: name, status: `http ${response.status}` });
        continue;
      }
      const json = await response.json();
      const rows = parseGoogleTable(json.table);
      attempts.push({
        sheet: name,
        status: "ok",
        headerPreview: rows[0] || [],
        rowCount: Math.max(rows.length - 1, 0)
      });
      return {
        matchedSheet: name,
        rows,
        attempts
      };
    } catch (error) {
      attempts.push({ sheet: name, status: `error: ${String(error.message || error)}` });
    }
  }
  return {
    matchedSheet: "",
    rows: [],
    attempts
  };
}

function parseGoogleTable(table) {
  if (!table) {
    return [];
  }
  let headers = (table.cols || []).map((column) => column.label || "");
  let rows = (table.rows || []).map((row) =>
    (row.c || []).map((cell) => {
      if (!cell) {
        return "";
      }
      return cell.f ?? cell.v ?? "";
    })
  );

  const hasHeaderLabels = headers.some((header) => String(header || "").trim());
  if (!hasHeaderLabels && rows.length) {
    headers = rows[0].map((value) => String(value || "").trim());
    rows = rows.slice(1);
  }

  return [headers, ...rows];
}

function mapFlavours(rows) {
  const headers = rows[0].map((header) => normalizeKey(header));
  return rows
    .slice(1)
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) => {
      const item = Object.fromEntries(headers.map((header, index) => [header, String(row[index] || "").trim()]));
      const fallback = inferFlavourRow(row);
      return {
        name: pickValue(item, ["flavourname", "flavorname", "name", "item", "product"]) || fallback.name,
        type: pickValue(item, ["producttype", "type", "base"]) || fallback.type,
        price: pickValue(item, ["price", "baseprice", "sellingprice"]) || fallback.price,
        description: pickValue(item, ["description", "notes"]) || fallback.description,
        status: pickValue(item, ["status", "availability"]) || fallback.status,
        toppings: pickValue(item, ["recommendedtoppings", "toppings", "finish"]) || fallback.toppings,
        tags: splitList(pickValue(item, ["tags", "tasteprofile", "profile", "moodtags", "occasiontags"]) || fallback.tags)
      };
    })
    .filter((item) => item.name);
}

function mapToppings(rows) {
  const headers = rows[0].map((header) => normalizeKey(header));
  return rows
    .slice(1)
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) => {
      const item = Object.fromEntries(headers.map((header, index) => [header, String(row[index] || "").trim()]));
      const fallback = inferToppingRow(row);
      return {
        name: pickValue(item, ["toppingname", "name", "topping", "item"]) || fallback.name,
        price: pickValue(item, ["price", "priceaddon", "addonprice"]) || fallback.price,
        status: pickValue(item, ["status", "availability"]) || fallback.status,
        tags: splitList(pickValue(item, ["compatibilitytags", "tags", "pairswith", "profile"]) || fallback.tags),
        description: pickValue(item, ["description", "notes"]) || fallback.description
      };
    })
    .filter((item) => item.name);
}

function inferFlavourRow(row) {
  const values = row.map((cell) => String(cell || "").trim()).filter(Boolean);
  const joined = values.join(" | ");
  const type = values.find((value) => isKnownType(value)) || "";
  const price = values.find((value) => /^\$?\d+([.,]\d{1,2})?$/.test(value)) || "";
  const status = values.find((value) => isAvailabilityValue(value)) || "Available";
  const nameCandidates = values.filter((value) => !isKnownType(value) && !/^\$?\d+([.,]\d{1,2})?$/.test(value) && !isAvailabilityValue(value));
  const name = nameCandidates[0] || values[0] || "";
  const description = nameCandidates.slice(1).join(" | ");

  return {
    name,
    type,
    price,
    status,
    toppings: "",
    description: description || joined,
    tags: ""
  };
}

function inferToppingRow(row) {
  const values = row.map((cell) => String(cell || "").trim()).filter(Boolean);
  const joined = values.join(" | ");
  const price = values.find((value) => /^\$?\d+([.,]\d{1,2})?$/.test(value)) || "";
  const status = values.find((value) => isAvailabilityValue(value)) || "Available";
  const nameCandidates = values.filter((value) => !/^\$?\d+([.,]\d{1,2})?$/.test(value) && !isAvailabilityValue(value));
  const name = nameCandidates[0] || values[0] || "";
  const description = nameCandidates.slice(1).join(" | ");

  return {
    name,
    price,
    status,
    description: description || joined,
    tags: ""
  };
}

function renderMenu() {
  const availableItems = state.flavours.filter((item) => isAvailable(item.status));
  renderToppingPicker();

  if (!availableItems.length) {
    elements.menuGrid.innerHTML =
      '<article class="result-card"><p>No flavours are available yet. Add a <strong>Flavours</strong> tab in Google Sheets to drive the menu.</p></article>';
    return;
  }

  const itemsForTab = availableItems.filter((item) => normalizeMenuType(item.type) === state.activeMenuType);

  if (!itemsForTab.length) {
    const title = formatMenuTypeLabel(state.activeMenuType);
    elements.menuGrid.innerHTML = `<article class="result-card"><p>No ${escapeHtml(title.toLowerCase())} items are available right now.</p></article>`;
    return;
  }

  elements.menuGrid.innerHTML = itemsForTab
    .map(
      (item) => `
        <article class="result-card">
          <div class="result-card-head">
            <div>
              <span class="result-label">${escapeHtml(item.type || "Available now")}</span>
              <h3>${escapeHtml(item.name)}</h3>
            </div>
            <span class="score-chip">${escapeHtml(item.price || item.status || "Available")}</span>
          </div>
          <p>${escapeHtml(item.description || "Freshly available from the live menu.")}</p>
          <p><strong>Toppings:</strong> ${escapeHtml(item.toppings || "Ask at counter")}</p>
        </article>
      `
    )
    .join("");
}

function renderToppingPicker() {
  const availableToppings = state.toppings.filter((item) => isAvailable(item.status));

  if (!availableToppings.length) {
    elements.toppingSelectionMeta.textContent = "No toppings are available right now.";
    elements.toppingList.innerHTML = '<div class="result-card"><p>No toppings available.</p></div>';
    return;
  }

  elements.toppingSelectionMeta.textContent = state.selectedMenuToppings.length
    ? `${state.selectedMenuToppings.length} topping${state.selectedMenuToppings.length > 1 ? "s" : ""} selected.`
    : "Choose toppings to go with your dessert.";

  elements.toppingList.innerHTML = availableToppings
    .map((item) => {
      const isSelected = state.selectedMenuToppings.includes(item.name);
      return `
        <button class="topping-choice ${isSelected ? "is-selected" : ""}" data-topping-name="${escapeHtml(item.name)}" type="button">
          <span class="topping-choice-head">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.price || "Included")}</span>
          </span>
          <span class="topping-choice-copy">${escapeHtml(item.description || "Available topping")}</span>
        </button>
      `;
    })
    .join("");

  elements.toppingList.querySelectorAll("[data-topping-name]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleMenuTopping(button.dataset.toppingName);
    });
  });
}

function toggleMenuTopping(name) {
  if (state.selectedMenuToppings.includes(name)) {
    state.selectedMenuToppings = state.selectedMenuToppings.filter((item) => item !== name);
  } else {
    state.selectedMenuToppings = [...state.selectedMenuToppings, name];
  }

  renderToppingPicker();
}

function renderMenuTabs() {
  elements.menuTabs.querySelectorAll("[data-menu-type]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.menuType === state.activeMenuType);
  });
}

function defaultMenuType() {
  const availableTypes = state.flavours
    .filter((item) => isAvailable(item.status))
    .map((item) => normalizeMenuType(item.type));

  if (availableTypes.includes("gelato")) {
    return "gelato";
  }
  if (availableTypes.includes("sorbet")) {
    return "sorbet";
  }
  if (availableTypes.includes("granita")) {
    return "granita";
  }
  return "gelato";
}

function normalizeMenuType(value) {
  const normalized = normalizeKey(value);
  if (normalized.includes("sorbet")) {
    return "sorbet";
  }
  if (normalized.includes("granita")) {
    return "granita";
  }
  return "gelato";
}

function formatMenuTypeLabel(type) {
  if (type === "sorbet") {
    return "Sorbet";
  }
  if (type === "granita") {
    return "Granita";
  }
  return "Gelato";
}

async function maybeShowRecommendations() {
  if (!state.selectedOccasion || !state.selectedMood) {
    return;
  }

  const requestId = ++state.recommendationRequestId;
  const availableFlavours = state.flavours.filter((item) => isAvailable(item.status));
  const availableToppings = state.toppings.filter((item) => isAvailable(item.status));

  if (!availableFlavours.length) {
    elements.recommendationSection.classList.remove("hidden");
    elements.recommendationLead.textContent = "No available flavours were found.";
    elements.recommendationMeta.textContent = "Populate the Google Sheets Flavours tab to let the wizard recommend items.";
    elements.recommendationGrid.innerHTML = "";
    return;
  }

  elements.recommendationSection.classList.remove("hidden");
  elements.recommendationLead.textContent = `Finding five options for ${state.selectedMood} during ${state.selectedOccasion}...`;
  elements.recommendationMeta.textContent =
    state.engineMode === "online" && state.openAiConfigured
      ? "Using online OpenAI mode with a local availability-based fallback."
      : "Using local availability-based ranking.";

  const localChoices = rankAvailableFlavours(state.selectedOccasion, state.selectedMood, availableFlavours, availableToppings);
  let cards = [];

  if (state.engineMode === "online" && state.openAiConfigured) {
    try {
      cards = await fetchOpenAiRecommendations();
    } catch {
      elements.recommendationMeta.textContent =
        "Online mode was unavailable, so the app switched to the local availability-based engine.";
    }
  }

  if (!cards.length) {
    cards = localChoices.map((choice, index) => ({
      rank: index + 1,
      name: choice.label,
      type: choice.typeLabel || choice.flavour.type || "Suggested",
      price: choice.basePriceLabel || choice.flavour.price || "See live menu",
      toppingPrice: formatPriceTotal(choice.toppings),
      totalPrice: choice.totalPriceLabel || formatCombinedPrice(choice.flavour.price, choice.toppings),
      description: choice.reason,
      toppings: choice.toppings.map((item) => item.name).join(", ") || choice.flavour.toppings || "Ask at counter"
    }));
  }

  cards = ensureComboOption(cards, localChoices);

  if (requestId !== state.recommendationRequestId) {
    return;
  }

  elements.recommendationLead.textContent = `Here are five suggestions for ${state.selectedMood} during ${state.selectedOccasion}.`;
  if (!elements.recommendationMeta.textContent.includes("online OpenAI mode")) {
    elements.recommendationMeta.textContent =
      "The assistant is ranking only the currently available flavours and toppings, using your two text answers and live menu metadata.";
  }
  state.currentRecommendationCards = cards;
  elements.recommendationGrid.innerHTML = cards
    .map(
      (item, index) => `
        <article class="result-card ${item.rank === 1 ? "is-top" : ""}">
          <div class="result-card-head">
            <div>
              <span class="result-label">${item.rank === 1 ? "Suggested option" : `Option ${item.rank}`}</span>
              <h3>${escapeHtml(item.name)}</h3>
            </div>
            <span class="score-chip">${escapeHtml(item.type || "Suggested")}</span>
          </div>
          <p>${escapeHtml(item.description)}</p>
          <p><strong>Toppings / finish:</strong> ${escapeHtml(item.toppings || "Ask at counter")}</p>
          <p class="price-line">Base price: ${escapeHtml(item.price || "See live menu for pricing")}</p>
          <p class="price-line">Topping add-on: ${escapeHtml(item.toppingPrice || "Included / not priced")}</p>
          <p class="price-line">Total: ${escapeHtml(item.totalPrice || item.price || "See live menu for pricing")}</p>
          <div class="cta-row">
            <button class="primary-button save-creation-button" data-save-index="${index}" type="button">Save creation</button>
          </div>
        </article>
      `
    )
    .join("");
  bindSaveCreationButtons();
  renderSavedCreations();
}

function bindSaveCreationButtons() {
  elements.recommendationGrid.querySelectorAll("[data-save-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number.parseInt(button.dataset.saveIndex || "", 10);
      saveCurrentCreation(index);
    });
  });
}

function saveCurrentCreation(index) {
  const customerName = elements.customerNameInput.value.trim();
  if (!customerName) {
    elements.saveCreationStatus.textContent = "Enter your name first so this browser can remember your creation.";
    elements.customerNameInput.focus();
    return;
  }

  const card = state.currentRecommendationCards[index];
  if (!card) {
    elements.saveCreationStatus.textContent = "That recommendation could not be saved. Please try again.";
    return;
  }

  const creationName = elements.creationNameInput.value.trim() || `${card.name} favourite`;
  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    customerName,
    creationName,
    dessertName: card.name,
    type: card.type || "Suggested",
    toppings: card.toppings || "Ask at counter",
    totalPrice: card.totalPrice || card.price || "See live menu",
    savedAt: new Date().toISOString()
  };

  state.savedCreations = [record, ...state.savedCreations].slice(0, 50);
  persistSavedCreations();
  elements.creationNameInput.value = "";
  elements.saveCreationStatus.textContent = `Saved "${creationName}" for ${customerName}.`;
  renderSavedCreations();
}

function renderSavedCreations() {
  const customerName = elements.customerNameInput.value.trim();
  if (!customerName) {
    elements.savedCreationsList.innerHTML =
      '<article class="result-card"><p>Enter your name above to see and save your creations on this browser.</p></article>';
    return;
  }

  const items = state.savedCreations.filter((item) => normalizeKey(item.customerName) === normalizeKey(customerName));
  if (!items.length) {
    elements.savedCreationsList.innerHTML =
      '<article class="result-card"><p>No saved creations yet for this name. Save one from the recommendations above.</p></article>';
    return;
  }

  elements.savedCreationsList.innerHTML = items
    .map(
      (item) => `
        <article class="result-card">
          <div class="result-card-head">
            <div>
              <span class="result-label">Saved creation</span>
              <h3>${escapeHtml(item.creationName)}</h3>
            </div>
            <span class="score-chip">${escapeHtml(item.type)}</span>
          </div>
          <p><strong>Base:</strong> ${escapeHtml(item.dessertName)}</p>
          <p><strong>Toppings:</strong> ${escapeHtml(item.toppings)}</p>
          <p class="price-line">Saved total: ${escapeHtml(item.totalPrice)}</p>
        </article>
      `
    )
    .join("");
}

function loadSavedCreations() {
  try {
    const raw = window.localStorage.getItem(SAVED_CREATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedCreations() {
  try {
    window.localStorage.setItem(SAVED_CREATIONS_KEY, JSON.stringify(state.savedCreations));
  } catch {}
}

async function fetchOpenAiRecommendations() {
  const response = await fetch("/api/recommendations-dev", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      occasion: state.selectedOccasion,
      mood: state.selectedMood,
      flavours: state.flavours,
      toppings: state.toppings
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || payload.error || `Recommendation request failed with ${response.status}`);
  }

  const payload = await response.json();
  const recommendations = Array.isArray(payload.recommendations) ? payload.recommendations.slice(0, 5) : [];

  return recommendations.map((item, index) => {
    const parsedFlavourName = stripQualifier(item.flavour);
    const inferredType = extractTypeFromLabel(item.flavour);
    const menuItem = findFlavour(item.flavour);
    const toppingItems = Array.isArray(item.toppings) ? item.toppings.map(findTopping).filter(Boolean) : [];
    return {
      rank: index + 1,
      name: menuItem?.name || parsedFlavourName || item.flavour || `Option ${index + 1}`,
      type: menuItem?.type || inferredType || "Suggested",
      price: menuItem?.price || "See live menu",
      toppingPrice: formatPriceTotal(toppingItems),
      totalPrice: formatCombinedPrice(menuItem?.price, toppingItems),
      description: item.reason || menuItem?.description || "Recommended by the OpenAI dev route.",
      toppings: Array.isArray(item.toppings) ? item.toppings.join(", ") : menuItem?.toppings || "Ask at counter"
    };
  });
}

function ensureComboOption(cards, localChoices) {
  const normalizedCards = cards.map((item, index) => ({ ...item, rank: index + 1 }));
  const hasCombo = normalizedCards.some((item) => normalizeKey(item.type || "").includes("gelatosorbet"));
  if (hasCombo) {
    return normalizedCards.slice(0, 5);
  }

  const comboChoice = localChoices.find((choice) => normalizeKey(choice.typeLabel || "").includes("gelatosorbet"));
  if (!comboChoice) {
    return normalizedCards.slice(0, 5);
  }

  const comboCard = {
    name: comboChoice.label,
    type: comboChoice.typeLabel || "Gelato + Sorbet",
    price: comboChoice.basePriceLabel || "See live menu",
    toppingPrice: formatPriceTotal(comboChoice.toppings),
    totalPrice:
      comboChoice.totalPriceLabel ||
      formatComboTotalPrice(comboChoice.flavour.price, comboChoice.secondaryFlavour?.price, comboChoice.toppings),
    description: comboChoice.reason,
    toppings: comboChoice.toppings.map((item) => item.name).join(", ") || "Ask at counter"
  };

  const nextCards = normalizedCards.length
    ? [normalizedCards[0], comboCard, ...normalizedCards.slice(1)].filter(Boolean).slice(0, 5)
    : [comboCard];

  return nextCards.map((item, index) => ({ ...item, rank: index + 1 }));
}

function rankAvailableFlavours(selectedOccasion, selectedMood, availableFlavours, availableToppings) {
  const queryTokens = tokenize(`${selectedOccasion} ${selectedMood}`);
  const preferredTypes = inferPreferredTypes(selectedOccasion, selectedMood);
  const wantsCooling = containsAny(`${selectedOccasion} ${selectedMood}`, [
    "tired",
    "overheated",
    "hot",
    "thirsty",
    "refreshing",
    "light",
    "cool",
    "summer"
  ]);
  const wantsPremium = containsAny(selectedOccasion, [
    "networking",
    "premium",
    "client",
    "hospitality",
    "corporate",
    "business"
  ]);

  const rankedSingles = availableFlavours
    .map((flavour) => {
      const searchable = [flavour.name, flavour.type, flavour.description, flavour.toppings, ...(flavour.tags || [])].join(" ");
      let score = countKeywordMatches(searchable, queryTokens) * 3;

      if (preferredTypes.length && preferredTypes.includes(normalizeKey(flavour.type))) {
        score += 8;
      }

      if (containsAny(searchable, ["premium", "luxury", "elegant", "indulgent"])) {
        score += wantsPremium ? 4 : 0;
      }

      if (containsAny(searchable, ["light", "refresh", "fruit", "citrus", "mint", "yuzu", "watermelon"])) {
        score += containsAny(selectedMood, ["light", "refresh", "hot", "overheated", "thirsty", "cleanse", "peaceful"]) ? 4 : 0;
      }

      if (containsAny(searchable, ["coffee", "chocolate", "caramel", "cookies", "hazelnut"])) {
        score += containsAny(selectedMood, ["stressed", "drained", "comfort", "business", "morning"]) ? 4 : 0;
      }

      if (wantsCooling && containsAny(searchable, ["coffee", "tiramisu", "hazelnut", "caramel", "chocolate", "cookies"])) {
        score -= 5;
      }

      if (wantsCooling && containsAny(searchable, ["almond", "nut", "praline", "brownie", "toffee"])) {
        score -= 7;
      }

      if (wantsPremium && containsAny(searchable, ["mint", "lemon", "yuzu", "blood orange", "citrus", "lychee", "watermelon", "passion fruit"])) {
        score += 2;
      }

      const toppings = rankAvailableToppings(flavour, availableToppings, queryTokens).slice(0, 3);
      score += toppings.length;

      return {
        flavour,
        label: flavour.name,
        typeLabel: flavour.type || "Suggested",
        basePriceLabel: flavour.price || "See live menu",
        score,
        toppings,
        reason: buildLocalReason(flavour, selectedOccasion, selectedMood, toppings)
      };
    })
    .sort((left, right) => right.score - left.score);

  const comboChoices = buildComboChoices(rankedSingles, availableToppings, selectedOccasion, selectedMood, queryTokens);
  const combined = [...rankedSingles, ...comboChoices].sort((left, right) => right.score - left.score);

  return diversifyChoices(combined).slice(0, 5);
}

function rankAvailableToppings(flavour, availableToppings, queryTokens) {
  const flavourText = [flavour.name, flavour.description, flavour.toppings, ...(flavour.tags || [])].join(" ");
  const requestText = queryTokens.join(" ");
  const wantsCooling = containsAny(requestText, ["tired", "overheated", "hot", "thirsty", "refreshing", "light", "cool"]);
  const wantsPremium = containsAny(requestText, ["networking", "premium", "client", "hospitality", "corporate", "business"]);

  return availableToppings
    .map((topping) => {
      const toppingText = [topping.name, topping.description, ...(topping.tags || [])].join(" ");
      let score = countKeywordMatches(toppingText, queryTokens) * 2;

      if (containsAny(`${flavourText} ${toppingText}`, tokenize(flavour.name))) {
        score += 1;
      }

      if (flavour.toppings && normalizeKey(flavour.toppings).includes(normalizeKey(topping.name))) {
        score += 5;
      }

      if (wantsCooling && containsAny(toppingText, ["pistachio", "hazelnut", "almond", "brownie", "cookie", "caramel", "nuts"])) {
        score -= 6;
      }

      if (wantsCooling && containsAny(toppingText, ["mint", "citrus", "zest", "berries", "fruit", "light"])) {
        score += 5;
      }

      if (wantsPremium && containsAny(toppingText, ["candied", "citrus", "zest", "mint", "peel", "cacao", "nibs", "pistachio dust"])) {
        score += 3;
      }

      if (containsAny(flavourText, ["mint", "lemon", "yuzu", "citrus", "watermelon", "passion"])) {
        if (containsAny(toppingText, ["mint", "zest", "berries", "fruit", "citrus"])) {
          score += 3;
        }
        if (containsAny(toppingText, ["hazelnut", "pistachio", "almond", "brownie", "cookie"])) {
          score -= 4;
        }
      }

      return { ...topping, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);
}

function inferPreferredTypes(selectedOccasion, selectedMood) {
  const text = normalizeKey(`${selectedOccasion} ${selectedMood}`);
  const scores = { gelato: 0, sorbet: 0, granita: 0 };

  Object.entries(TYPE_HINTS).forEach(([type, hints]) => {
    hints.forEach((hint) => {
      if (text.includes(normalizeKey(hint))) {
        scores[type] += 1;
      }
    });
  });

  return Object.entries(scores)
    .filter(([, score]) => score > 0)
    .sort((left, right) => right[1] - left[1])
    .map(([type]) => type);
}

function buildLocalReason(flavour, selectedOccasion, selectedMood, toppings) {
  const flavourText = [flavour.name, flavour.description, ...(flavour.tags || [])].join(" ");
  let typeNote = flavour.type ? `${flavour.type} matches the tone of this request.` : "This flavour fits the request well.";

  if (containsAny(`${selectedOccasion} ${selectedMood}`, ["tired", "overheated", "thirsty", "light", "refreshing"]) &&
    containsAny(flavourText, ["mint", "lemon", "yuzu", "watermelon", "passion", "citrus", "fruit"])) {
    typeNote = `${flavour.name} feels cooling and lighter for this request.`;
  }

  if (containsAny(selectedOccasion, ["networking", "premium", "client", "hospitality", "corporate"]) &&
    containsAny(flavourText, ["citrus", "yuzu", "mint", "blood orange", "lychee", "pistachio", "coffee"])) {
    typeNote = `${flavour.name} keeps the profile polished for a premium setting.`;
  }

  const toppingNote = toppings.length ? ` Best paired with ${toppings.map((item) => item.name).join(", ")}.` : "";
  const context = `${selectedMood} for ${selectedOccasion}`;
  return `${typeNote} It suits ${context}.${toppingNote}`;
}

function buildComboChoices(rankedSingles, availableToppings, selectedOccasion, selectedMood, queryTokens) {
  const gelatoChoices = rankedSingles.filter((choice) => normalizeKey(choice.flavour.type).includes("gelato")).slice(0, 4);
  const sorbetChoices = rankedSingles.filter((choice) => normalizeKey(choice.flavour.type).includes("sorbet")).slice(0, 4);
  const wantsMix =
    containsAny(`${selectedOccasion} ${selectedMood}`, [
      "mix",
      "pair",
      "contrast",
      "share",
      "premium",
      "client",
      "networking",
      "celebration",
      "playful"
    ]) || (gelatoChoices.length && sorbetChoices.length);

  if (!wantsMix) {
    return [];
  }

  const combos = [];

  gelatoChoices.forEach((gelatoChoice) => {
    sorbetChoices.forEach((sorbetChoice) => {
      const comboName = `${gelatoChoice.flavour.name} + ${sorbetChoice.flavour.name}`;
      const comboText = [
        gelatoChoice.flavour.name,
        gelatoChoice.flavour.description,
        sorbetChoice.flavour.name,
        sorbetChoice.flavour.description
      ].join(" ");
      let score = gelatoChoice.score + sorbetChoice.score + countKeywordMatches(comboText, queryTokens);
      score += 4;

      const comboToppings = rankAvailableToppings(
        {
          name: comboName,
          description: `${gelatoChoice.flavour.description} ${sorbetChoice.flavour.description}`.trim(),
          toppings: `${gelatoChoice.flavour.toppings || ""}, ${sorbetChoice.flavour.toppings || ""}`,
          tags: [...(gelatoChoice.flavour.tags || []), ...(sorbetChoice.flavour.tags || [])]
        },
        availableToppings,
        queryTokens
      ).slice(0, 3);

      combos.push({
        flavour: gelatoChoice.flavour,
        secondaryFlavour: sorbetChoice.flavour,
        label: comboName,
        typeLabel: "Gelato + Sorbet",
        basePriceLabel: formatComboBasePrice(gelatoChoice.flavour.price, sorbetChoice.flavour.price),
        totalPriceLabel: formatComboTotalPrice(gelatoChoice.flavour.price, sorbetChoice.flavour.price, comboToppings),
        score,
        toppings: comboToppings,
        reason: buildComboReason(gelatoChoice.flavour, sorbetChoice.flavour, selectedOccasion, selectedMood, comboToppings)
      });
    });
  });

  return combos.sort((left, right) => right.score - left.score).slice(0, 4);
}

function diversifyChoices(choices) {
  const selected = [];
  const usedTypes = new Map();
  const usedToppingNames = new Set();

  for (const choice of choices) {
    const type = normalizeKey(choice.typeLabel || choice.flavour.type || "mixed");
    const usedCount = usedTypes.get(type) || 0;
    if (usedCount >= 3 && choices.length > selected.length) {
      continue;
    }
    const adjustedChoice = {
      ...choice,
      toppings: diversifyChoiceToppings(choice.toppings, usedToppingNames)
    };
    adjustedChoice.toppings.forEach((item) => usedToppingNames.add(normalizeKey(item.name)));
    selected.push(adjustedChoice);
    usedTypes.set(type, usedCount + 1);
    if (selected.length >= 5) {
      break;
    }
  }

  if (selected.length < 5) {
    for (const choice of choices) {
      if (selected.some((item) => item.flavour.name === choice.flavour.name)) {
        continue;
      }
      const adjustedChoice = {
        ...choice,
        toppings: diversifyChoiceToppings(choice.toppings, usedToppingNames)
      };
      adjustedChoice.toppings.forEach((item) => usedToppingNames.add(normalizeKey(item.name)));
      selected.push(adjustedChoice);
      if (selected.length >= 5) {
        break;
      }
    }
  }

  return selected;
}

function diversifyChoiceToppings(toppings, usedToppingNames) {
  const unique = [];

  for (const topping of toppings) {
    const key = normalizeKey(topping.name);
    if (!usedToppingNames.has(key)) {
      unique.push(topping);
    }
    if (unique.length >= 3) {
      return unique;
    }
  }

  for (const topping of toppings) {
    if (unique.some((item) => normalizeKey(item.name) === normalizeKey(topping.name))) {
      continue;
    }
    unique.push(topping);
    if (unique.length >= 3) {
      break;
    }
  }

  return unique;
}

function containsAny(text, hints) {
  const source = normalizeKey(Array.isArray(text) ? text.join(" ") : text);
  return hints.some((hint) => source.includes(normalizeKey(hint)));
}

function findFlavour(name) {
  const target = normalizeKey(name);
  const plainTarget = normalizeKey(stripQualifier(name));
  return (
    state.flavours.find((item) => normalizeKey(item.name) === target) ||
    state.flavours.find((item) => normalizeKey(item.name) === plainTarget) ||
    state.flavours.find((item) => target && normalizeKey(item.name).includes(target)) ||
    state.flavours.find((item) => plainTarget && normalizeKey(item.name).includes(plainTarget))
  );
}

function buildComboReason(gelatoFlavour, sorbetFlavour, selectedOccasion, selectedMood, toppings) {
  const toppingNote = toppings.length ? ` Best paired with ${toppings.map((item) => item.name).join(", ")}.` : "";
  return `${gelatoFlavour.name} adds body while ${sorbetFlavour.name} keeps the finish bright and refreshing. It suits ${selectedMood} for ${selectedOccasion}.${toppingNote}`;
}

function findTopping(name) {
  const target = normalizeKey(name);
  return state.toppings.find((item) => normalizeKey(item.name) === target) || state.toppings.find((item) => normalizeKey(item.name).includes(target));
}

function stripQualifier(value) {
  return String(value || "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s*-\s*(gelato|sorbet|granita)\s*$/i, "")
    .trim();
}

function extractTypeFromLabel(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("gelato")) {
    return "Gelato";
  }
  if (text.includes("sorbet")) {
    return "Sorbet";
  }
  if (text.includes("granita")) {
    return "Granita";
  }
  return "";
}

function parseNumericPrice(value) {
  const cleaned = String(value || "").replace(/[^0-9.]/g, "");
  const numeric = Number.parseFloat(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatCurrency(value) {
  return Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, "") : "";
}

function formatPriceTotal(toppings) {
  const total = toppings.reduce((sum, item) => sum + (parseNumericPrice(item.price) || 0), 0);
  return total > 0 ? formatCurrency(total) : "";
}

function formatCombinedPrice(basePrice, toppings) {
  const base = parseNumericPrice(basePrice);
  const toppingTotal = toppings.reduce((sum, item) => sum + (parseNumericPrice(item.price) || 0), 0);
  if (base === null) {
    return toppingTotal > 0 ? `Toppings +${formatCurrency(toppingTotal)}` : "";
  }
  return formatCurrency(base + toppingTotal);
}

function formatComboBasePrice(firstPrice, secondPrice) {
  const first = parseNumericPrice(firstPrice);
  const second = parseNumericPrice(secondPrice);
  if (first === null && second === null) {
    return "See live menu";
  }
  const total = (first || 0) + (second || 0);
  return formatCurrency(total);
}

function formatComboTotalPrice(firstPrice, secondPrice, toppings) {
  const first = parseNumericPrice(firstPrice);
  const second = parseNumericPrice(secondPrice);
  const toppingTotal = toppings.reduce((sum, item) => sum + (parseNumericPrice(item.price) || 0), 0);
  if (first === null && second === null) {
    return toppingTotal > 0 ? `Toppings +${formatCurrency(toppingTotal)}` : "";
  }
  return formatCurrency((first || 0) + (second || 0) + toppingTotal);
}

function countKeywordMatches(text, tokens) {
  const haystack = normalizeKey(text);
  return tokens.filter((token) => haystack.includes(normalizeKey(token))).length;
}

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function isAvailable(status) {
  const value = normalizeKey(status || "available");
  if (!value) {
    return true;
  }

  const availableHints = [
    "available",
    "active",
    "instock",
    "stock",
    "yes",
    "y",
    "true",
    "1",
    "open",
    "ready",
    "live"
  ];

  const unavailableHints = ["soldout", "inactive", "no", "n", "false", "0", "outofstock", "unavailable"];

  if (unavailableHints.some((hint) => value === hint || value.includes(hint))) {
    return false;
  }

  return availableHints.some((hint) => value === hint || value.includes(hint));
}

function isAvailabilityValue(value) {
  const normalized = normalizeKey(value);
  return ["available", "active", "instock", "soldout", "inactive"].some((token) => normalized.includes(token));
}

function isKnownType(value) {
  const normalized = normalizeKey(value);
  return ["gelato", "sorbet", "granita"].some((token) => normalized.includes(token));
}

function pickValue(item, keys) {
  for (const key of keys) {
    if (item[key]) {
      return item[key];
    }
  }
  return "";
}

function splitList(value) {
  return String(value || "")
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
