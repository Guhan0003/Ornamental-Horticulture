# Project Statement — Ornamental Horticulture

**By StomatalWorld**

## The idea

A Wikipedia-style reference page for ornamental plants.

## The problem

A customer standing in a plant store in front of a plant they like has no easy way to
find out what it actually is. What is this plant called? How much light does it need?
How often do I water it? Is it safe around pets? Will it survive in my flat?

That information exists, but it is scattered across the internet, written for gardeners
rather than buyers, and useless at the exact moment it is needed — while the customer is
standing in the store deciding whether to buy.

## The solution

Every plant in the store carries a **QR code** on or below it. The customer scans it with
their phone and lands directly on that plant's page: name, description, care instructions,
and the details that matter.

## What this is NOT

This is deliberately **not** a browse-first website. Nobody is expected to visit the
homepage and search through a catalogue. The entry point is physical — a plant in a store,
a QR code, a phone.

That single decision drives everything:

- **One QR → one plant page.** Each page must stand completely on its own, because it is
  almost always the first and only page a visitor sees.
- **Mobile-first, always.** Every real visit comes from a phone camera in a store.
- **Fast on bad networks.** Store Wi-Fi is poor and the customer will not wait.
- **No login, no app install.** Scan and read. Any friction loses the customer.

## Current status

Pre-launch. This repository currently contains a placeholder landing page while the plant
pages are being built. Target: **live within a month.**

## Roadmap

1. ~~Placeholder landing page~~ — done
2. Plant page template — the core deliverable, one page per plant
3. Plant data model and content for the initial set of plants
4. QR code generation, one per plant, pointing at its page URL
5. Print-ready QR labels for the store
