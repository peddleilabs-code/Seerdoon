# Seerdoon AI

Seerdoon is a fashion discovery and personal-fit platform. It brings customer fit profiles, AI-assisted styling, a fashion catalogue and vendor product listings into one experience.

## Repository contents

- `src/`: React and TypeScript customer-facing application.
- `backend/`: AppDeploy backend routes, AI requests, database operations and realtime subscription helpers.
- `tests/tests.json`: documented application test scenarios.
- Root configuration: Vite, TypeScript, Tailwind CSS and PostCSS.

## Current capabilities in the source

The source includes account sign-in through AppDeploy, customer profiles and measurement history, front-and-side photo measurement estimation, editable and savable measurement profiles, an AI stylist, vendor onboarding, product listing, a shopping bag and a PayPal order-creation/approval redirect.

Photo-based measurements are estimates, not professional measurements or guaranteed garment-fit results. Customers should review and correct them before saving.

## Runtime and setup

This project was built for the AppDeploy runtime. It imports platform-provided packages `@appdeploy/client` and `@appdeploy/sdk` for authentication, API access, image handling, database access, AI services, secrets and realtime messaging. Those packages are not listed as ordinary npm dependencies here, so a plain local Vite install is not a complete standalone deployment environment.

1. Clone this repository.
2. Import or open the project in an AppDeploy workspace that provides the AppDeploy client and backend SDKs.
3. Install the package dependencies in that workspace and use its normal preview/build/deploy workflow.
4. Configure the backend secrets below before testing PayPal.
5. Sign in through the configured AppDeploy authentication flow and test with separate customer and vendor accounts.

Available Vite scripts are `npm run dev`, `npm run build` and `npm run preview`; they require the AppDeploy SDK packages and runtime configuration to be available.

## PayPal Sandbox

The backend route `POST /api/paypal/create-order` uses the PayPal Sandbox API. Add these secrets in AppDeploy project settings:

- `PAYPAL_CLIENT_ID`: PayPal Sandbox REST app client ID.
- `PAYPAL_CLIENT_SECRET`: matching PayPal Sandbox secret.

Use Sandbox credentials only while testing. Never commit credentials or access tokens.

The current implementation creates a PayPal order and returns its approval URL. It does not yet implement a server-side order-capture/verification route or complete post-payment reconciliation. An approval redirect or an order with status `created` is not proof that payment has been captured.

## AI services

The backend uses the AppDeploy AI SDK:
- `ai.extract` estimates body measurements from supplied front and side images.
- `ai.generate` produces styling recommendations using the customer's request, saved measurement context and available catalogue.

The underlying model/provider is managed by the AppDeploy AI service configuration and is not named in this source.

## Privacy and security

- Authentication is delegated to AppDeploy.
- Backend profile, measurement and product routes use the AppDeploy database service.
- The body-scan interface says uploaded images are processed for the scan and are not saved by Seerdoon in this first release. Review platform request logging and retention settings before production use.
- Review role checks, rate limits, data retention, consent and security settings before handling real customer data.
- Use HTTPS and keep payment credentials server-side.

## Test scenarios

See [tests/tests.json](tests/tests.json) for scenarios covering sign-in, measurement estimation, AI styling, vendor listings and the PayPal checkout handoff. These are specifications, not evidence that an automated test suite has passed.

## License

Released under the MIT License. See [LICENSE](LICENSE).
