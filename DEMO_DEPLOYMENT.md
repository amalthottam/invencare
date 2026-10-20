# InvenCare buyer demo deployment

This repository is configured for a static Netlify demo build. The demo uses
sample inventory and transaction records saved in each visitor's browser; it
does not connect to Cognito, the application API, or a database.

## Preview locally

```bash
npm install
npm run build:demo
```

The static site is generated in `dist/spa`. For local interactive development,
use `npm run dev` and choose **Continue in offline demo mode** on the login page.

## Deploy to Netlify

1. Push this repository to a Git provider supported by Netlify.
2. In Netlify, choose **Add new site → Import an existing project** and select
   this repository.
3. Netlify reads `netlify.toml`: the build command is `npm run build:demo`, and
   the publish directory is `dist/spa`. No API keys or environment variables
   are required for the static demo.
4. Deploy, then open the generated Netlify URL and select **Continue in offline
   demo mode**.

The Netlify configuration also rewrites application routes to `index.html` so
direct links and browser refreshes work.

## Demo limitations and data safety

- This is a public, client-side demonstration, not an authenticated or secure
  application. Anyone with the URL can enter the demo.
- Do not put customer, employee, business-sensitive, or production data in the
  sample dataset or share production credentials with demo visitors.
- Visitors' edits are stored only in their own browser and are not shared with
  other visitors. **Reset demo data** in the sidebar restores the sample
  products and transactions for that browser.
- Forecast generation is illustrative only; it does not invoke AWS or a real
  forecasting model.
- The production `npm run build` and `npm start` workflows remain separate from
  this buyer demo build.
