# FORM-O v3.1 Design Guidelines

This document outlines the design system for FORM-O v3.1, focusing on the refined HSL token-based approach and unified component architecture.

## 🎨 Color System (HSL Tokens)

We use HSL tokens in `global.css` to manage colors. This allows for easy variant generation (e.g., using `color-mix`).

| Token | Description | Base Value |
|-------|-------------|------------|
| `--primary` | Main accent color | `hsl(217, 91%, 60%)` (Vibrant Blue) |
| `--accent` | Secondary accent | `hsl(14, 100%, 63%)` (Coral) |
| `--bg` | Application background | `hsl(210, 40%, 98%)` |
| `--bg-surface` | Card/Surface background | `hsl(0, 0%, 100%)` |
| `--border` | Default border color | `hsl(214, 32%, 91%)` |
| `--text` | Primary text | `hsl(222, 47%, 11%)` |
| `--text-muted`| Subtle text | `hsl(215, 16%, 47%)` |

### Usage Tip: Color Mixing
To create subtle backgrounds or borders based on these colors:
```css
background: color-mix(in srgb, var(--primary) 10%, transparent);
```

## 🏗️ Unified Components (`components.css`)

Always prefer classes from `components.css` over local component styles for common UI patterns.

### Containers & Cards
- `.planning-system-container`: Main module wrapper with responsive padding.
- `.planning-system-card`: Premium glassmorphism card with standard shadow and radius.
- `.planning-system-header`: Standardized header for planning modules.

### Status Indicators
- `.status-badge`: Base class for badges.
- `.status-completed`, `.status-pending`, `.status-error`: Standard color variants.
- `.type-badge`: Compact tags for item types (LS, FICTURE, CH).

### Dashboard Elements
- `.stat-badge`: Compact rounded boxes for numerical data.
- `.meta-item`: Small descriptive text for metadata (IPOs, dates).
- `.action-checkbox`: Interactive container for toggles/checkboxes.

## ⌨️ Typography

- **Headings**: `Outfit` or `Inter` with weight `700`+.
- **Body**: `Inter` with weight `450`-`500` for better readability.
- **Monospace**: `JetBrains Mono` or standard `monospace` for IDs and code.

## 🛠️ Best Practices

1. **Tokens First**: Never hardcode hex/rgb values. Use `rgb(var(--primary-rgb))` or `var(--primary)`.
2. **Glassmorphism**: Use `var(--glass)` for background-blur effects on overlays.
3. **Spacing**: Use `rem` for layout and `px` for micro-adjustments if necessary.
4. **Icons**: Use `Lucide-React` with `stroke-width={2}` or `2.5` for a premium look.
5. **Transitions**: Standard transition is `0.3s cubic-bezier(0.4, 0, 0.2, 1)`.
