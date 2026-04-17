import { initialState } from "./data.js";
import { recommendFlavours, summarizeAnalytics } from "./engine.js";

const ADMIN_PASSWORD = "gelato-admin";
const STATE_STORAGE_KEY = "aumici-flavour-assistant-state";
const ADMIN_SESSION_KEY = "aumici-flavour-assistant-admin";
const WIZARD_STORAGE_KEY = "aumici-flavour-assistant-wizard";

const state = loadState();

let activeMode = "know";
let editingIds = {
  flavour: "",
  mood: "",
  occasion: "",
  topping: "",
  rule: ""
};
let currentResults = [];
let currentDebug = [];
let lastCriteria = {};
let wizardState = loadWizardState();

const elements = {
  adminLoginForm: document.querySelector("#adminLoginForm"),
  adminPassword: document.querySelector("#adminPassword"),
  adminLogoutButton: document.querySelector("#adminLogoutButton"),
  adminStatus: document.querySelector("#adminStatus"),
  adminPanel: document.querySelector("#adminPanel"),
  adminTabs: Array.from(document.querySelectorAll(".admin-tab")),
  adminPanels: Array.from(document.querySelectorAll(".admin-tab-panel")),
  flavourForm: document.querySelector("#flavourForm"),
  flavourList: document.querySelector("#flavourList"),
  flavourResetButton: document.querySelector("#flavourResetButton"),
  moodForm: document.querySelector("#moodForm"),
  moodList: document.querySelector("#moodList"),
  occasionForm: document.querySelector("#occasionForm"),
  occasionList: document.querySelector("#occasionList"),
  toppingForm: document.querySelector("#toppingForm"),
  toppingList: document.querySelector("#toppingList"),
  ruleForm: document.querySelector("#ruleForm"),
  ruleList: document.querySelector("#ruleList"),
  rulePreviewButton: document.querySelector("#rulePreviewButton"),
  rulePreview: document.querySelector("#rulePreview"),
  weightsForm: document.querySelector("#weightsForm"),
  adminAnalyticsGrid: document.querySelector("#adminAnalyticsGrid"),
  modeButtons: Array.from(document.querySelectorAll(".mode-card")),
  customerPanels: Array.from(document.querySelectorAll(".customer-panel")),
  browseForm: document.querySelector("#browseForm"),
  browseList: document.querySelector("#browseList"),
  guideForm: document.querySelector("#guideForm"),
  wizardSteps: Array.from(document.querySelectorAll(".wizard-step")),
  wizardBackButton: document.querySelector("#wizardBackButton"),
  wizardNextButton: document.querySelector("#wizardNextButton"),
  wizardRestartButton: document.querySelector("#wizardRestartButton"),
  wizardStepLabel: document.querySelector("#wizardStepLabel"),
  surpriseForm: document.querySelector("#surpriseForm"),
  resultsSummary: document.querySelector("#resultsSummary"),
  resultCards: document.querySelector("#resultCards"),
  rerollButton: document.querySelector("#rerollButton"),
  askAnotherButton: document.querySelector("#askAnotherButton"),
  feedbackForm: document.querySelector("#feedbackForm"),
  shareButton: document.querySelector("#shareButton"),
  cartStatus: document.querySelector("#cartStatus"),
  analyticsGrid: document.querySelector("#analyticsGrid"),
  heroSignature: document.querySelector("#heroSignature"),
  heroDescription: document.querySelector("#heroDescription"),
  heroMode: document.querySelector("#heroMode"),
  heroScore: document.querySelector("#heroScore"),
  architectureSummary: document.querySelector("#architectureSummary"),
  rulesSummary: document.querySelector("#rulesSummary")
};

const choiceMaps = {
  taste: ["creamy", "fruity", "icy", "indulgent", "light", "surprise me"],
  dietary: ["vegan", "dairy-free", "lactose intolerant friendly", "nut-free", "low added sugar", "contains caffeine", "none"],
  weather: ["hot day", "rainy day", "anytime"],
  toppingsWanted: ["yes", "no"]
};

bootstrap();

function bootstrap() {
  elements.architectureSummary.textContent =
    "Frontend stack: plain HTML, CSS, ES modules. Backend: none in this workspace. Persistence: browser localStorage.";
  elements.rulesSummary.textContent =
    "Spreadsheet translation: decision matrix rows were converted into editable seeded recommendation rules and examples.";

  bindEvents();
  renderAll();
  applyAdminState();
  renderWizardChoices();
  showWizardStep(wizardState.step || 1);
  renderBrowse();
  runBrowseRecommendations();
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(STATE_STORAGE_KEY);
    if (!raw) {
      return structuredClone(initialState);
    }
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(initialState),
      ...parsed
    };
  } catch {
    return structuredClone(initialState);
  }
}

function saveState() {
  window.localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
}

function loadWizardState() {
  try {
    const raw = window.localStorage.getItem(WIZARD_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { step: 1, answers: {} };
  } catch {
    return { step: 1, answers: {} };
  }
}

function saveWizardState() {
  window.localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(wizardState));
}

function isAdminLoggedIn() {
  return window.localStorage.getItem(ADMIN_SESSION_KEY) === "true";
}

function setAdminSession(enabled) {
  window.localStorage.setItem(ADMIN_SESSION_KEY, enabled ? "true" : "false");
}

function bindEvents() {
  elements.adminLoginForm.addEventListener("submit", handleAdminLogin);
  elements.adminLogoutButton.addEventListener("click", () => {
    setAdminSession(false);
    applyAdminState();
  });

  elements.adminTabs.forEach((button) => {
    button.addEventListener("click", () => showAdminTab(button.dataset.adminTab));
  });

  elements.flavourForm.addEventListener("submit", handleFlavourSave);
  elements.moodForm.addEventListener("submit", handleMoodSave);
  elements.occasionForm.addEventListener("submit", handleOccasionSave);
  elements.toppingForm.addEventListener("submit", handleToppingSave);
  elements.ruleForm.addEventListener("submit", handleRuleSave);
  elements.weightsForm.addEventListener("submit", handleWeightsSave);
  elements.flavourResetButton.addEventListener("click", resetFlavourForm);
  elements.rulePreviewButton.addEventListener("click", renderRulePreview);

  elements.modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  elements.browseForm.addEventListener("change", renderBrowse);
  elements.wizardBackButton.addEventListener("click", handleWizardBack);
  elements.wizardNextButton.addEventListener("click", handleWizardNext);
  elements.wizardRestartButton.addEventListener("click", resetWizard);
  elements.guideForm.querySelectorAll(".skip-button").forEach((button) => {
    button.addEventListener("click", () => skipWizardField(button.dataset.skip));
  });
  elements.surpriseForm.addEventListener("submit", handleSurpriseRun);
  elements.rerollButton.addEventListener("click", rerollCurrentMode);
  elements.askAnotherButton.addEventListener("click", resetWizard);
  elements.feedbackForm.addEventListener("submit", handleFeedbackSubmit);
  elements.shareButton.addEventListener("click", handleShare);
}

function applyAdminState() {
  const loggedIn = isAdminLoggedIn();
  elements.adminPanel.classList.toggle("hidden", !loggedIn);
  elements.adminLogoutButton.classList.toggle("hidden", !loggedIn);
  elements.adminPassword.classList.toggle("hidden", loggedIn);
  elements.adminLoginForm.querySelector('button[type="submit"]').classList.toggle("hidden", loggedIn);
  elements.adminStatus.textContent = loggedIn
    ? "Admin panel unlocked. This prototype persists config in the current browser."
    : "Admin panel locked.";
}

function showAdminTab(tabName) {
  elements.adminTabs.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.adminTab === tabName);
  });
  elements.adminPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.adminPanel !== tabName);
  });
}

function setMode(mode) {
  activeMode = mode;
  elements.modeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
  elements.customerPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.customerPanel !== mode);
  });
  elements.heroMode.textContent = mode === "know" ? "I know what I want" : mode === "guide" ? "Guide me to choose" : "Surprise me";
  if (mode === "know") {
    runBrowseRecommendations();
  }
}

function renderAll() {
  renderFlavourList();
  renderMoodList();
  renderOccasionList();
  renderToppingList();
  renderRuleList();
  renderWeights();
  renderAdminAnalytics();
  renderPublicAnalytics();
}

function parseTags(value) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function handleAdminLogin(event) {
  event.preventDefault();
  if (elements.adminPassword.value === ADMIN_PASSWORD) {
    setAdminSession(true);
    elements.adminPassword.value = "";
    applyAdminState();
    showAdminTab("flavours");
  } else {
    elements.adminStatus.textContent = "Incorrect password.";
  }
}

function handleFlavourSave(event) {
  event.preventDefault();
  const form = new FormData(elements.flavourForm);
  const payload = {
    id: editingIds.flavour || slugify(form.get("flavourName")),
    flavourName: form.get("flavourName"),
    productType: form.get("flavourType"),
    status: form.get("flavourStatus"),
    description: form.get("flavourDescription"),
    image: form.get("flavourImage"),
    activeImage: form.get("flavourImage"),
    baseTasteTags: parseTags(form.get("flavourTasteTags")),
    dietaryTags: parseTags(form.get("flavourDietaryTags")),
    moodTags: [],
    occasionTags: [],
    weatherSuitability: ["anytime"],
    recommendedToppings: [],
    basePrice: Number(form.get("flavourPrice") || 0),
    priorityScore: Number(form.get("flavourPriority") || 0),
    upsellScore: Number(form.get("flavourUpsell") || 0),
    marginScore: Number(form.get("flavourMargin") || 0),
    popularityScore: Number(form.get("flavourPopularity") || 0),
    stockStatus: form.get("flavourStatus") === "sold_out" ? "sold_out" : "in_stock"
  };
  upsertById(state.flavours, payload);
  saveState();
  resetFlavourForm();
  renderAll();
  renderBrowse();
}

function handleMoodSave(event) {
  event.preventDefault();
  const form = new FormData(elements.moodForm);
  const payload = {
    id: editingIds.mood || slugify(form.get("moodLabel")),
    label: form.get("moodLabel"),
    icon: form.get("moodIcon"),
    order: Number(form.get("moodOrder") || 1),
    active: form.get("moodActive") === "true"
  };
  upsertById(state.moods, payload);
  saveState();
  elements.moodForm.reset();
  editingIds.mood = "";
  renderAll();
  renderWizardChoices();
}

function handleOccasionSave(event) {
  event.preventDefault();
  const form = new FormData(elements.occasionForm);
  const payload = {
    id: editingIds.occasion || slugify(form.get("occasionLabel")),
    label: form.get("occasionLabel"),
    icon: form.get("occasionIcon"),
    order: Number(form.get("occasionOrder") || 1),
    active: form.get("occasionActive") === "true"
  };
  upsertById(state.occasions, payload);
  saveState();
  elements.occasionForm.reset();
  editingIds.occasion = "";
  renderAll();
  renderWizardChoices();
}

function handleToppingSave(event) {
  event.preventDefault();
  const form = new FormData(elements.toppingForm);
  const payload = {
    id: editingIds.topping || slugify(form.get("toppingName")),
    toppingName: form.get("toppingName"),
    description: form.get("toppingDescription"),
    priceAddOn: Number(form.get("toppingPrice") || 0),
    compatibilityTags: parseTags(form.get("toppingCompatibility")),
    dietaryTags: parseTags(form.get("toppingDietary")),
    status: form.get("toppingStatus"),
    image: "",
    upsellPriority: Number(form.get("toppingUpsell") || 0),
    stockStatus: "in_stock"
  };
  upsertById(state.toppings, payload);
  saveState();
  elements.toppingForm.reset();
  editingIds.topping = "";
  renderAll();
}

function handleRuleSave(event) {
  event.preventDefault();
  const form = new FormData(elements.ruleForm);
  const payload = {
    id: editingIds.rule || slugify(form.get("ruleName")),
    name: form.get("ruleName"),
    mood: form.get("ruleMood"),
    occasion: form.get("ruleOccasion"),
    weather: form.get("ruleWeather"),
    recommendedBase: form.get("ruleBaseType"),
    includeTags: parseTags(form.get("ruleIncludeTags")),
    excludeTags: parseTags(form.get("ruleExcludeTags")),
    toppingDirection: [],
    why: "",
    examples: [],
    weightBoost: Number(form.get("ruleWeight") || 0),
    enabled: form.get("ruleEnabled") === "true",
    note: form.get("ruleNote")
  };
  upsertById(state.rules, payload);
  saveState();
  elements.ruleForm.reset();
  editingIds.rule = "";
  renderAll();
}

function handleWeightsSave(event) {
  event.preventDefault();
  const form = new FormData(elements.weightsForm);
  state.weights = {
    mood: Number(form.get("weightMood") || 0),
    preference: Number(form.get("weightPreference") || 0),
    occasion: Number(form.get("weightOccasion") || 0),
    weather: Number(form.get("weightWeather") || 0),
    priority: Number(form.get("weightPriority") || 0),
    upsell: Number(form.get("weightUpsell") || 0),
    popularity: Number(form.get("weightPopularity") || 0),
    margin: Number(form.get("weightMargin") || 0)
  };
  saveState();
  renderAll();
}

function resetFlavourForm() {
  editingIds.flavour = "";
  elements.flavourForm.reset();
  elements.flavourForm.querySelector("#flavourPrice").value = "8.50";
  elements.flavourForm.querySelector("#flavourPriority").value = "50";
  elements.flavourForm.querySelector("#flavourUpsell").value = "50";
  elements.flavourForm.querySelector("#flavourMargin").value = "50";
  elements.flavourForm.querySelector("#flavourPopularity").value = "50";
}

function upsertById(collection, payload) {
  const index = collection.findIndex((item) => item.id === payload.id);
  if (index >= 0) {
    collection[index] = { ...collection[index], ...payload };
  } else {
    collection.push(payload);
  }
}

function removeById(collection, id) {
  const index = collection.findIndex((item) => item.id === id);
  if (index >= 0) {
    collection.splice(index, 1);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tableText(value) {
  return escapeHtml(value || "—");
}

function renderAdminTable(target, columns, rows, emptyMessage) {
  if (!rows.length) {
    target.innerHTML = `<div class="table-empty">${escapeHtml(emptyMessage)}</div>`;
    return;
  }

  const head = columns.map((column) => `<th scope="col">${escapeHtml(column.label)}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = columns
        .map((column) => `<td data-label="${escapeHtml(column.label)}">${column.render(row)}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  target.innerHTML = `
    <div class="admin-table-shell">
      <table class="admin-table">
        <thead>
          <tr>${head}</tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

function tableText(value) {
  return escapeHtml(value || "N/A");
}

function renderFlavourList() {
  renderAdminTable(
    elements.flavourList,
    [
      {
        label: "Flavour",
        render: (flavour) => `
          <div class="table-title-cell">
            <strong>${escapeHtml(flavour.flavourName)}</strong>
            <span>${tableText(flavour.description)}</span>
          </div>`
      },
      {
        label: "Type",
        render: (flavour) => `<span class="table-pill">${tableText(flavour.productType)}</span>`
      },
      {
        label: "Status",
        render: (flavour) => `<span class="table-pill ${flavour.status === "active" ? "is-positive" : ""}">${tableText(flavour.status.replace("_", " "))}</span>`
      },
      {
        label: "Base Price",
        render: (flavour) => `$${Number(flavour.basePrice || 0).toFixed(2)}`
      },
      {
        label: "Taste Tags",
        render: (flavour) => tableText((flavour.baseTasteTags || []).join(", "))
      },
      {
        label: "Scores",
        render: (flavour) => `
          <div class="table-stack">
            <span>P ${Number(flavour.priorityScore || 0)}</span>
            <span>U ${Number(flavour.upsellScore || 0)}</span>
            <span>M ${Number(flavour.marginScore || 0)}</span>
            <span>Pop ${Number(flavour.popularityScore || 0)}</span>
          </div>`
      },
      {
        label: "Actions",
        render: (flavour) => `
          <div class="table-actions">
            <button class="ghost-button small-button" data-edit-flavour="${escapeHtml(flavour.id)}" type="button">Edit</button>
            <button class="ghost-button small-button" data-delete-flavour="${escapeHtml(flavour.id)}" type="button">Delete</button>
          </div>`
      }
    ],
    state.flavours,
    "No flavours configured yet."
  );

  elements.flavourList.querySelectorAll("[data-edit-flavour]").forEach((button) => {
    button.addEventListener("click", () => populateFlavourForm(button.dataset.editFlavour));
  });
  elements.flavourList.querySelectorAll("[data-delete-flavour]").forEach((button) => {
    button.addEventListener("click", () => {
      removeById(state.flavours, button.dataset.deleteFlavour);
      saveState();
      renderAll();
      renderBrowse();
    });
  });
}

function populateFlavourForm(id) {
  const flavour = state.flavours.find((item) => item.id === id);
  if (!flavour) {
    return;
  }
  editingIds.flavour = id;
  elements.flavourForm.querySelector("#flavourName").value = flavour.flavourName;
  elements.flavourForm.querySelector("#flavourType").value = flavour.productType;
  elements.flavourForm.querySelector("#flavourStatus").value = flavour.status;
  elements.flavourForm.querySelector("#flavourPrice").value = flavour.basePrice;
  elements.flavourForm.querySelector("#flavourDescription").value = flavour.description;
  elements.flavourForm.querySelector("#flavourImage").value = flavour.activeImage || "";
  elements.flavourForm.querySelector("#flavourTasteTags").value = (flavour.baseTasteTags || []).join(", ");
  elements.flavourForm.querySelector("#flavourDietaryTags").value = (flavour.dietaryTags || []).join(", ");
  elements.flavourForm.querySelector("#flavourPriority").value = flavour.priorityScore;
  elements.flavourForm.querySelector("#flavourUpsell").value = flavour.upsellScore;
  elements.flavourForm.querySelector("#flavourMargin").value = flavour.marginScore;
  elements.flavourForm.querySelector("#flavourPopularity").value = flavour.popularityScore;
}

function renderSimpleList(target, collection, type) {
  const sorted = collection.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  renderAdminTable(
    target,
    [
      {
        label: type === "mood" ? "Mood" : "Occasion",
        render: (item) => `
          <div class="table-title-cell">
            <strong>${escapeHtml(item.label)}</strong>
            <span>${tableText(item.icon)}</span>
          </div>`
      },
      {
        label: "Display Order",
        render: (item) => `${Number(item.order || 0)}`
      },
      {
        label: "Status",
        render: (item) => {
          const active = item.active !== false;
          return `<span class="table-pill ${active ? "is-positive" : ""}">${active ? "active" : "inactive"}</span>`;
        }
      },
      {
        label: "Actions",
        render: (item) => `
          <div class="table-actions">
            <button class="ghost-button small-button" data-edit-${type}="${escapeHtml(item.id)}" type="button">Edit</button>
            <button class="ghost-button small-button" data-delete-${type}="${escapeHtml(item.id)}" type="button">Delete</button>
          </div>`
      }
    ],
    sorted,
    `No ${type}s configured yet.`
  );
}

function renderMoodList() {
  renderSimpleList(elements.moodList, state.moods, "mood");
  elements.moodList.querySelectorAll("[data-edit-mood]").forEach((button) => {
    button.addEventListener("click", () => populateSimpleForm("mood", button.dataset.editMood));
  });
  elements.moodList.querySelectorAll("[data-delete-mood]").forEach((button) => {
    button.addEventListener("click", () => {
      removeById(state.moods, button.dataset.deleteMood);
      saveState();
      renderAll();
      renderWizardChoices();
    });
  });
}

function renderOccasionList() {
  renderSimpleList(elements.occasionList, state.occasions, "occasion");
  elements.occasionList.querySelectorAll("[data-edit-occasion]").forEach((button) => {
    button.addEventListener("click", () => populateSimpleForm("occasion", button.dataset.editOccasion));
  });
  elements.occasionList.querySelectorAll("[data-delete-occasion]").forEach((button) => {
    button.addEventListener("click", () => {
      removeById(state.occasions, button.dataset.deleteOccasion);
      saveState();
      renderAll();
      renderWizardChoices();
    });
  });
}

function renderToppingList() {
  renderAdminTable(
    elements.toppingList,
    [
      {
        label: "Topping",
        render: (topping) => `
          <div class="table-title-cell">
            <strong>${escapeHtml(topping.toppingName)}</strong>
            <span>${tableText(topping.description)}</span>
          </div>`
      },
      {
        label: "Add-on",
        render: (topping) => `$${Number(topping.priceAddOn || 0).toFixed(2)}`
      },
      {
        label: "Status",
        render: (topping) => `<span class="table-pill ${topping.status === "active" ? "is-positive" : ""}">${tableText(topping.status)}</span>`
      },
      {
        label: "Compatibility",
        render: (topping) => tableText((topping.compatibilityTags || []).join(", "))
      },
      {
        label: "Dietary Tags",
        render: (topping) => tableText((topping.dietaryTags || []).join(", "))
      },
      {
        label: "Upsell",
        render: (topping) => `${Number(topping.upsellPriority || 0)}`
      },
      {
        label: "Actions",
        render: (topping) => `
          <div class="table-actions">
            <button class="ghost-button small-button" data-edit-topping="${escapeHtml(topping.id)}" type="button">Edit</button>
            <button class="ghost-button small-button" data-delete-topping="${escapeHtml(topping.id)}" type="button">Delete</button>
          </div>`
      }
    ],
    state.toppings,
    "No toppings configured yet."
  );

  elements.toppingList.querySelectorAll("[data-edit-topping]").forEach((button) => {
    button.addEventListener("click", () => populateToppingForm(button.dataset.editTopping));
  });
  elements.toppingList.querySelectorAll("[data-delete-topping]").forEach((button) => {
    button.addEventListener("click", () => {
      removeById(state.toppings, button.dataset.deleteTopping);
      saveState();
      renderAll();
    });
  });
}

function renderRuleList() {
  renderAdminTable(
    elements.ruleList,
    [
      {
        label: "Rule",
        render: (rule) => `
          <div class="table-title-cell">
            <strong>${escapeHtml(rule.name)}</strong>
            <span>${tableText(rule.note || rule.why)}</span>
          </div>`
      },
      {
        label: "Enabled",
        render: (rule) => `<span class="table-pill ${rule.enabled ? "is-positive" : ""}">${rule.enabled ? "enabled" : "disabled"}</span>`
      },
      {
        label: "Base",
        render: (rule) => tableText(rule.recommendedBase || "any")
      },
      {
        label: "Include Tags",
        render: (rule) => tableText((rule.includeTags || []).join(", "))
      },
      {
        label: "Exclude Tags",
        render: (rule) => tableText((rule.excludeTags || []).join(", "))
      },
      {
        label: "Weight",
        render: (rule) => `${Number(rule.weightBoost || 0) >= 0 ? "+" : ""}${Number(rule.weightBoost || 0)}`
      },
      {
        label: "Actions",
        render: (rule) => `
          <div class="table-actions">
            <button class="ghost-button small-button" data-edit-rule="${escapeHtml(rule.id)}" type="button">Edit</button>
            <button class="ghost-button small-button" data-delete-rule="${escapeHtml(rule.id)}" type="button">Delete</button>
          </div>`
      }
    ],
    state.rules,
    "No recommendation rules configured yet."
  );

  elements.ruleList.querySelectorAll("[data-edit-rule]").forEach((button) => {
    button.addEventListener("click", () => populateRuleForm(button.dataset.editRule));
  });
  elements.ruleList.querySelectorAll("[data-delete-rule]").forEach((button) => {
    button.addEventListener("click", () => {
      removeById(state.rules, button.dataset.deleteRule);
      saveState();
      renderAll();
    });
  });
}

function populateSimpleForm(type, id) {
  const collection = type === "mood" ? state.moods : state.occasions;
  const item = collection.find((entry) => entry.id === id);
  if (!item) {
    return;
  }
  editingIds[type] = id;
  const form = type === "mood" ? elements.moodForm : elements.occasionForm;
  form.querySelector(`#${type}Label`).value = item.label;
  form.querySelector(`#${type}Icon`).value = item.icon;
  form.querySelector(`#${type}Order`).value = item.order;
  form.querySelector(`#${type}Active`).value = String(item.active);
}

function populateToppingForm(id) {
  const topping = state.toppings.find((entry) => entry.id === id);
  if (!topping) {
    return;
  }
  editingIds.topping = id;
  elements.toppingForm.querySelector("#toppingName").value = topping.toppingName;
  elements.toppingForm.querySelector("#toppingPrice").value = topping.priceAddOn;
  elements.toppingForm.querySelector("#toppingDescription").value = topping.description;
  elements.toppingForm.querySelector("#toppingCompatibility").value = (topping.compatibilityTags || []).join(", ");
  elements.toppingForm.querySelector("#toppingDietary").value = (topping.dietaryTags || []).join(", ");
  elements.toppingForm.querySelector("#toppingUpsell").value = topping.upsellPriority;
  elements.toppingForm.querySelector("#toppingStatus").value = topping.status;
}

function populateRuleForm(id) {
  const rule = state.rules.find((entry) => entry.id === id);
  if (!rule) {
    return;
  }
  editingIds.rule = id;
  elements.ruleForm.querySelector("#ruleName").value = rule.name;
  elements.ruleForm.querySelector("#ruleEnabled").value = String(rule.enabled);
  elements.ruleForm.querySelector("#ruleMood").value = rule.mood || "";
  elements.ruleForm.querySelector("#ruleOccasion").value = rule.occasion || "";
  elements.ruleForm.querySelector("#ruleWeather").value = rule.weather || "";
  elements.ruleForm.querySelector("#ruleBaseType").value = rule.recommendedBase || "";
  elements.ruleForm.querySelector("#ruleIncludeTags").value = (rule.includeTags || []).join(", ");
  elements.ruleForm.querySelector("#ruleExcludeTags").value = (rule.excludeTags || []).join(", ");
  elements.ruleForm.querySelector("#ruleWeight").value = rule.weightBoost;
  elements.ruleForm.querySelector("#ruleNote").value = rule.note || "";
}

function renderWeights() {
  elements.weightsForm.querySelector("#weightMood").value = state.weights.mood;
  elements.weightsForm.querySelector("#weightPreference").value = state.weights.preference;
  elements.weightsForm.querySelector("#weightOccasion").value = state.weights.occasion;
  elements.weightsForm.querySelector("#weightWeather").value = state.weights.weather;
  elements.weightsForm.querySelector("#weightPriority").value = state.weights.priority;
  elements.weightsForm.querySelector("#weightUpsell").value = state.weights.upsell;
  elements.weightsForm.querySelector("#weightPopularity").value = state.weights.popularity;
  elements.weightsForm.querySelector("#weightMargin").value = state.weights.margin;
}

function renderRulePreview() {
  const preview = state.rules
    .filter((rule) => rule.enabled)
    .map((rule) => `${rule.name}: mood=${rule.mood || "*"}, occasion=${rule.occasion || "*"}, weather=${rule.weather || "*"}, include=[${(rule.includeTags || []).join(", ")}], exclude=[${(rule.excludeTags || []).join(", ")}], +${rule.weightBoost}`)
    .join("\n");
  elements.rulePreview.textContent = preview || "No enabled rules.";
}

function renderWizardChoices() {
  renderChoiceButtons(
    document.querySelector("#occasionChoices"),
    state.occasions.filter((item) => item.active).sort((a, b) => a.order - b.order).map((item) => ({ value: item.id, label: item.label })),
    "occasion"
  );
  renderChoiceButtons(
    document.querySelector("#moodChoices"),
    state.moods.filter((item) => item.active).sort((a, b) => a.order - b.order).map((item) => ({ value: item.id, label: item.label })),
    "mood"
  );
  renderChoiceButtons(
    document.querySelector("#tasteChoices"),
    choiceMaps.taste.map((value) => ({ value, label: value })),
    "tastePreference"
  );
  renderChoiceButtons(
    document.querySelector("#dietaryChoices"),
    choiceMaps.dietary.map((value) => ({ value, label: value })),
    "dietaryNeeds",
    true
  );
  renderChoiceButtons(
    document.querySelector("#weatherChoices"),
    choiceMaps.weather.map((value) => ({ value, label: value })),
    "weather"
  );
  renderChoiceButtons(
    document.querySelector("#toppingIntentChoices"),
    choiceMaps.toppingsWanted.map((value) => ({ value, label: value })),
    "wantsToppings"
  );
}

function renderChoiceButtons(container, items, field, multiSelect = false) {
  container.innerHTML = items
    .map(
      (item) => `
        <button class="choice-pill ${isChoiceSelected(field, item.value, multiSelect) ? "is-selected" : ""}" data-choice-field="${field}" data-choice-value="${item.value}" data-choice-multi="${multiSelect}" type="button">
          ${item.label}
        </button>`
    )
    .join("");

  container.querySelectorAll("[data-choice-field]").forEach((button) => {
    button.addEventListener("click", () => {
      const fieldName = button.dataset.choiceField;
      const value = button.dataset.choiceValue;
      const isMulti = button.dataset.choiceMulti === "true";
      toggleWizardChoice(fieldName, value, isMulti);
      renderWizardChoices();
    });
  });
}

function isChoiceSelected(field, value, multiSelect) {
  const current = wizardState.answers[field];
  if (multiSelect) {
    return Array.isArray(current) && current.includes(value);
  }
  return current === value;
}

function toggleWizardChoice(field, value, multiSelect) {
  if (multiSelect) {
    const current = Array.isArray(wizardState.answers[field]) ? wizardState.answers[field] : [];
    wizardState.answers[field] = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
  } else {
    wizardState.answers[field] = value;
  }
  saveWizardState();
}

function showWizardStep(step) {
  wizardState.step = Math.max(1, Math.min(6, step));
  saveWizardState();
  elements.wizardSteps.forEach((panel) => {
    panel.classList.toggle("hidden", Number(panel.dataset.step) !== wizardState.step);
  });
  elements.wizardStepLabel.textContent = `Step ${wizardState.step} of 6`;
  elements.wizardBackButton.disabled = wizardState.step === 1;
  elements.wizardNextButton.textContent = wizardState.step === 6 ? "Show recommendations" : "Next";
}

function handleWizardBack() {
  showWizardStep(wizardState.step - 1);
}

function handleWizardNext() {
  if (wizardState.step === 6) {
    runGuideRecommendations();
    return;
  }
  showWizardStep(wizardState.step + 1);
}

function skipWizardField(field) {
  if (field === "dietary") {
    wizardState.answers.dietaryNeeds = [];
  } else if (field === "weather") {
    wizardState.answers.weather = "anytime";
  } else if (field === "toppingsWanted") {
    wizardState.answers.wantsToppings = "no";
  } else if (field === "taste") {
    wizardState.answers.tastePreference = "surprise me";
  } else {
    delete wizardState.answers[field];
  }
  saveWizardState();
  handleWizardNext();
}

function resetWizard() {
  wizardState = { step: 1, answers: {} };
  saveWizardState();
  renderWizardChoices();
  showWizardStep(1);
  setMode("guide");
}

function buildCriteriaFromWizard() {
  return {
    mood: wizardState.answers.mood || "",
    occasion: wizardState.answers.occasion || "",
    tastePreference: wizardState.answers.tastePreference || "surprise me",
    dietaryNeeds: (wizardState.answers.dietaryNeeds || []).filter((item) => item !== "none" && item !== "contains caffeine"),
    weather: wizardState.answers.weather || "anytime",
    wantsToppings: wizardState.answers.wantsToppings === "yes"
  };
}

function buildSession(criteria, results, debug, mode) {
  const session = {
    id: `session-${Date.now()}`,
    mode,
    mood: criteria.mood || "",
    occasion: criteria.occasion || "",
    tastePreference: criteria.tastePreference || "",
    weather: criteria.weather || "",
    dietaryNeeds: criteria.dietaryNeeds || [],
    results: results.map((entry) => entry.flavour.id),
    createdAt: new Date().toISOString()
  };
  state.sessions.push(session);
  state.analyticsEvents.push({
    type: "recommendation_generated",
    mode,
    mood: criteria.mood || "",
    occasion: criteria.occasion || "",
    topFlavour: results[0]?.flavour.flavourName || "",
    createdAt: session.createdAt
  });
  saveState();
  currentResults = results;
  currentDebug = debug;
  lastCriteria = criteria;
  renderRecommendations(mode, criteria, results, debug);
  renderAll();
}

function runGuideRecommendations() {
  const criteria = buildCriteriaFromWizard();
  const recommendation = recommendFlavours(state, criteria, { limit: 5 });
  buildSession(criteria, recommendation.results, recommendation.debug, "guide");
}

function handleSurpriseRun(event) {
  event.preventDefault();
  const form = new FormData(elements.surpriseForm);
  const criteria = {
    mood: "",
    occasion: "",
    tastePreference: "surprise me",
    dietaryNeeds: form.get("surpriseDietary") === "none" ? [] : [form.get("surpriseDietary")],
    weather: form.get("surpriseWeather"),
    wantsToppings: true
  };
  const recommendation = recommendFlavours(state, criteria, { limit: 3, upsellMode: true });
  buildSession(criteria, recommendation.results, recommendation.debug, "surprise");
}

function renderBrowse() {
  const form = new FormData(elements.browseForm);
  const selectedType = form.get("browseType");
  const dietary = form.get("browseDietary");
  const filtered = state.flavours.filter((flavour) => {
    const typeOk = selectedType === "all" || flavour.productType === selectedType;
    const dietaryOk = dietary === "none" || (flavour.dietaryTags || []).includes(dietary);
    return typeOk && dietaryOk && flavour.status !== "inactive";
  });

  elements.browseList.innerHTML = filtered
    .map(
      (flavour) => `
        <article class="catalog-card">
          <div>
            <span class="result-label">${flavour.productType}</span>
            <h3>${flavour.flavourName}</h3>
            <p>${flavour.description}</p>
            <p class="price-line">$${Number(flavour.basePrice).toFixed(2)} · ${flavour.status.replace("_", " ")}</p>
          </div>
          <div class="item-actions">
            <button class="secondary-button small-button" data-browse-recommend="${flavour.id}" type="button">Recommend around this</button>
            <button class="ghost-button small-button" data-browse-cart="${flavour.id}" type="button">Add to cart</button>
          </div>
        </article>`
    )
    .join("");

  elements.browseList.querySelectorAll("[data-browse-recommend]").forEach((button) => {
    button.addEventListener("click", () => runBrowseRecommendations(button.dataset.browseRecommend));
  });
  elements.browseList.querySelectorAll("[data-browse-cart]").forEach((button) => {
    button.addEventListener("click", () => addToCart(button.dataset.browseCart, []));
  });
}

function runBrowseRecommendations(anchorId = "") {
  const flavour = state.flavours.find((item) => item.id === anchorId);
  const criteria = {
    mood: flavour ? flavour.moodTags?.[0] || "" : "",
    occasion: flavour ? flavour.occasionTags?.[0] || "" : "",
    tastePreference: flavour ? flavour.baseTasteTags?.[0] || "surprise me" : "surprise me",
    dietaryNeeds: [],
    weather: flavour ? flavour.weatherSuitability?.[0] || "anytime" : "anytime",
    wantsToppings: true
  };
  const recommendation = recommendFlavours(state, criteria, { limit: 3, upsellMode: true });
  buildSession(criteria, recommendation.results, recommendation.debug, "know");
}

function rerollCurrentMode() {
  if (activeMode === "surprise") {
    elements.surpriseForm.requestSubmit();
  } else if (activeMode === "guide") {
    runGuideRecommendations();
  } else {
    runBrowseRecommendations();
  }
}

function renderRecommendations(mode, criteria, results, debug) {
  elements.resultsSummary.innerHTML = `
    <p class="result-label">Score context</p>
    <p>${mode === "guide" ? "Guided selection" : mode === "surprise" ? "Surprise run" : "Browse assist"} generated ${results.length} result(s). Weather: ${criteria.weather || "anytime"}. Dietary filters: ${(criteria.dietaryNeeds || []).join(", ") || "none"}.</p>
  `;

  elements.resultCards.innerHTML = results
    .map((entry, index) => {
      const toppingLines = entry.toppingSuggestions
        .map((topping) => `${topping.toppingName} (+$${Number(topping.priceAddOn).toFixed(2)})`)
        .join(", ");
      const basePrice = Number(entry.flavour.basePrice).toFixed(2);
      const suggestedTop = entry.toppingSuggestions[0];
      const total = suggestedTop ? entry.flavour.basePrice + suggestedTop.priceAddOn : entry.flavour.basePrice;
      const reason = [
        entry.scoreBreakdown.directMood.note,
        entry.scoreBreakdown.directOccasion.note,
        entry.scoreBreakdown.preference.note,
        entry.scoreBreakdown.rules.note
      ]
        .filter(Boolean)
        .join(" · ");

      return `
        <article class="result-card ${index === 0 ? "is-top" : ""}">
          <div class="result-card-head">
            <div>
              <span class="result-label">#${index + 1} · ${entry.flavour.productType}</span>
              <h3>${entry.flavour.flavourName}</h3>
              <p>${entry.flavour.description}</p>
            </div>
            <div class="score-chip">${entry.totalScore} pts</div>
          </div>
          <div class="result-grid">
            <article>
              <span class="result-label">Why recommended</span>
              <strong>Recommended because ${reason}.</strong>
            </article>
            <article>
              <span class="result-label">Toppings</span>
              <strong>${toppingLines || "No topping suggestion"}</strong>
            </article>
            <article>
              <span class="result-label">Pricing</span>
              <strong>Base $${basePrice}${suggestedTop ? ` · Top total $${Number(total).toFixed(2)}` : ""}</strong>
            </article>
            <article>
              <span class="result-label">Score breakdown</span>
              <strong>${formatBreakdown(entry.scoreBreakdown)}</strong>
            </article>
          </div>
          <div class="item-actions">
            <button class="primary-button small-button" data-add-cart="${entry.flavour.id}" data-add-top="${suggestedTop ? suggestedTop.id : ""}" type="button">Add to cart</button>
            <button class="ghost-button small-button" data-compare="${entry.flavour.id}" type="button">Compare</button>
          </div>
        </article>`;
    })
    .join("");

  elements.resultCards.querySelectorAll("[data-add-cart]").forEach((button) => {
    button.addEventListener("click", () => {
      const toppingId = button.dataset.addTop ? [button.dataset.addTop] : [];
      addToCart(button.dataset.addCart, toppingId);
    });
  });
  elements.resultCards.querySelectorAll("[data-compare]").forEach((button) => {
    button.addEventListener("click", () => compareFlavour(button.dataset.compare));
  });

  const top = results[0];
  if (top) {
    elements.heroSignature.textContent = top.flavour.flavourName;
    elements.heroDescription.textContent = top.flavour.description;
    elements.heroScore.textContent = `${top.totalScore} pts`;
  }

  currentDebug = debug;
}

function formatBreakdown(breakdown) {
  return [
    `Mood ${Math.round(breakdown.directMood.score)}`,
    `Taste ${Math.round(breakdown.preference.score)}`,
    `Occasion ${Math.round(breakdown.directOccasion.score)}`,
    `Weather ${Math.round(breakdown.directWeather.score)}`,
    `Rules ${Math.round(breakdown.rules.score)}`
  ].join(" · ");
}

function addToCart(flavourId, toppingIds) {
  const flavour = state.flavours.find((item) => item.id === flavourId);
  if (!flavour) {
    return;
  }
  const toppings = state.toppings.filter((item) => toppingIds.includes(item.id));
  const total = flavour.basePrice + toppings.reduce((sum, topping) => sum + Number(topping.priceAddOn || 0), 0);
  state.cart.push({
    id: `cart-${Date.now()}`,
    flavourId,
    toppings: toppings.map((item) => item.id),
    total,
    createdAt: new Date().toISOString()
  });
  state.analyticsEvents.push({
    type: "add_to_cart",
    topFlavour: flavour.flavourName,
    createdAt: new Date().toISOString()
  });
  saveState();
  elements.cartStatus.textContent = `${flavour.flavourName} added to cart for $${Number(total).toFixed(2)}.`;
  renderAll();
}

function compareFlavour(flavourId) {
  const compared = currentResults.find((entry) => entry.flavour.id === flavourId);
  if (!compared) {
    return;
  }
  elements.resultsSummary.innerHTML = `
    <p class="result-label">Compare flavour</p>
    <p>${compared.flavour.flavourName}: ${compared.flavour.description} Score details: ${formatBreakdown(compared.scoreBreakdown)}.</p>
  `;
}

function handleFeedbackSubmit(event) {
  event.preventDefault();
  if (!currentResults[0]) {
    return;
  }
  const form = new FormData(elements.feedbackForm);
  state.feedback.push({
    id: `feedback-${Date.now()}`,
    flavourId: currentResults[0].flavour.id,
    moodLift: form.get("feedbackMoodLift"),
    comment: form.get("feedbackComment"),
    createdAt: new Date().toISOString()
  });
  saveState();
  elements.cartStatus.textContent = "Feedback captured for the latest recommendation.";
  elements.feedbackForm.reset();
  renderAll();
}

function handleShare() {
  if (!currentResults[0]) {
    return;
  }
  const top = currentResults[0];
  const payload = `${top.flavour.flavourName} from Aumici - ${top.flavour.description}`;
  state.shareEvents.push({
    id: `share-${Date.now()}`,
    flavourId: top.flavour.id,
    payload,
    createdAt: new Date().toISOString()
  });
  saveState();

  if (navigator.share) {
    navigator.share({ title: "Aumici creation", text: payload }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(payload).catch(() => {});
  }
  elements.cartStatus.textContent = "Share intent recorded for analytics.";
  renderAll();
}

function renderMetrics(target, analytics) {
  target.innerHTML = `
    <article class="summary-card"><span class="result-label">Recommendation count</span><strong>${analytics.recommendationCount}</strong><p>Generated recommendation sessions.</p></article>
    <article class="summary-card"><span class="result-label">Conversion rate</span><strong>${analytics.conversionRate}%</strong><p>Recommendation to add-to-cart.</p></article>
    <article class="summary-card"><span class="result-label">Topping attach</span><strong>${analytics.toppingAttachRate}%</strong><p>Cart lines with toppings.</p></article>
    <article class="summary-card"><span class="result-label">Mood lift</span><strong>${analytics.satisfactionRate}%</strong><p>Feedback marked yes.</p></article>
    <article class="summary-card"><span class="result-label">Share attempts</span><strong>${analytics.shareAttempts}</strong><p>Recorded share clicks.</p></article>
    <article class="summary-card"><span class="result-label">Most recommended</span><strong>${topKey(analytics.mostRecommendedFlavour)}</strong><p>Top flavour in recommendation events.</p></article>
  `;
}

function renderAdminAnalytics() {
  renderMetrics(elements.adminAnalyticsGrid, summarizeAnalytics(state));
}

function renderPublicAnalytics() {
  renderMetrics(elements.analyticsGrid, summarizeAnalytics(state));
}

function topKey(record) {
  const entries = Object.entries(record || {});
  if (!entries.length) {
    return "None yet";
  }
  entries.sort((a, b) => b[1] - a[1]);
  return `${entries[0][0]} (${entries[0][1]})`;
}
