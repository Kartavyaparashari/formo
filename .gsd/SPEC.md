# SPEC.md — Project Specification

> **Status**: `FINALIZED`

## Vision
Transform Formo from a functional internal PPC tool into a premium, world-class SaaS product. The design will follow a clean, modern "Apple-style" light interface with subtle glassmorphism, high-end typography, and smooth interactions, while maintaining the professional, high-density needs of industrial production planning.

## Goals
1. **Visual Excellence**: Implement a cohesive design system inspired by Linear/Stripe/Vercel (refined spacing, professional color palette, Inter/Outfit typography).
2. **Hero Experience**: Modernize the `PnlPlanning` dashboard to be the centerpiece of the application.
3. **Data Density with Clarity**: Redesign tables and forms to maintain high density without feeling cluttered using smart hierarchy, sticky headers, and subtle borders.
4. **Dynamic Interaction**: Add micro-animations (Framer Motion) and smooth transitions for a "living" UI feel.

## Non-Goals (Out of Scope)
- Complete backend rewrite (Supabase integration stays as is).
- New functional modules beyond aesthetic/UX improvements.
- Support for ancient browsers/IE.

## Users
Production Planning & Control (PPC) professionals who need high-density data viewing and fast, intuitive sorting/planning workflows.

## Constraints
- **Light Mode Primary**: Focus on a premium light interface.
- **Data Density**: Must handle large tables (IPO data) without losing readability.
- **No Tailwind (unless requested)**: Use Vanilla CSS or a structured methodology (as per developer guidelines).

## Success Criteria
- [ ] Unified Design System (CSS Variables/Tokens) implemented.
- [ ] `PnlPlanning` module fully redesigned with premium aesthetics.
- [ ] Sticky headers and responsive, scrollable tables in all planning modules.
- [ ] "Glassmorphic" subtle effects applied to navigation and overlays.
- [ ] Smooth Framer Motion transitions between modules.
