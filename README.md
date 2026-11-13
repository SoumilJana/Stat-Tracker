# StatTracker [![Version](https://img.shields.io/badge/version-v6.8-10b981.svg?style=flat-square)](#)

A high-performance football & futsal match tracking Progressive Web App (PWA) built with **React 19**, **Supabase**, **Tailwind CSS v4**, and **Framer Motion**.

---

## ⚡ Features

- **Game Management & UPI Payments:** Match scheduling, 10-player threshold auto-unlock, waitlist management (auto 15-player Winner Stays promotion), direct UPI payments with dynamic pre-filled vector QR codes, cash reconciliation, and dynamic WhatsApp summaries.
- **Live Active Match Center:** Pitch board rotation, single-screen referee control center, 7v7 Special mode, Own Goals handling, and integrated Winner Stays match clock with referee haptics and audio whistles.
- **Smart Sharing:** Instant WhatsApp-formatted lineup and post-match scorecard sharing with deep link generation.
- **Player Profiles & FIFA-Style Tilt Cards:** 3D interactive player cards, career stats, goals, assists, radar ratings, and awards.
- **Leaderboards & Seasons:** Monthly and all-time rankings, top scorers, assisters, MOTM awards, and Hall of Fame.
- **PWA Ready:** Installable standalone app with offline event queueing and native mobile viewport optimization.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Lucide React
- **Backend / Realtime:** Supabase (PostgreSQL, Realtime Broadcast, Row-Level Security, Edge Functions)
- **State & Data:** TanStack React Query v5
- **PWA & Offline:** `vite-plugin-pwa`, Service Worker, Screen Wake Lock API, Vibration API

---

## 📌 Release & Versioning Policy

StatTracker uses a two-tier **Major.Minor (`X.Y`)** versioning system:
- **Minor Version (`Y`):** Incremented for small upgrades, UI/UX polish, micro-optimizations, and bugfixes (e.g. `2.3` → `2.4`).
- **Major Version (`X`):** Incremented whenever a major feature is added, an architectural overhaul occurs, or a core module is replaced/removed, resetting the minor version to `0` (e.g. `2.x` → `3.0`).
- **Source of Truth:** Defined in `frontend/src/version.ts`, displayed live in the app header (desktop sidebar and mobile top bar) and synced with this README.
- **Changelog:** Every release adds a short entry to the [Changelog](#-changelog) below, listing what changed in that version.

---

## 📝 Changelog

### v6.8
- Winner Stays (3/4 teams) uses the same side-by-side board: both teams on the pitch at once, scores on top, tap a name to record a goal.
- The timer is now a slim strip (countdown, Start/Pause, Reset, settings), and the separate score box and team tabs are gone.
- A "Next up" row shows the waiting teams in order, with "No Goal / Time Up" (now confirmed first) and "Undo last goal" under the board.
- Teams keep their side of the screen when they rotate, so the winner no longer jumps to the left.

### v6.7
- Live match screen is compact: both teams sit side by side, each with its score on top. The separate score box is gone.
- Tap a player's name to record a goal. The assist / own goal prompt opens as before.
- Goals, assists and own goals show next to each name, and a large "Undo last goal" button sits under the board.
- Works the same for 7v7 (substitutes under a divider); players see the board read-only.

### v6.6
- The app updates itself: it checks for a new version when reopened and every 30 minutes, then reloads on its own.
- Updates wait while you're on New Match or a live match, and load once you leave the screen.
- Clearer WhatsApp message: date, time, place and fee up top, players grouped by Paid, Cash, Checking and Not paid, plus the waiting list.

### v6.5
- Admins can tap a player's payment badge to change their status: Paid (UPI), Paid (Cash), Cash Due, Pay Later or Not paid.
- Fixes old cash payments that showed as Paid. Every change is recorded in the audit log.

### v6.4
- **Convert to Game:** once 10 players are IN, the admin can send the squad straight to New Match to pick teams.
- New Match loads the squad and picks the team count from its size (10 → 2 teams, 15 → 3 teams Winner Stays). "Show all players" adds people outside the squad.
- Players can tap OUT after the roster is locked, until kickoff. Admins can remove a player.
- Anyone who drops out is refunded automatically, the next player on the waiting list moves up, and admins get a notification.

### v6.3
- Cash now shows as **Cash Due** until the admin confirms the money was received on game day.
- Cash players can switch to UPI with "Pay with UPI Instead".

### v6.2
- Players with an unconfirmed payment can pay again or change their payment method.

### v6.1
- UPI "Pay Now" shares the QR code to the payment app.

### v6.0
- Weekly game schedule.
- Push notifications for payments and roster changes.
- Payment privacy, plus automated CI checks and releases.

### v5.4
- Squad order puts paid players first, then those awaiting confirmation, then everyone else.
- A game that reaches 15 players stays at 15, so a dropout no longer bumps paid players to the waiting list.

### v5.3
- Admins can confirm their own payments and enlist several players at once.

### v5.2
- UPI payments can go to more than one recipient.

### v5.1
- Admins can add players to the roster directly.

### v5.0
- Game Management and UPI payment tracking.

### v4.0
- The Drafts page is replaced by the Payments page.
