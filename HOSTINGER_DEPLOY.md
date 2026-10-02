# Deploy the Express app to Hostinger Business

This guide deploys the Express storefront/backend. The separate Python AI service
is not included in this Node.js deployment.

## Deploy in hPanel

1. Open **Websites → Add Website → Deploy Web App** and choose GitHub or file upload.
2. For file upload, create a ZIP with the *contents* of `EcommerceFullStackProject/`
   at the ZIP root. Do not include `.env`, `.env.local`, `node_modules/`, or
   `ai_service/.venv/`.
3. Select **Express.js** (or **Other** if Express is not offered), select Node.js
   22, and use `npm install` as the build command and `npm start` as the start
   command. The entry point is `bin/www`. Hostinger supplies the listening port.
4. Add the environment variables below in the app configuration. Redeploy after
   saving changes.
5. Attach the desired domain and enable SSL in hPanel.

## Required environment variables

```text
NODE_ENV=production
MONGO_URI=<MongoDB Atlas connection string>
MONGO_DB=<database name, if not already in MONGO_URI>
SESSION_SECRET=<long random secret>
```

Set `MONGO_URI` to a reachable MongoDB service such as MongoDB Atlas. The app
does not provide a local MongoDB server on shared hosting. In Atlas, allow
connections from the Hostinger server and create a database user limited to this
database.

## Optional settings

For signup and password reset email, configure the SMTP account the app will use:

```text
SMTP_HOST=<SMTP hostname>
SMTP_PORT=587
SMTP_USER=<SMTP username>
SMTP_PASS=<SMTP password or app password>
SMTP_FROM=<sender address>
APP_BASE_URL=https://<your-domain>
```

For AI search, chat, and admin generation features, deploy `ai_service/` to a
separate Python-capable host and set:

```text
AI_SERVICE_URL=https://<your-ai-service>
```

Without that external service, the Express storefront can run, but its AI-powered
features will be unavailable. Do not set `AI_SERVICE_URL` to `localhost` unless
the AI service is running on the same server and reachable from this app.

Optional payment configuration:

```text
DEMO_PAYMENT_AUTO_CAPTURE=1
DEMO_WEBHOOK_SECRET=<long random webhook secret>
```

The included checkout integration is a demo payment flow, not a live payment
processor.

## After deployment

- Check the app's deployment/runtime logs if the app fails to start.
- Register an account, then promote it to admin from the app directory with
  `npm run make-admin -- user@example.com`, after configuring the production
  `MONGO_URI` in the command environment.
- Keep production secrets in hPanel, never in Git or the ZIP file.
