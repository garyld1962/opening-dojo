---
id: stacks/nextjs-app-router
title: Next.js 14 App Router stack
---

# Next.js 14 App Router

Reusable closed-decision fragment for projects on the Next.js 14 App
Router convention. Include in a plan via
`@closed-decisions/stacks/nextjs-app-router`.

- **Framework:** Next.js 14 App Router (not Pages Router). Source: Next.js Stable 14.x.
- **React:** React 18 with Server Components by default; mark client components explicitly with `"use client"`. Source: App Router convention.
- **Language:** TypeScript 5.x with `strict: true` in `tsconfig.json`. Source: team standard.
- **Package manager:** pnpm (see repo-delivery `## Commands` `package_manager`). Source: repo-delivery schema.
- **Routing:** file-based under `app/`; co-locate `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`. Source: App Router convention.
- **Data fetching:** prefer Server Components + direct DB/service calls; reach for `fetch` with Next.js caching only for external APIs. Source: App Router convention.
- **Route handlers:** `app/api/.../route.ts` with named method exports (`GET`, `POST`, ...). Source: App Router convention.
- **Environment variables:** `.env.local` for local only; server-only vars MUST NOT be prefixed `NEXT_PUBLIC_`. Source: Next.js env convention.
