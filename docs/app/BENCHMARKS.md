# AnugerahLink: Benchmarks

Date: 2026-11-17. Used to check `PLAN.md` and `DESIGN.md`.

Note: "Closs" did not match any platform in search. Confirm the name, and we will add it. Alibaba, Tokopedia and Amazon are compared at the level of their public product patterns, not their internal data.

## 1. What each benchmark tells us

| Benchmark | Relevant pattern | What we take | What we do not copy |
|---|---|---|---|
| **Alibaba.com (B2B)** | Verified supplier profiles, Trade Assurance (order protection and secure payment), certifications shown next to the listing, sample orders before big orders, response-time and on-time delivery metrics on each seller | Trust badges and a visible track record on every lot. Sample purchase option. Clear order protection wording | Open marketplace of unvetted sellers. We vet every lot before listing. Alibaba's Trade Assurance terms are not confirmed by public search, so we do not claim them |
| **Tokopedia (Indonesia B2C/B2B marketplace)** | Pure marketplace: sellers hold their own stock. Tokopedia itself holds no inventory. Indonesian buyers expect cheap, fast checkout and local payment methods | Familiar Indonesian checkout: clear totals, shipping shown before payment, bank transfer and e-wallet options (we start with bank transfer). Plain Bahasa-friendly labels | We hold our own inventory, so our model is closer to a trading company than a marketplace. Our checkout must reserve stock, not just show it |
| **Amazon (B2C e-commerce)** | Product detail page with the key facts above the fold. Stock messages ("Only 3 left"). Order timeline with status. Buy box with clear price and delivery. Reviews tied to a verified purchase | Lot page with key facts first (grade, cup score, region). Low-stock message. Status timeline. Feedback only after a verified delivery | Star-rating reviews from anyone. Our feedback is structured (taste, issues, reorder) and only from verified buyers, and is filtered before reaching farmers |
| **Sayurbox (Indonesia, fresh produce)** | Buys from farmers and resells through an app. Hybrid B2B and B2C. Fresh-produce delivery windows | Farm-to-buyer story on the home page. Sale of the same product to both cafes and households is not in our scope | Consumer grocery app. We sell to businesses only in phase 1 |
| **TaniHub / TaniGroup (Indonesia, agritech)** | B2B-led farmer-to-buyer marketplace, with lending (TaniFund) and logistics (TaniSupply) arms. Farmer count claims of 25,000 | Bundled services (finance, logistics) are a later phase, not phase 1 | Their scale and funding path. Our plan funds itself from trading margin (see `docs/business`) |
| **AgriAku (Indonesia, inputs B2B)** | B2B input marketplace; later a finance arm. Gojek and BRI Ventures back it | Credit and finance as a later revenue line, once volume is steady | Input selling to farmers. We do not sell inputs |
| **PasarMikro (Indonesia, commodities)** | Commodity marketplace that grew into a B2B marketplace with built-in finance | The idea that commodity buyers want finance and logistics on the same screen. Later phase | Open commodity exchange. We grade and vet before listing |
| **Traderex (Ghana) / Hectare (UK) / Vosbor / CropConex** | Commodity exchanges and listing sites for grain and oilseed. Buyer and seller connect, then trade offline | Listing with price per tonne/kg and availability. Contact-to-order flow | Exchange-style bidding. Our prices are fixed and published |
| **TradeBridge (India)** | "Amazon of agro commodities" for dry fruits and spices, with B2B listing and order flow | Category and filter layout for commodities (grade, origin, price) | Their open listing model |

## 2. Patterns we adopt in the build

1. **Trust on every card and lot page.** Tier, grade, cup score, region and farmer group are visible without a click. The passport is one tap away. (Alibaba verified-supplier pattern; Amazon key-facts pattern.)
2. **Order protection wording without overstating it.** Say what we do: every lot is graded before listing, the stock is reserved when you order, and a sample is available before a large order. Do not promise a refund policy we have not written.
3. **Shipping shown before the buyer commits.** Each lot card and the cart show whether shipping is included, extra, or collected in Papua (Tokopedia checkout pattern).
4. **Stock messages.** "Only 45 kg left" under 60 kg, and "Sold out" with no add-to-cart button (Amazon pattern).
5. **Order timeline.** Requested, confirmed, paid, shipped, delivered, with dates (Amazon and Tokopedia pattern).
6. **Sample before bulk.** A "Request a sample" link on each lot page for buyers ordering 200 kg or more. Phase 1 handles it as an order with a sample reference, not a separate system. (Alibaba sample-order pattern.)
7. **Track record on the group, not the buyer.** Public group page shows the number of lots and the average cup score across graded lots. No buyer reviews are shown publicly in phase 1. (Alibaba seller metrics, adapted for a farmer-group-first model.)
8. **Mobile first and low-bandwidth.** No external scripts, fonts or images, because buyers in the highlands and Papua often have slow connections. (Lessons from the GSMA agri e-commerce design work on smallholder literacy and connectivity.)

## 3. Patterns we deliberately do not adopt

- Open seller listings with no vetting (Alibaba, TradeBridge).
- Star-rating reviews from anyone (Amazon).
- Consumer grocery and household delivery (Sayurbox).
- Input sales and farmer-facing shops (AgriAku, TaniHub).
- Exchange-style bidding (Vosbor, Hectare, CropConex).

## 4. Claims to avoid, drawn from the benchmarks

- "Trade Assurance" or any named buyer protection programme: we have not written one.
- "Verified supplier" with a badge that implies a third-party audit: we do grading, not certification. Say "graded by AnugerahLink".
- Farmer counts or revenue figures from aggregators (CB Insights, Dealroom, Salestools): they disagree with each other, so they are not used in marketing.

## 5. Sources

- Alibaba seller blog, coffee certification and sourcing guides (2026): https://seller.alibaba.com/blogs/2026/southeast-asia/coffee-beans/certification-quality-standards-guide-alibaba-b2b
- Alibaba coffee sourcing listing examples, including Robusta store metrics: https://www.alibaba.com/price-comparison/coffe-beans-distributor
- AgFunderNews, Indonesian agritech and AgriAku: https://agfundernews.com/agriaku-gojek-fund-leads-6m-pre-series-a-investment-in-indonesian-inputs-marketplace
- TechCrunch, AgriAku pre-Series A (2022): https://techcrunch.com/2022/03/02/indonesian-agritech-agriaku-reaps-6m-in-pre-series-a-funding
- AlphaJWC, AgriAku Series A: https://www.alphajwc.com/en/b2b-agriculture-marketplace-agriaku-raises-usd-35-million-series-a-funding/
- KrASIA, Sayurbox startup profile: https://kr-asia.com/sayurbox-is-developing-a-sustainable-agricultural-supply-chain-in-indonesia-startup-stories
- e27, Tokopedia and Sayurbox investment: https://e27.co/sources-tokopedia-does-get-involved-in-a-funding-round-for-sayurbox-20190715/
- Entrepreneur Asia Pacific, Indonesian farmer-buyer startup: https://apac.entrepreneur.com/news-and-trends/how-this-indonesian-startup-is-connecting-farmers-with/334464
- The Ken, Sayurbox and TaniHub comparison: https://the-ken.com/sea/story/sayurbox-tanihub-offer-fix-for-indonesias-flawed-food-supply/
- GSMA, user-centred design for agri e-commerce for smallholders: https://www.gsma.com/mobilefordevelopment/mobile-for-development-2/how-user-centred-design-can-improve-agri-e-commerce-interfaces-that-cater-to-the-needs-and-literacy-levels-of-smallholder-farmers/
- TXF News, digital commodity platforms: https://txfnews.com/articles/7239/digital-platforms-give-commodities-extra-lift
- YourStory, TradeBridge: https://yourstory.com/2021/07/amazon-agro-commodities-tradebridge-digitising-dry-fruits-spices/amp

Tokopedia's own product pages and Amazon's product-page conventions were not fetched for this note. The Tokopedia and Amazon patterns above come from general knowledge of those products, not from a fresh review, and should be checked against the live sites before the design is final.
