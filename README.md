# Shopping cart CI/CD lab

An Express API backed by MongoDB. Prices are integer cents, and checkout adds 18% GST, rounded once on the cart subtotal. Each request uses `X-Cart-Id` to choose a cart; omit it for the shared `demo` cart. This is a learning project: cart IDs are not authentication, so deploy only to a disposable staging environment.

## 1. Run the application

Install Node.js 22 or newer and Docker. Then run:

```sh
docker compose up --build
```

In PowerShell, try the three endpoints:

```powershell
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/cart/add' -ContentType 'application/json' -Headers @{ 'X-Cart-Id' = 'my-cart' } -Body '{"name":"Book","priceCents":1000,"quantity":2}'
Invoke-RestMethod -Method Get -Uri 'http://localhost:3000/cart' -Headers @{ 'X-Cart-Id' = 'my-cart' }
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/checkout' -Headers @{ 'X-Cart-Id' = 'my-cart' }
```

In a Unix shell, the equivalent commands are:

```sh
curl -X POST http://localhost:3000/cart/add -H 'Content-Type: application/json' -H 'X-Cart-Id: my-cart' -d '{"name":"Book","priceCents":1000,"quantity":2}'
curl http://localhost:3000/cart -H 'X-Cart-Id: my-cart'
curl -X POST http://localhost:3000/checkout -H 'X-Cart-Id: my-cart'
```

The checkout response has `subtotalCents: 2000`, `gstCents: 360`, and `totalCents: 2360`. A second checkout returns HTTP 400 because the cart is empty.

For local development without the API container, start MongoDB with `docker compose up -d mongo`, then run `npm ci` and `npm start`. The defaults are `MONGO_URI=mongodb://127.0.0.1:27017`, `MONGO_DB=shopping_cart`, and `PORT=3000`.

## 2. Run the tests

With local MongoDB running:

```sh
npm ci
npm test
```

`tests/cart.test.js` checks GST arithmetic. `tests/api.test.js` uses a real, temporary MongoDB database to check add, view, checkout, and invalid inputs. To run only the unit tests, use `npm run test:unit`.

## 3. Understand CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on branch pushes and pull requests targeting `main`. It installs dependencies, audits shipped dependencies, scans files with Trivy for high or critical vulnerabilities and secrets, and runs all tests against a MongoDB service container. `npm audit --omit=dev` deliberately checks the dependency set installed in the production image; Jest's development dependency tree is outside this gate. Review the full development dependency report separately with `npm audit`.

Push this project to GitHub, open a pull request, and watch the **CI / test-and-scan** check. To make a failed check block merging, configure a `main` branch ruleset or branch protection rule that requires that status check. A workflow file alone does not enforce merge protection.

## 4. Configure delivery

[`.github/workflows/cd.yml`](.github/workflows/cd.yml) runs on pushes to `main`. It builds the Dockerfile, publishes `ghcr.io/<owner>/<repo>:latest` and a commit SHA tag, then sends an authenticated JSON POST to a deployment webhook. Set these repository **Actions secrets**:

- `DEPLOY_WEBHOOK_URL`: HTTPS URL of your staging deployment webhook.
- `DEPLOY_WEBHOOK_TOKEN`: Bearer token accepted by that webhook.

The POST body is `{"image":"ghcr.io/<owner>/<repo>@sha256:<digest>"}`. Your webhook must verify the token, pull that exact image, restart the staging API, and make MongoDB available through `MONGO_URI`. If the GHCR package is private, the staging host also needs read access to it. The repository does not include a hosting provider because no target server was specified; until the webhook and its secrets exist, CD stops at its configuration check. Protect `main` and require CI before relying on this workflow for deployment.

## 5. Configure nightly staging checks

Set the repository **Actions variable** `STAGING_URL` to the base URL of the deployed API, such as `https://staging.example.com`. [`.github/workflows/nightly.yml`](.github/workflows/nightly.yml) runs every day at **2:00 AM Asia/Kolkata** and can also be started manually from the Actions tab. Its API test adds a cart, views it, checks out, and confirms the cart is empty. Its k6 test starts 100 virtual users, each with a separate cart, and checks that checkout returns the expected total. Use a staging system sized for that load; the test writes disposable cart records.

To try the API check locally while the app is running:

```sh
STAGING_URL=http://localhost:3000 node tests/nightly-api.js
```

In PowerShell, set the variable with `$env:STAGING_URL = 'http://localhost:3000'` and then run `node tests/nightly-api.js`. PowerShell's `curl` command resolves to `Invoke-WebRequest`; its `-Headers` parameter expects a hashtable such as `@{ 'X-Cart-Id' = 'my-cart' }`.

If this directory is not yet a Git repository, run `git init -b main`, add and commit the files, create a GitHub repository, and push `main`. After that, create feature branches for the CI exercise.

## Suggested learning sequence

1. Run the app and tests locally. Change the GST rate in `src/cart.js` and see the unit test fail; restore it.
2. Push a branch and open a pull request. Change a test expectation and observe the CI check fail; restore it.
3. Configure the `main` required check. Merge a passing pull request and inspect the GHCR image and CD run.
4. Connect a staging webhook, set `STAGING_URL`, and run the nightly workflow manually before waiting for its schedule.
