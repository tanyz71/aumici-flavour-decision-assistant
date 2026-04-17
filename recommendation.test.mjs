import assert from "node:assert/strict";
import { initialState } from "./data.js";
import { recommendFlavours, summarizeAnalytics } from "./engine.js";

function topNames(output) {
  return output.results.map((entry) => entry.flavour.flavourName);
}

{
  const output = recommendFlavours(
    initialState,
    {
      mood: "tired",
      occasion: "hot-afternoon",
      tastePreference: "icy",
      dietaryNeeds: ["dairy-free"],
      weather: "hot day",
      wantsToppings: true
    },
    { limit: 3 }
  );

  assert.deepEqual(topNames(output), ["Mango Sorbet", "Lemon Yuzu Sorbet", "Watermelon Granita"]);
}

{
  const output = recommendFlavours(
    initialState,
    {
      mood: "romantic",
      occasion: "date-night",
      tastePreference: "creamy",
      dietaryNeeds: [],
      weather: "anytime",
      wantsToppings: true
    },
    { limit: 2 }
  );

  assert.equal(output.results.length, 2);
  assert.equal(output.results[0].flavour.flavourName, "Pistachio Supreme");
  assert.ok(output.results[0].totalScore >= output.results[1].totalScore);
}

{
  const state = structuredClone(initialState);
  state.analyticsEvents.push(
    { type: "recommendation_generated", topFlavour: "Mango Sorbet" },
    { type: "recommendation_generated", topFlavour: "Mango Sorbet" },
    { type: "add_to_cart", topFlavour: "Mango Sorbet" }
  );
  state.cart.push({ id: "cart-1", toppings: ["mint-leaves"] });
  state.feedback.push({ id: "feedback-1", moodLift: "yes" });
  state.shareEvents.push({ id: "share-1" });

  const analytics = summarizeAnalytics(state);
  assert.equal(analytics.recommendationCount, 2);
  assert.equal(analytics.cartAdds, 1);
  assert.equal(analytics.shareAttempts, 1);
  assert.equal(analytics.satisfactionRate, 100);
}

console.log("recommendation.test.mjs passed");
