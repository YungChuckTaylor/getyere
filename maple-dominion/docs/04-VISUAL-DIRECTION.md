# 4. Visual direction and responsive system

## Character

A useful independent consultancy, not a generic corporate agency. The visual language is editorial, warm, grounded and calm: generous paper-like space, practical cards, visible boundaries, local typography and one strong orange accent. It should feel as easy to understand as the advice.

ZikZag Home 3 contributes **section rhythm**: strong opening, compact value strip, differentiated benefits, a clear philosophy/process, product portfolio, pricing and contact. Maple substitutes inspectable evidence for the reference’s testimonial rhetoric. No animated hero, copied composition, stock team, borrowed client logo, fake count or decorative chatbot.

## Colour tokens

| Token | Value | Use |
|---|---|---|
| Brand orange | `#E25112` | Main CTA fill, rules, decorative icons, highlights |
| Accessible orange | `#AC3808` | Small links, eyebrow labels, selected states, emphasized words |
| Ink | `#131713` | Text on paper and orange buttons |
| Paper | `#FBFAF7` | Main canvas |
| White | `#FFFFFF` | Working cards and form surfaces |
| Warm neutral | `#F1EFE8` | Benefits, supporting information |
| Intake peach | `#F2E6D8` | Static diagnostic intake card |
| Muted text | `#62645C` | Supporting copy with tested contrast |
| Hairline | `#DCDCD2` | Section and card boundaries, not sole control affordance |
| Deep charcoal | `#222B27` | Evidence panel and preview status strip |

Do **not** put small white text on brand orange and assume it passes AA. Ink on orange exceeds 4.5:1; accessible orange on paper is about 6.05:1. Muted text on paper is about 5.75:1 and on warm neutral about 5.22:1. Interactive boundaries, input borders, selected states and focus rings are stronger than decorative hairlines.

Decorative product wordmark text also meets its large-text contrast requirement. The original logo is preserved, not recoloured to force a palette match; logo artwork is not used as body text.

## Typography

- **DM Serif Display**, regular: headings, editorial quote and price numerals. Strong character, calm rather than performative.
- **DM Sans**, 400/500/600/700: navigation, body, labels, controls, practical instructions.
- Local WOFF2 assets with `font-display:swap`; both open-font licences are bundled. No runtime Google Fonts call.
- Desktop hero roughly 65px, page H1 up to 68px; H2 roughly 36–46px. Mobile H1 roughly 35–48px depending on available width. Body 16px baseline, supporting copy 13–15px, compact microcopy smaller but deliberately high contrast.
- Small uppercase labels use moderate letter-spacing. Main body copy is sentence case, short and plain-spoken. Never make a label the only explanation for an action.

## Layout, space and components

- Content cap: 1,240px. Desktop gutters: 48px; tablet: 28px; narrow phone: 20px.
- Main vertical spacing: 88px desktop, 65px tablet, 52px phone. Smaller 8/12/16/24/32px steps inside cards and forms.
- Hero: roughly 1.15:1 split, 60px gap. Static intake panel, offset neutral shadow, no motion or photographic stock asset.
- Cards: one-pixel borders, 2–4px corners; avoid glossy gradients and excessive floating shadows. Product logos may have softer corners without changing the card system.
- CTA: at least 44–50px high; clear action verb; charcoal text on brand fill. Secondary: neutral outlined button. Small orange text links use the darker accessible orange.
- Library cards show category, problem, short action promise and a clear next-step link. No author headshot, “read time” filler or blog-like date-led marketing.
- Pricing cards show CAD, range, period and scope together. Never detach a tempting number from exclusions.
- Evidence panel uses charcoal to mark a change of pace; the template is visibly labelled, not disguised as a real result.
- Form controls are full-width in their column with persistent labels, visible required/optional text, helper notes and plain failure/fallback language. Do not replace labels with placeholders.

## Responsive rules

| Width / breakpoint | Adaptation |
|---|---|
| Wide desktop | Two-column hero, three library cards, four pricing cards, two product cards |
| ≤1,200px | Tighter navigation, hero/card gaps and type scale |
| ≤1,000px | Accessible menu toggle, two-column pricing; hero remains a compact split |
| ≤760px | Hero stacks; product cards stack; library two columns where comfortable; process 2×2; picker, contact and report next-step blocks stack |
| ≤500px | Single library/pricing column; context forms stack; quick-win numbers move above content; tighter but readable controls |
| ≤360px | Hero CTAs stack; smaller editorial type; no hidden information |

The mobile page is not a desktop page squeezed smaller. It keeps the same truthful sequence while putting every action in the natural reading flow. Do not use horizontal carousels to hide an engagement or a price exclusion. No essential information depends on hover, animation or a fixed sidebar.

## Accessibility and interaction

- Native links, buttons, radio inputs, selects, checkboxes, fieldsets and legends.
- Logical heading hierarchy, landmark regions, skip-to-content link and visible keyboard focus.
- Menu has an explicit expanded state and Escape behaviour; route navigation closes it.
- Radio selection remains keyboard operable. Next is disabled until a choice exists. Back preserves answers. Main/legend receives deliberate focus after navigation without an animated scroll.
- Search preserves input focus while results update. Result count/status changes are announced without moving the cursor.
- Icon-only controls have names; redundant decoration is hidden from assistive technology. Product logo text has meaningful alternatives.
- Reduced-motion preference suppresses transitions. Hero has no animation in any mode.
- Print stylesheet removes navigation/contact capture while keeping the recommendations and commercial caveats.
- Automated audits are useful evidence, **not** an accessibility certification. Manual screen-reader checks, zoom, forced colours and independent Safari/Firefox testing remain release review items.

## Asset handoff

1. Original supplied `assets/maple-dominion-logo.png`, unchanged, displayed fully in the header and footer.
2. `assets/maple-mark.png`, leaf crop from the supplied original, used for the favicon only.
3. Approved existing `assets/yere-logo.png`, contained without distortion.
4. Cart Compare typography is explicitly a placeholder. Replace after the owner supplies its approved logo; do not commission an unrelated substitute without approval.
5. Local font files and licences under `assets/fonts/`.

## What must not creep into the design

No spinning/maple-leaf hero, fake partner strip, “most popular” tier without evidence, scarcity countdown, mandatory-email PDF, cookie banner for trackers that are not present, product-install badge implying an unverified store listing, anonymous five-star quote, insurance shield implying coverage, or uncited Ask Maple AI widget.
