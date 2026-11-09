# Selling plants — the plan

**Status: stage 1 is built; stages 2 and 3 are not.** The site is now a shop front
(2026-11-09): every plant has a price, the home page lists them all with prices,
and each page has an **Order on WhatsApp** button. What exists:

- `plants.price_minor`, `original_price_minor`, `currency`, `price_note`,
  `availability` (migration `0004`, which also moved the prices the shop had been
  typing into the last Deep Dive point into these columns).
- The admin form's *Price & availability* section.
- The home page shop grid, sortable by name or price, sold-out last.
- The order button, which adapts: *Order on WhatsApp*, *Check availability*,
  *Ask for the price* or *Ask when it's back*.
- A delivery check on the plant page: a pincode in, a date range out (1–3
  working days to Tamil Nadu, Andhra Pradesh, Kerala and Karnataka, 2–5 anywhere
  else; Sundays skipped). The pincode goes into the WhatsApp order message. It is
  pure front-end (`frontend/src/lib/delivery.js`), so it is an estimate, not a
  promise from a courier. Telangana is not on the short list.

**The switch in §4 was not built.** It was written for a launch that was still
weeks away; the shop's decision since is that prices are the point of the site,
so prices ship with the code. If a dark launch is wanted again, §4 still says how.

The rest of this file is the thinking behind it, so the decisions don't have to
be made twice. §2's questions about sizes, stock counts, several shops and
delivery are still open, and stage 2 and 3 still wait on them.

---

## 1. The question that decides everything

**Is this "buy online and have it delivered", or "know the price and carry it to
the counter"?**

The whole product assumes someone standing in the shop, phone in hand, in front
of the plant. That person does not need a cart, an address form or a courier.
They need to know what it costs and whether they can take one home today.

| | Know the price | Buy online |
|---|---|---|
| What the page gains | a price, a stock line, a "Reserve this" button | a real checkout |
| New moving parts | none — the WhatsApp link already exists in `ContactButton` | payments, orders, stock that must stay truthful, refunds, GST, delivery |
| Time to build | days | weeks, and it never stops needing attention |
| Fails how | someone has to reply to a message | someone paid and the plant is not there |

The second one is a different product, not a bigger version of the first. It is
worth building **after** we know people tap the button at all — which stage 1
tells us for free.

**Recommendation: build stage 1, watch it for a month, then decide.**

## 2. Answer these before any code

1. **Sizes.** Does one plant sell at one price, or at three prices for three pot
   sizes? This is the one decision that is expensive to change later: variants
   need their own table from the start, and bolting them on afterwards means
   migrating every price already entered.
2. **Stock.** Is a number tracked, or is it just "available / ask us"? A number
   that drifts out of true is worse than no number.
3. **Who sells.** One shop, or several? Several means prices and stock belong to
   a shop, not to a plant.
4. **Delivery.** Pickup only, local delivery, or shipping? Shipping live plants
   has its own rules and its own refund rate.

## 3. Staged plan

### Stage 1 — a price on the page

The plant page shows the price and whether it is available, plus a button that
opens WhatsApp with the plant already named in the message.

Database — new columns on `plants`:

| Column | Type | Why |
|---|---|---|
| `price_minor` | integer, nullable | **Paise, never rupees as a float.** Money in a float is a rounding bug waiting for a customer to find it. Null means "no price shown". |
| `currency` | string(3) | `INR`. Explicit from day one; adding it later means backfilling every row. |
| `price_note` | string(120) | "6-inch pot", "per plant" — the context a bare number leaves out. |
| `availability` | string(20) | `in_stock` / `ask` / `sold_out`. Not a boolean: "ask us" is a real answer and a boolean cannot say it. |

API: these appear in the plant response **only when the feature is on** (see §4).
Admin: one more section in `PlantForm`, laid out like the rest.

Done when: a price can be set in the dashboard, it shows on the page, the button
opens WhatsApp naming the plant, and all of it vanishes when the switch is off.

### Stage 2 — sizes, if the answer to §2.1 is yes

A `plant_variants` table: plant, size label, `price_minor`, `availability`,
sort order. The page shows a size picker; the price follows the choice. Stage 1's
columns stay as the default for a plant with no variants.

### Stage 3 — real checkout, only if stage 1 earns it

New tables: `orders`, `order_items`, `payments`. A hosted checkout — Razorpay or
similar, with UPI, which is how people here actually pay. **Card details never
touch our server**; the provider's hosted page handles them, and we store only
their reference. Orders need: a status that survives a failed payment, an email
or SMS receipt, and somewhere for the shop to see what was ordered.

Also needed before taking a single rupee: a refund and cancellation policy, GST
handling, and terms on the site.

## 4. The switch

The feature is built, merged and dark. Two rules make that safe:

**Gate the API, not just the button.** If the flag only hides the UI, prices
still ship inside the JSON and anyone can read them before launch. So
`COMMERCE_ENABLED` decides whether the commerce router is registered *and*
whether the price fields appear in a plant response at all.

**Gate the frontend at build time.** `VITE_COMMERCE_ENABLED`, off by default, so
the code is tree-shaken out of the bundle a customer downloads — the same reason
the admin dashboard is its own chunk.

The migration ships while the flag is off. Adding nullable columns is harmless,
and schema-first means the day the switch is flipped there is no database change
happening under time pressure.

Tests run both ways: with the flag on, and with it off. The off case is the one
that protects a launch date, so it is the one that must not rot.

## 5. Gates that are not code

- **Vercel Hobby forbids commercial use.** Selling is commercial. Moving the
  hosting is a hard prerequisite for stage 1 going live, not a nice-to-have.
- **Supabase free pauses after a week of inactivity.** A paused database with a
  price on the page is worse than no price.
- A payment provider needs business details and a bank account; that paperwork
  takes longer than the code does.

## 6. What this does not change

The plant page is still the point. It is a reference page that happens to tell
you the price — not a shop listing with care notes attached. If the buy button
ever makes the page feel like a storefront, it has gone too far.
