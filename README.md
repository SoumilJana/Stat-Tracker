# StatTracker [![Version](https://img.shields.io/badge/version-v5.2-10b981.svg?style=flat-square)](#)

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
