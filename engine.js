function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeList(values) {
  return (values || []).map(normalize).filter(Boolean);
}

function includesAny(pool, wanted) {
  return wanted.some((value) => pool.includes(value));
}

function parseRecommendedBase(raw) {
  return normalize(raw)
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function flavorAllowed(flavour, criteria) {
  if (flavour.status === "inactive" || flavour.status === "sold_out" || flavour.stockStatus === "sold_out") {
    return { allowed: false, reason: "Sold out or inactive" };
  }

  const dietaryNeeds = normalizeList(criteria.dietaryNeeds);
  if (dietaryNeeds.length > 0) {
    const dietaryTags = normalizeList(flavour.dietaryTags);
    const compliant = dietaryNeeds.every((need) => dietaryTags.includes(need));
    if (!compliant) {
      return { allowed: false, reason: "Dietary mismatch" };
    }
  }

  return { allowed: true };
}

function collectMatchedRules(flavour, criteria, rules) {
  const flavourTags = normalizeList(flavour.baseTasteTags);
  const matched = [];

  for (const rule of rules) {
    if (!rule.enabled) {
      continue;
    }

    const moodMatches = !rule.mood || normalize(rule.mood) === normalize(criteria.mood);
    const occasionMatches = !rule.occasion || normalize(rule.occasion) === normalize(criteria.occasion);
    const weatherMatches = !rule.weather || normalize(rule.weather) === normalize(criteria.weather);
    const baseMatches = parseRecommendedBase(rule.recommendedBase);
    const typeMatches = baseMatches.length === 0 || baseMatches.includes(normalize(flavour.productType));
    const includeTags = normalizeList(rule.includeTags);
    const excludeTags = normalizeList(rule.excludeTags);
    const includeMatches = includeTags.length === 0 || includesAny(flavourTags, includeTags);
    const excludeHits = excludeTags.length > 0 && includesAny(flavourTags, excludeTags);

    if (moodMatches && occasionMatches && weatherMatches && typeMatches && includeMatches && !excludeHits) {
      matched.push(rule);
    }
  }

  return matched;
}

function tastePreferenceScore(flavour, criteria, weights) {
  const preference = normalize(criteria.tastePreference);
  const tags = normalizeList(flavour.baseTasteTags);
  const map = {
    creamy: ["creamy", "indulgent"],
    fruity: ["fruity", "light", "tangy"],
    icy: ["refreshing", "light", "tangy"],
    indulgent: ["indulgent", "chocolatey", "nutty", "coffee"],
    light: ["light", "refreshing", "fruity"],
    "surprise me": []
  };

  if (!preference || preference === "surprise me") {
    return { score: 0, note: "No strong taste preference selected" };
  }

  const desired = map[preference] || [];
  const hits = desired.filter((tag) => tags.includes(tag)).length;
  return {
    score: hits * (weights.preference / 2),
    note: hits > 0 ? `${hits} taste tag match(es)` : "No taste tag match"
  };
}

function directTagScore(flavour, criteria, weights) {
  const moodTags = normalizeList(flavour.moodTags);
  const occasionTags = normalizeList(flavour.occasionTags);
  const weatherTags = normalizeList(flavour.weatherSuitability);
  const mood = normalize(criteria.mood);
  const occasion = normalize(criteria.occasion);
  const weather = normalize(criteria.weather);

  return {
    mood: {
      score: mood && moodTags.includes(mood) ? weights.mood : 0,
      note: mood && moodTags.includes(mood) ? "Mood tag match" : "No direct mood tag match"
    },
    occasion: {
      score: occasion && occasionTags.includes(occasion) ? weights.occasion : 0,
      note: occasion && occasionTags.includes(occasion) ? "Occasion tag match" : "No direct occasion tag match"
    },
    weather: {
      score: weather && weatherTags.includes(weather) ? weights.weather : 0,
      note: weather && weatherTags.includes(weather) ? "Weather fit" : "No direct weather fit"
    }
  };
}

function metricsScore(flavour, weights, upsellMode) {
  return {
    priority: {
      score: (Number(flavour.priorityScore || 0) / 100) * weights.priority,
      note: `Priority ${flavour.priorityScore || 0}`
    },
    popularity: {
      score: (Number(flavour.popularityScore || 0) / 100) * weights.popularity,
      note: `Popularity ${flavour.popularityScore || 0}`
    },
    margin: {
      score: (Number(flavour.marginScore || 0) / 100) * weights.margin,
      note: `Margin ${flavour.marginScore || 0}`
    },
    upsell: {
      score: upsellMode ? (Number(flavour.upsellScore || 0) / 100) * weights.upsell : 0,
      note: upsellMode ? `Upsell ${flavour.upsellScore || 0}` : "Upsell mode off"
    }
  };
}

function toppingSuggestions(flavour, toppings, criteria, matchedRules, upsellMode) {
  const recommended = normalizeList(flavour.recommendedToppings);
  const desiredTags = normalizeList(flavour.baseTasteTags);
  const dietaryNeeds = normalizeList(criteria.dietaryNeeds);
  const ruleSuggestions = matchedRules.flatMap((rule) => rule.toppingDirection || []).map(normalize);

  const available = toppings.filter((topping) => topping.status === "active" && topping.stockStatus !== "sold_out");
  const scored = available
    .map((topping) => {
      const compatibility = normalizeList(topping.compatibilityTags);
      const dietary = normalizeList(topping.dietaryTags);
      const dietaryOk = dietaryNeeds.every((need) => dietary.includes(need) || dietaryNeeds.length === 0 || need === "contains caffeine");
      if (!dietaryOk && dietaryNeeds.length > 0) {
        return null;
      }

      let score = 1;
      if (recommended.includes(normalize(topping.toppingName))) {
        score += 5;
      }
      if (ruleSuggestions.includes(normalize(topping.toppingName))) {
        score += 4;
      }
      if (includesAny(compatibility, desiredTags)) {
        score += 3;
      }
      if (upsellMode) {
        score += Number(topping.upsellPriority || 0) / 30;
      }

      return { topping, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 3).map((entry) => entry.topping);
}

export function recommendFlavours(state, criteria, options = {}) {
  const weights = state.weights;
  const rules = state.rules;
  const toppings = state.toppings;
  const upsellMode = Boolean(criteria.wantsToppings) || Boolean(options.upsellMode);
  const explain = [];

  const ranked = state.flavours
    .map((flavour) => {
      const allowed = flavorAllowed(flavour, criteria);
      if (!allowed.allowed) {
        return null;
      }

      const direct = directTagScore(flavour, criteria, weights);
      const preference = tastePreferenceScore(flavour, criteria, weights);
      const matchedRules = collectMatchedRules(flavour, criteria, rules);
      const ruleScore = matchedRules.reduce((sum, rule) => sum + Number(rule.weightBoost || 0), 0);
      const metrics = metricsScore(flavour, weights, upsellMode);
      const total =
        direct.mood.score +
        direct.occasion.score +
        direct.weather.score +
        preference.score +
        ruleScore +
        metrics.priority.score +
        metrics.popularity.score +
        metrics.margin.score +
        metrics.upsell.score;

      const suggestions = toppingSuggestions(flavour, toppings, criteria, matchedRules, upsellMode);
      const breakdown = {
        directMood: direct.mood,
        directOccasion: direct.occasion,
        directWeather: direct.weather,
        preference,
        rules: {
          score: ruleScore,
          note: matchedRules.length
            ? matchedRules.map((rule) => `${rule.name} (+${rule.weightBoost})`).join(", ")
            : "No seeded rule match"
        },
        priority: metrics.priority,
        popularity: metrics.popularity,
        margin: metrics.margin,
        upsell: metrics.upsell
      };

      explain.push({ flavour: flavour.flavourName, score: total, breakdown });

      return {
        flavour,
        totalScore: Math.round(total),
        matchedRules,
        scoreBreakdown: breakdown,
        toppingSuggestions: suggestions
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.totalScore - a.totalScore);

  const limit = options.limit || 5;
  return {
    results: ranked.slice(0, limit),
    debug: explain.sort((a, b) => b.score - a.score)
  };
}

export function summarizeAnalytics(state) {
  const events = state.analyticsEvents || [];
  const sessions = state.sessions || [];
  const feedback = state.feedback || [];
  const shares = state.shareEvents || [];
  const cartCount = (state.cart || []).length;

  const countBy = (rows, key) =>
    rows.reduce((accumulator, row) => {
      const value = row[key] || "unknown";
      accumulator[value] = (accumulator[value] || 0) + 1;
      return accumulator;
    }, {});

  const conversionEvents = events.filter((event) => event.type === "add_to_cart");
  const recommendationEvents = events.filter((event) => event.type === "recommendation_generated");
  const shareAttempts = shares.length;
  const upliftYes = feedback.filter((item) => item.moodLift === "yes").length;

  return {
    sessions: sessions.length,
    recommendationCount: recommendationEvents.length,
    cartAdds: conversionEvents.length,
    cartCount,
    conversionRate: recommendationEvents.length
      ? Math.round((conversionEvents.length / recommendationEvents.length) * 100)
      : 0,
    toppingAttachRate: cartCount
      ? Math.round(
          ((state.cart || []).filter((item) => (item.toppings || []).length > 0).length / cartCount) * 100
        )
      : 0,
    satisfactionRate: feedback.length ? Math.round((upliftYes / feedback.length) * 100) : 0,
    mostSelectedMood: countBy(sessions, "mood"),
    mostSelectedOccasion: countBy(sessions, "occasion"),
    mostRecommendedFlavour: countBy(
      recommendationEvents.map((event) => ({ flavour: event.topFlavour })),
      "flavour"
    ),
    shareAttempts
  };
}
