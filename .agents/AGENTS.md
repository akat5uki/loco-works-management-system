# Workspace Rules

- **Production First Standard**: Always favor strict production standards over temporary or development shortcuts across all database migrations (e.g. Alembic migrations), code architecture, security, and deployments.
- **Open Source First Standard**: Always favor free and open-source tools, software, libraries, and services across the entire web application ecosystem.
- **Zero-Regression & Non-Breaking Standard**: Always ensure existing working features, database structures, and application logic remain fully functional and un-broken when implementing new changes or refactoring.
- **Responsive UI/UX Compatibility Standard**: Always ensure the frontend UI/UX is fully responsive, mobile-friendly, and perfectly adapted for all screen sizes (mobile, tablet, desktop, ultra-wide) with flexible layouts, accessible touch targets, and unclipped views.
- **Modular Architecture Standard**: Always strictly follow a clean modular architecture across backend and frontend code bases. Decompose features, endpoints, components, services, and utilities into focused, single-responsibility, reusable tiny modules.
- **Double-Guarding Security Standard**: Always provide double-guarding with standard security checks, password complexities, format validations, and authentication checks for all API endpoints: enforce validation first at the frontend (client-side UX checks) and second at the backend (API schema/controller sanitization and checks).
- **Environment Configuration Standard**: Always ensure sensitive information, connection strings, credentials, configurations, and environment-specific settings are stored in `.env` files rather than hardcoded in the codebase, and read as environment variables at runtime.
