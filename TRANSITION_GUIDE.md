# Ecosystem Transition Guide

This document summarizes the architectural decisions and design specifications from our planning session. Use this as your "Export" to bootstrap the new `built.at` repository.

## 1. The New Architecture: "Builder Ecosystem"

We are splitting the project into two separate repositories to ensure safety and scalability.

### Repository A: Voiceover Service (Current)
*   **Path**: `/Users/nathanpuls/Desktop/sayingthings`
*   **Domain**: `vo.built.at`
*   **Role**: The dedicated **SaaS Tool** for building voiceover sites.
*   **Status**: MVP Complete (Admin + Player). Code is "frozen" for now.

### Repository B: The Marketplace (Next)
*   **Path**: New Folder (e.g., `/Users/nathanpuls/Desktop/built.at`)
*   **Domain**: `built.at`
*   **Role**: The **Marketplace Platform**.
    *   Landing Page / Storefront
    *   Builder Profiles (Hub)
    *   Buyer Discovery
*   **Action**: You need to create this project from scratch.

---

## 2. Design System Handoff (For `built.at`)

To ensure the new Marketplace looks consistent with the existing Tool, copy these settings to your new project.

### Typography
*   **Font Family**: 'Outfit'
*   **Google Fonts Import** (Put in `index.html`):
    ```html
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    ```
*   **CSS Variable** (Put in `index.css`):
    ```css
    :root {
        --font-primary: 'Outfit', sans-serif;
    }
    body {
        font-family: var(--font-primary);
    }
    ```
*   **Tailwind Config** (`tailwind.config.js`):
    ```js
    theme: {
        extend: {
            fontFamily: {
                sans: ['var(--font-primary)', 'sans-serif'],
            },
        },
    }
    ```

### Color Palette
*   **Primary Brand Color**: Indigo 500 (`#6366f1`)
*   **Background**: Slate 50 (`#f8fafc`)
*   **Text**: Slate 800 (`#1e293b`) / Slate 600 (`#475569`)
*   **CSS Variable**:
    ```css
    :root {
        --theme-primary: #6366f1;
    }
    ```

### Key UI Patterns (Re-implement these)
*   **Glassmorphism Cards**: White background, slight transparency, border-slate-100, shadow-xl.
*   **Gradient Buttons**: Solid primary color with shadow.
*   **Fade In Animation**: Use `framer-motion` for sections appearing on scroll.

---

## 3. Next Steps Checklist

1.  [ ] **Switch Workspaces**: Open your new `built.at` folder in VS Code.
2.  [ ] **Initialize Project**: Run `npm create vite@latest . -- --template react-ts`.
3.  [ ] **Install Dependencies**: `npm install tailwindcss postcss autoprefixer lucide-react framer-motion`.
4.  [ ] **Setup Tailwind**: `npx tailwindcss init -p`.
5.  [ ] **Apply Design System**: Copy the font and color settings above.
6.  [ ] **Start Building**: Create the main Landing Page for the marketplace.
