# Mobile-First Audit Checklist

## Shared AppShell
- [x] Sidebar mobile default closed
- [x] Sidebar close on backdrop, `Esc`, swipe left
- [x] Mobile sticky top nav with page title
- [x] Mobile bottom nav with core routes + "More" sheet
- [x] Safe-area bottom padding for iPhone
- [x] Global overflow-x guard
- [x] Base tap-target minimum (`44px`) for controls

## Dashboard
- [x] Header spacing and typography adjusted for <640px
- [x] Action buttons stack/flex on small screens
- [x] Grid already mobile-first (1 column base)

## Clients
- [x] Desktop table + mobile cards pattern in place
- [x] Filters moved to mobile sheet (`Filtra`)
- [x] Search always visible on mobile
- [x] Mobile pagination switched to compact "Mostra altri"
- [ ] Client detail sticky action bar (deferred)

## Projects
- [x] Mobile pipeline as vertical stage list
- [x] Drag-and-drop disabled on mobile
- [x] Added explicit "Sposta" action per progetto (mobile)
- [x] Quick-create modal supports mobile fullscreen

## Messages
- [x] Desktop 2-column layout preserved
- [x] Mobile flow: conversation list -> chat fullscreen
- [x] Back action in mobile chat header
- [x] Composer made sticky on mobile

## Team
- [ ] Mobile cards and invite sheet (pending)

## Quotes
- [ ] Mobile cards + sticky send CTA (pending)

## Web Assets
- [ ] Mobile cards + links sheet (pending)

## Vault
- [ ] Mobile cards + reveal flow polish (pending)

## Calendar
- [ ] Agenda default on mobile + event sheet (pending)

## Profile / Branding
- [ ] Single-column and full-width picker final pass (pending)

## QA
- [x] Added responsive QA page with links to main modules
- [ ] Manual viewport QA pass on 320 / 375 / 768 / 1024
