# Voiceover Builder Service (`vo.built.at`)

This repository hosts the **Voiceover Builder Tool**, a dedicated service within the **Built.at** ecosystem. It provides the tools for users ("Builders") to manage their voiceover portfolios and for "Buyers" to view them.

## Core Features
*   **Admin Dashboard**: Manage clips, projects, studio gear, and site settings.
*   **Embeddable Player**: A high-performance audio player for portfolios.
*   **Public Profiles**: User-specific landing pages (e.g., `vo.built.at/u/username`).

## Ecosystem Context
This service is designed to work in tandem with the main [Built.at](https://built.at) marketplace platform.
*   **Built.at**: The storefront and discovery hub.
*   **vo.built.at**: This tool (The actual SaaS product).

## Tech Stack
*   React + Vite
*   TypeScript
*   TailwindCSS
*   Supabase (Database, Auth, Storage)

## Development
```bash
npm install
npm run dev
```
