# Flavour Decision Assistant

This is a standalone prototype module for the Aumici Point of Sale system. Because the real Aumici POS repository was not available in this workspace, the module is implemented as a browser-based demo using plain HTML, CSS, JavaScript ES modules, and localStorage.

## Architecture summary

- Frontend stack: plain HTML, CSS, JavaScript ES modules
- Backend stack: none in this prototype
- Database setup: browser localStorage only
- Auth and roles: lightweight client-side admin login plus customer flow
- Routing conventions: single-page module sections with in-page mode switching
- Component system: custom CSS components, no external UI library
- Testing framework: not present in this standalone prototype

## Data model proposal

Equivalent entities represented in browser state:

- `flavours`
- `moods`
- `occasions`
- `toppings`
- `recommendation_rules`
- `recommendation_sessions`
- `recommendation_feedback`
- `social_share_events`
- `analytics_events`
- `cart`
- `weights`

## API proposal for real integration

If this is moved into the real POS stack, the likely API surface should include:

- `GET /api/flavours`
- `POST /api/flavours`
- `PATCH /api/flavours/:id`
- `DELETE /api/flavours/:id`
- `GET /api/moods`
- `GET /api/occasions`
- `GET /api/toppings`
- `GET /api/recommendation-rules`
- `POST /api/recommendations/preview`
- `POST /api/recommendations/session`
- `POST /api/recommendations/feedback`
- `POST /api/recommendations/share-event`
- `GET /api/recommendations/analytics`

## Spreadsheet seeding

The attached `gelato_decision_matrix.xlsx` was translated into:

- seed rules in `data.js`
- mood and occasion starter labels
- initial flavour direction and topping direction mappings

The spreadsheet logic is not hardcoded permanently into the engine. Instead, it is represented as editable rule records and configurable weights.

## What is implemented

- Admin login
- Admin tabs for flavours, moods, occasions, toppings, rules, weights, and analytics
- Customer modes:
  - I know what I want
  - Guide me to choose
  - Surprise me
- Transparent scoring engine with score breakdown
- Pricing with topping add-on totals
- Add-to-cart mock
- Mood-lift feedback capture
- Share intent tracking
- Analytics tiles

## Open issues

- No real backend, auth system, database, stock integration, outlet filtering, or checkout integration
- No automated tests are available in this prototype workspace
- No image upload pipeline; image fields are text-based placeholders
- Social sharing uses browser-native share or clipboard fallback only
- Manager and cashier role separation is not implemented without a real auth system

## Run locally

```powershell
cd C:\Users\jeffr\Documents\Codex\2026-04-17-ai-gelato-designer
node server.mjs
```

Then open [http://127.0.0.1:8080](http://127.0.0.1:8080).

## Run the lightweight checks

```powershell
cd C:\Users\jeffr\Documents\Codex\2026-04-17-ai-gelato-designer
node recommendation.test.mjs
```
