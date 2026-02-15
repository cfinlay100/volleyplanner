# Volley

Full-stack TypeScript app with **Bun**, **Convex**, **Next.js**, **Clerk**, and **shadcn/ui**.

## Stack

- **Runtime**: Bun
- **Framework**: Next.js (App Router)
- **Database + API**: Convex
- **Auth**: Clerk
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui

## Setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Start Convex (creates project, generates types, prompts Clerk config):

   ```bash
   bunx convex dev
   ```

3. Copy env vars and fill in values:

   ```bash
   cp .env.example .env.local
   ```

4. Run the app:

   ```bash
   bun run dev
   ```

## Scripts

- `bun run dev` - Start Convex + Next.js (run Convex dev first to create project)
- `bun run build` - Build for production
- `bun run start` - Start production server
