# StatTracker UI/UX Design System Documentation

> **Status:** Living Document & Reference Guide  
> **Target Stack:** React 19, Tailwind CSS v4, Framer Motion 13, Lucide React, Supabase  
> **Document Purpose:** System of record for StatTracker's visual identity, UI conventions, component standards, responsive behavior, verified patterns, detected gaps, and proposed specifications for future development.

---

## Table of Contents

1. [Executive Summary & Verification Status](#1-executive-summary--verification-status)
2. [Product Identity & Aesthetics](#2-product-identity--aesthetics)
3. [Design Tokens & Theme Foundation](#3-design-tokens--theme-foundation)
4. [Reusable Components Specification](#4-reusable-components-specification)
5. [Page-Specific Conventions](#5-page-specific-conventions)
6. [Mobile-First Guidelines & Viewport Standards](#6-mobile-first-guidelines--viewport-standards)
7. [Motion, Animation & Feedback Rules](#7-motion-animation--feedback-rules)
8. [Performance, Caching & Data Integrity Rules](#8-performance-caching--data-integrity-rules)
9. [Gaps, Inconsistencies & Proposed Upgrades](#9-gaps-inconsistencies--proposed-upgrades)
10. [Contribution, Review & Maintenance Checklist](#10-contribution-review--maintenance-checklist)

---

## 1. Executive Summary & Verification Status

StatTracker is a mobile-first weekly football statistics tracking application designed for pitch organizers and players. Its primary UX priority is **lightning-fast pitch operation** ("one-hand, one-tap, minimal typing") coupled with high-impact sports broadcast aesthetics (FIFA/EA FC card styling, dark stadium pitch atmospheres, and golden trophy honors).

### Convention Status Taxonomy
Every pattern in this document is labeled with one of three status markers:
* `[VERIFIED]`: Currently implemented in production code (`frontend/src`).
* `[INCONSISTENCY]`: Present in codebase but implemented inconsistently across pages or with hardcoded ad-hoc values.
* `[PROPOSED]`: Recommended standard to resolve gaps, streamline maintenance, or prepare for future features.

---

## 2. Product Identity & Aesthetics

### Visual Metaphor
StatTracker takes visual cues from modern night-game football stadium broadcasts, sports cards, and digital pitch boards:
* **The Pitch Atmosphere:** Near-black obsidian (`#0a0a0a` / `neutral-950`) and pitch-turf dark emerald (`#051410`) backgrounds create high-contrast immersion.
* **The Electric Turf:** Neon emerald green (`--color-primary-500: #10b981`) serves as the active turf line, indicating active states, live goals, buttons, and confirmed actions.
* **Trophy & Hall of Fame Accents:** Deep golds, ambers (`#f59e0b`), and fiery oranges (`#f97316`) celebrate achievements, streaks ("On Fire"), and top podium scorers.
* **Secondary Match Stats:** Crisp icy blues (`#60a5fa` / `blue-400`) provide immediate visual separation for playmakers and assists (`Goals / Assists` -> `White / Blue`).

### Principles for Imagery & Media
1. **Player Photography & Card Vignettes `[VERIFIED]`:**
   - Player photos are displayed with high-contrast darkening vignette overlays: `bg-gradient-to-b from-black/80 via-transparent to-black/95` (Cards) or `bg-gradient-to-r from-neutral-950 via-neutral-950/50 to-neutral-950` (Leaderboard rows).
   - Ensures text always achieves WCAG AA contrast (≥ 4.5:1) regardless of player kit or photo brightness.
   - Images use `loading="lazy"` and `decoding="async"` with `object-cover object-[center_20%]`.
2. **Visual Hierarchy `[VERIFIED]`:**
   - **Primary Glance (0-1s):** Massive numeric score or metric (e.g. `text-3xl sm:text-5xl font-black tabular-nums`).
   - **Secondary Glance (1-2s):** Player names, match status badges, and team labels.
   - **Tertiary Detail (2-4s):** Minute marks, per-game averages, and auxiliary trophy badges.

---

## 3. Design Tokens & Theme Foundation

StatTracker uses **Tailwind CSS v4** with CSS variable theme bindings located in `frontend/src/index.css`.

### 3.1 Color Palette

#### Primary Accent (Emerald / Turf Green) `[VERIFIED]`
| Token | Hex Value | Usage |
| :--- | :--- | :--- |
| `--color-primary-50` | `#ecfdf5` | Subtle highlight backgrounds |
| `--color-primary-100` | `#d1fae5` | Pill backgrounds (tinted) |
| `--color-primary-200` | `#a7f3d0` | Light borders |
| `--color-primary-300` | `#6ee7b7` | High-contrast text on dark |
| `--color-primary-400` | `#34d399` | Active nav indicator text, hover text |
| `--color-primary-500` | `#10b981` | Core primary brand color, default CTA buttons |
| `--color-primary-600` | `#059669` | Button hover states |
| `--color-primary-700` | `#047857` | Pressed states, active borders |
| `--color-primary-800` | `#065f46` | Deep container outlines |
| `--color-primary-900` | `#064e3b` | Dark container backgrounds |
| `--color-primary-950` | `#022c22` | Dark pitch container cards |

*Note on Theme Switching:* A custom Easter-egg/profile theme `.theme-pink` switches `--color-primary-*` to Rose/Pink hues (`#f43f5e`) dynamically for designated profiles.

#### Surface & Background Tokens `[VERIFIED]`
| Token / Utility | Hex / Value | Context |
| :--- | :--- | :--- |
| `bg-neutral-950` | `#0a0a0a` | Global application canvas / viewport background |
| `bg-neutral-900` | `#171717` | Desktop sidebar, modals, input containers, bottom sheet |
| `bg-neutral-900/95` | `rgba(23,23,23,0.95)` | Backdrop blur headers and bottom nav bar (`backdrop-blur-xl`) |
| `bg-[#051410]` | `#051410` | Stat card & pitch container background |
| `bg-black/80` | `rgba(0,0,0,0.80)` | Modal backdrop masks (`backdrop-blur-sm`) |

#### Semantic & Achievement Tokens `[VERIFIED]`
| Category | Hex / Tailwind | Context |
| :--- | :--- | :--- |
| **Orange / Streaks** | `#f97316` (`orange-500`) | "On Fire" streak badges, flaming borders |
| **Gold / Winner** | `#f59e0b` (`amber-500` / `yellow-400`) | Rank 1 Golden Boot, MOTM Award (⭐) |
| **Silver / Runner-up** | `#d4d4d8` (`neutral-300`) | Rank 2 awards, silver rating tier (75-79 OVR) |
| **Bronze / 3rd Place** | `#c2410c` (`orange-700` / `amber-700`) | Rank 3 awards, bronze rating tier (<75 OVR) |
| **Assists / Playmaker** | `#60a5fa` (`blue-400` / `blue-500`) | Assist counters, playmaker badges |
| **Defender Award** | `#f59e0b` (`amber-500`) | Best Defender (🛡️) count |
| **Goalkeeper Award** | `#c084fc` (`purple-400`) | Best GK (🧤) count |
| **Danger / Delete** | `#ef4444` (`red-500` / `red-400`) | Sign out, destructive actions, discard match |

### 3.2 Typography System

The application uses the system sans-serif stack optimized for numeric legibility with OpenType features enabled:
```css
body {
  @apply bg-neutral-950 text-neutral-50 antialiased;
  font-feature-settings: "cv02", "cv03", "cv04", "cv11";
}
```

#### Hierarchy Scale `[VERIFIED]`
| Level | Classes | Font Weight | Line Height | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Display** | `text-4xl sm:text-6xl` | `font-black` (900) | `leading-none` | `tracking-tighter` | Active match scoreboard, modal hero |
| **Page Title** | `text-2xl sm:text-4xl` | `font-black` (900) | `leading-tight` | `tracking-tight` | Screen headers (`Welcome back!`, `Leaderboard`) |
| **Section Heading** | `text-lg sm:text-xl` | `font-bold` (700) | `leading-snug` | `tracking-wider` | Card group titles (`UPCOMING`, `RECENT`) |
| **Component Title**| `text-base sm:text-lg` | `font-bold` (700) | `leading-normal` | Normal | Player names, match team names |
| **Stat Display** | `text-3xl sm:text-4xl` | `font-black` (900) | `leading-none` | `tabular-nums` | Goals scored, match counts, assists |
| **Body Standard** | `text-sm sm:text-base` | `font-medium` (500) | `leading-relaxed`| Normal | Paragraphs, dialog descriptions |
| **Meta / Label** | `text-[10px] sm:text-xs`| `font-bold` (700) | `leading-tight` | `uppercase tracking-[0.2em]` | Stat labels (`GOALS`, `OVERALL STATS`, `OVR`) |

> **Mandatory Rule:** All numeric scores, goals, timers, and ratings MUST include the `tabular-nums` class to prevent jitter and layout shift during increments.

### 3.3 Spacing, Borders & Radius Scale `[VERIFIED]`
* **Spacing Units:** Standard Tailwind 4px increments (`p-2` = 8px, `p-4` = 16px, `p-6` = 24px, `p-8` = 32px).
* **Border Radii:**
  - Micro Badges & Pills: `rounded-md` (6px) or `rounded-lg` (8px).
  - Buttons & Inputs: `rounded-xl` (12px).
  - Standard Cards & Modals: `rounded-2xl` (16px) or `rounded-3xl` (24px).
  - Floating Indicators & Avatars: `rounded-full` (9999px).
* **Borders:**
  - Default Subtle: `border border-white/5` or `border-neutral-800`.
  - Focused / Highlighted: `border border-emerald-500/20` or `border-emerald-500/40`.
  - Active Streak: `border border-orange-500/80`.
* **Elevations & Glows:**
  - On-Fire: `shadow-[0_0_15px_rgba(249,115,22,0.4)]`.
  - Diamond Manager: `shadow-[0_0_20px_rgba(34,211,238,0.6)]`.
  - Floating Bottom Bar: `shadow-[0_-4px_20px_rgba(0,0,0,0.5)]`.

---

## 4. Reusable Components Specification

### 4.1 Statistic & Metric Cards `[VERIFIED]`
* **Purpose:** High-density summary cards showing seasonal goals, match count, or averages.
* **Structure:**
  ```tsx
  <div className="bg-[#051410] border border-emerald-500/20 rounded-3xl p-5 sm:p-8 relative overflow-hidden group hover:border-emerald-500/35 transition-all duration-300">
    {/* Decorative radial gradients & ring */}
    <div className="relative z-10">
      <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em] mb-1">{LABEL}</h3>
      <div className="text-3xl sm:text-4xl font-black text-white mb-1 tabular-nums">{VALUE}</div>
      <div className="text-[11px] sm:text-xs text-neutral-400">{SUBTITLE}</div>
    </div>
  </div>
  ```

### 4.2 Buttons & Interactive Elements

| Variant | Classes & Specs | States |
| :--- | :--- | :--- |
| **Primary CTA** `[VERIFIED]` | `bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-bold px-4 py-2.5 rounded-xl shadow-lg` | Active: `scale-95`, Focus: `ring-2 ring-emerald-500/50` |
| **Pitch Goal Action** `[VERIFIED]` | Large touch target (min height 52px), `bg-neutral-900 border border-neutral-800 hover:border-emerald-500/40 active:scale-95 text-white font-bold` | Includes goal icon ⚽ + Player name |
| **Secondary / Ghost** `[VERIFIED]` | `bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white px-3 py-2 rounded-xl` | Active: `scale-95` |
| **Destructive / Discard** `[VERIFIED]` | `text-red-400 hover:bg-red-950/40 border border-red-500/20 px-3 py-2 rounded-xl` | Active: `scale-95` |
| **Icon Button** `[VERIFIED]` | Size 36x36px (`w-9 h-9`) or 44x44px (`w-11 h-11`), `rounded-full bg-neutral-800 border border-neutral-700/80 flex items-center justify-center` | Focus-visible ring, active scale 95 |

### 4.3 Badges & Rating Tags

#### Player Rating Badge (`PlayerRatingBadge.tsx`) `[VERIFIED]`
* **Inline Variant:** Formatted rating string with color coding.
* **Boxed Variant:** `px-2 py-1 rounded border backdrop-blur-sm text-xs font-black tracking-widest tabular-nums flex items-center`.
  - **Elite (90+ OVR):** Amber text (`text-amber-300`), border `border-amber-400/50`, gold glow `shadow-[0_0_10px_rgba(251,191,36,0.3)]`.
  - **Gold (80-89 OVR):** Amber-500 text, border `border-amber-500/30 bg-amber-500/10`.
  - **Silver (75-79 OVR):** Neutral-300 text, border `border-neutral-400/30 bg-neutral-400/10`.
  - **Bronze (<75 OVR):** Orange-700 text, border `border-orange-800/30 bg-orange-800/10`.

#### Status Badges `[VERIFIED]`
* **IN_PROGRESS / LIVE:** `bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest`.
* **COMPLETED:** `bg-neutral-800 text-neutral-400 border border-neutral-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest`.
* **SCHEDULED:** `bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest`.

### 4.4 Tables & Leaderboard Rows `[VERIFIED]`
* **Purpose:** Dense display of ranked competitors.
* **Specifications:**
  - Row height: `min-h-[72px] sm:min-h-[88px]`.
  - Background: `bg-neutral-950 border border-white/5` with hover transition `hover:border-white/20`.
  - Player image backplate: Embedded with `opacity-40 group-hover:scale-105 group-hover:opacity-60 transition-all duration-500` plus horizontal gradient mask.
  - Score presentation: Goals and assists rendered as `GOALS / ASSISTS` (e.g. `14 / 8` with `/` in neutral-600).

### 4.5 Modals & Player Detail Profiles `[VERIFIED]`
* Stacking Order: Backdrop and modal container use `z-[60]` (higher than bottom navigation dock `z-50`) to ensure navigation bars never overlap modal content.
* Mobile Layout: Full-screen overlay `w-full h-[100dvh] rounded-none border-0` with safe-area padding (`pt-[max(0.75rem,env(safe-area-inset-top))]` and `pb-[max(2rem,env(safe-area-inset-bottom))]`).
* Desktop Layout: Centered floating card `sm:max-w-xl sm:rounded-3xl sm:border sm:max-h-[88dvh] sm:h-auto shadow-2xl`.
* Structure:
  - Pinned Top Bar: Position/Rank badges + always-accessible close button (`X`, 40x40px touch target).
  - Pinned Identity Section: Avatar thumbnail + Username + OVR badge + Full Name pinned at top with subtle frosted glass separator.
  - Scrollable Stats & Actions: Single natural scroll container with responsive grid (`grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3`), avoiding nested scroll containers.
* Background Scroll Lock: Body scroll is automatically locked (`document.body.style.overflow = 'hidden'`) while modal is active.

### 4.6 Loading Skeletons & Shimmers `[VERIFIED]`
All data-fetching screens must render a matching skeleton rather than generic spinners:
* Base class: `skeleton-shimmer` with CSS-animated gradient sweep (duration: 1.8s infinite).
* Background color: `rgba(255, 255, 255, 0.04)`.
* Gradient sweep: `linear-gradient(90deg, rgba(255,255,255,0) 0, rgba(255,255,255,0.03) 20%, rgba(255,255,255,0.08) 60%, rgba(255,255,255,0))`.

---

## 5. Page-Specific Conventions

### 5.1 Home / Dashboard (`/`)
* **Purpose:** Instant overview of group activity, current season progress, and quick jump to active pitch.
* **Layout Grid:**
  - Header: Welcome greeting with Rules and Notification setup quick links.
  - Top Deck: 2-column or 1-column responsive card comparing Current Season vs. Overall Stats.
  - Matches Grid: Split upcoming and recently completed session preview cards.

### 5.2 Matches (`/matches` & `/matches/:id`)
* **Matches List (`/matches`):**
  - Grouped into "Upcoming / In Progress" and "Completed History".
  - Quick actions: "Start Match" button navigates directly to the live pitch engine.
* **Active Match Engine (`/matches/:id`):**
  - **Most critical screen in the app.**
  - Full-width real-time scoreboard (Team A vs Team B).
  - Big 1-tap Goal Logger: Grid of active outfield players. Tapping a player immediately stages/records a goal.
  - Queue / Rotation Engine: Displays current waiting teams (Winner Stays mode) and automatic rotation queue.
  - Quick Undo (`Undo2`) floating button for accidental goal taps.

### 5.3 Players (`/players`)
* **Purpose:** Roster management, player profile inspection, and rating breakdown.
* **Layout:**
  - FIFA Ultimate Team style 3:4 aspect ratio cards (`aspect-[3/4]`).
  - Interactive 3D tilt on pointer hover (powered by Framer Motion `useMotionValue` and `useTransform`).
  - Expandable modal displaying lifetime games, win rate, awards breakdown (MotM, Best Defender, Best GK), and edit capabilities for admins.

### 5.4 Leaderboard / Ranking (`/leaderboard`)
* **Purpose:** Monthly competition ladder.
* **Layout:**
  - Month/Season selector dropdown at top right.
  - Column Legend: `Rank & Player` on left, `Goals / Assists` on right.
  - Visual distinction for Rank 1 (Gold styling) and "On Fire" players (orange border + glow).

### 5.5 Awards / Hall of Fame (`/seasons`)
* **Purpose:** Sealed historical seasons and honor roll.
* **Layout:**
  - Podium layout (🥇, 🥈, 🥉) for Top Scorers and Top Playmakers.
  - Dedicated honor tiles for Best Defender, Best Goalkeeper, and Season MVP.

---

## 6. Mobile-First Guidelines & Viewport Standards

StatTracker is designed to be operated at the pitch with one hand while standing or observing the match.

### 6.1 Viewport Targets
Test and validate all UI flows against these representative viewports:
* **Compact Android:** 360 × 800 px (Galaxy A series, base Android).
* **Standard iOS:** 390 × 844 px (iPhone 13 / 14 / 15 / 16).
* **Large Android / Flagship:** 412 × 915 px (Pixel 7 / 8 / 9, Galaxy S24+).
* **Desktop Breakpoint:** `md: 768px` and `lg: 1024px`.

### 6.2 Mobile Bottom Navigation & Safe Areas (Bottom Dock) `[VERIFIED]`
* Mobile navigation touches the bottom edge of the viewport:
  `fixed bottom-0 inset-x-0 z-50 flex justify-center pointer-events-none md:hidden`
* Outer dock container: `pointer-events-auto w-full max-w-lg bg-neutral-900/95 backdrop-blur-2xl border-t border-x sm:border-x border-white/10 rounded-t-[22px] shadow-[0_-6px_24px_rgba(0,0,0,0.55)] px-1.5 pt-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] flex items-center justify-between ring-1 ring-black/40`.
* Safe-area handling:
  - Container background touches the bottom edge without floating space or gap underneath.
  - Icons and labels use `pb-[max(0.45rem,env(safe-area-inset-bottom))]` ensuring comfort above Android gesture lines, 3-button bars, and iOS home indicators.
* Active Destination Feedback:
  - Sliding tab indicator background: `motion.div` (`layoutId="mobile-nav-dock-pill"`) with `bg-primary-950/70 border border-primary-500/30 rounded-xl shadow-[0_0_12px_rgba(16,185,129,0.18)]`.
  - Icon: Scales subtly to `scale-105` with emerald styling `text-primary-400`.
  - Label: Bold emerald font `text-primary-300 font-bold`.
  - Clean profile: Accent dots under active tab labels are intentionally omitted to maximize vertical space and eliminate visual crowding.
* Floating Action & Scroll Clearance:
  - Scrollable container in `AppLayout.tsx`: `pb-28 sm:pb-32 md:pb-8`.
  - Sticky/floating actions (e.g. "New Match" button): Positioned at `bottom-[calc(5rem+env(safe-area-inset-bottom))]` to hover cleanly above the dock's rounded top.

### 6.3 Seamless Top Header Specification `[VERIFIED]`
* Mobile header: `h-14 sm:h-16 shrink-0 flex items-center justify-between md:justify-end px-4 sm:px-6 md:px-8 sticky top-0 z-40 bg-neutral-950/85 backdrop-blur-md md:bg-transparent`.
* Seamless surface: Blends directly into the `bg-neutral-950` page canvas with zero divider lines, zero bottom borders, and zero harsh drop shadows.
* Mobile brand lockup: Logo container (`w-8 h-8 rounded-xl bg-neutral-900 border border-white/10 p-1 flex items-center justify-center`) + bold title `text-base sm:text-lg font-black text-white tracking-tight`.
* Profile avatar trigger: `w-9 h-9 rounded-full bg-neutral-800/90 border border-white/10 hover:border-primary-500/50 focus-visible:ring-primary-500/50`.

### 6.4 Touch Targets & One-Hand Optimization `[VERIFIED]`
* Minimum interactive target dimension: **44 × 44 pt** (WCAG 2.5.5). Tab buttons in floating dock have `min-h-[42px] py-1` within flex container achieving compliant touch bounds.
* Primary action buttons in live match: Minimum height 52px with large fonts (`text-base font-bold`).
* Taps include active feedback: `active:scale-95` on buttons and tabs.

### 6.5 Desktop Adaptations
* Side navigation bar transforms from bottom dock to a 256px (`w-64`) fixed sidebar on `md:` screens.
* The desktop header remains transparent and aligns to the top right without duplicate mobile titles.

---

## 7. Motion, Animation & Feedback Rules

Animations in StatTracker must provide immediate tactile feedback without delaying pitch logging.

### 7.1 Motion Conventions `[VERIFIED]`
* **Page Transitions:** Fade and micro-slide (`opacity: 0, y: 6` to `opacity: 1, y: 0`, duration 180ms easeOut).
* **List Staggering:** Leaderboard rows stagger by 100ms with spring physics (`stiffness: 300, damping: 24`).
* **Active Goal Particle / Toast:** Floats up 40px and fades over 1.5s (`--animate-float-up`).
* **Active Match Event Overlay:** Brief 3.5-second banner overlay for goal or team rotation announcements before auto-dismissal.

### 7.2 Accessibility & Reduced Motion `[VERIFIED]`
The system strictly honors the user's OS-level motion preference:
```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 8. Performance, Caching & Data Integrity Rules

### 8.1 TanStack Query Conventions `[VERIFIED]`
* Global query caching is configured in `frontend/src/App.tsx`:
  - `staleTime: 1000 * 60 * 5` (5 minutes).
  - `refetchOnWindowFocus: false` (avoids unnecessary re-fetching during pitch usage).
* In live matches (`ActiveMatch.tsx`), Supabase Realtime handles event broadcasting instead of rapid polling.

### 8.2 Image Optimization Standards `[VERIFIED]`
* Client-side compression via `browser-image-compression` runs before uploading player profile photos:
  - Max file size: 0.5 MB (`maxSizeMB: 0.5`).
  - Max dimension: 400 × 400 px (`maxWidthOrHeight: 400`).
* All `<img>` tags must specify `loading="lazy"` and `decoding="async"`.

### 8.3 Avoiding Re-renders & Layout Shifts `[VERIFIED]`
* Numeric metrics must use fixed tabular font figures (`tabular-nums`).
* Container aspect ratios must be explicitly reserved (e.g. `aspect-[3/4]` on player cards) to prevent layout jumps as avatars load.

---

## 9. Gaps, Inconsistencies & Proposed Upgrades

During thorough inspection of the repository, the following inconsistencies and architectural gaps were identified:

### Inconsistencies Discovered `[INCONSISTENCY]`
1. **Ad-hoc Hex Codes vs Tailwind Tokens:**
   - Multiple components hardcode `#051410` (custom dark pitch green) instead of referencing a centralized Tailwind theme color (e.g., `bg-pitch-950`).
2. **Alert and Confirmation Prompts:**
   - Destructive actions (like deleting players or deleting match sessions) currently invoke native browser `window.confirm()` and `alert()` modals instead of a styled StatTracker dialog component.
3. **Ghost Skeleton Inconsistencies:**
   - Each page defines its own private `*Skeleton` component (`DashboardSkeleton`, `LeaderboardSkeleton`, `MatchesSkeleton`). While they use `.skeleton-shimmer`, spacing and border radii differ slightly between pages.
4. **Legacy CSS Rules in `App.css`:**
   - `App.css` contains leftover template rules (`#center`, `#next-steps`, `.hero`, `.vite`) from initial Vite scaffolding that are no longer used by the application.

### Proposed Standards `[PROPOSED]`
1. **Adopt Centralized Surface Token:**
   - Add `pitch: { 900: '#071c17', 950: '#051410' }` to Tailwind theme so `bg-[#051410]` becomes `bg-pitch-950`.
2. **Unified Confirmation Dialog:**
   - Create a reusable `<ConfirmModal>` component styled with `bg-neutral-900 border border-neutral-800 rounded-3xl` replacing browser alerts.
3. **Toast Notification System:**
   - Replace native `alert()` errors in `ActiveMatch` and `Players` with an accessible non-blocking toast stack (e.g., Sonner or Framer Motion toast).
4. **App.css Pruning:**
   - Deprecate and remove obsolete scaffolding classes from `App.css`.

---

## 10. Contribution, Review & Maintenance Checklist

Before submitting or merging any UI changes to StatTracker, verify your implementation against this checklist:

### UI Developer Checklist
- [ ] **Contrast Check:** Does text over player photography maintain contrast via gradients (`from-black/80` or `from-neutral-950`)?
- [ ] **Numeric Stability:** Do numbers, clocks, and score counters use `tabular-nums`?
- [ ] **Mobile Validation:** Has the interface been tested at 360px and 390px widths?
- [ ] **Touch Target Size:** Are interactive buttons at least 44 × 44 px in dimension?
- [ ] **Bottom Nav Clearance:** Does page content have adequate bottom padding (`pb-24` or `pb-32`) to clear the mobile navigation bar?
- [ ] **Motion Sensitivity:** Does the component respect `prefers-reduced-motion`?
- [ ] **Image Optimization:** Are photos configured with `loading="lazy"` and `decoding="async"`?
- [ ] **Status Conventions:** Did you avoid introducing arbitrary hex colors outside the established emerald/amber/orange/neutral palette?
- [ ] **Build Check:** Did `npm run build` (`tsc -b && vite build`) and `oxlint` pass without errors?
