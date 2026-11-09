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

## 2. Practice every check locally

Run these commands in PowerShell from the repository root. Each row matches one CI or nightly check, so you can see which failure belongs to which layer.

| Check | What it verifies | Local command |
| --- | --- | --- |
| Unit | GST calculations in `tests/cart.test.js` | `npm run test:unit` |
| Integration | API behavior with a real MongoDB in `tests/api.test.js` | `docker compose up -d mongo`, then `npm run test:integration` |
| Dependency audit | Shipped npm dependencies | `npm audit --omit=dev --audit-level=moderate` |
| Trivy scan | High or critical file vulnerabilities and secrets | Docker command below |
| Image build | The production Dockerfile can build | `docker build --tag shopping-cart:ci .` |
| API smoke | Add, view, checkout, and empty cart over HTTP | Start the app, then `npm run test:smoke` |
| Load | 100 separate users add and check out | Start the app, then run the k6 Docker command below |

First run `npm ci` to install the test dependencies. `npm test` runs both Jest suites together. The integration test creates and removes its own temporary database; MongoDB must be running for it. The audit command intentionally checks production dependencies; `npm audit` also reports development dependencies.

To run the Trivy scan without installing Trivy locally:

```powershell
docker run --rm --volume "${PWD}:/project" aquasec/trivy:latest fs --scanners vuln,secret --severity HIGH,CRITICAL --exit-code 1 --skip-dirs node_modules /project
```

To run the HTTP and load checks against the local app:

```powershell
docker compose up -d --build
$env:STAGING_URL = 'http://127.0.0.1:3000'
npm run test:smoke
docker run --rm --env STAGING_URL=http://host.docker.internal:3000 --volume "${PWD}:/work" --workdir /work grafana/k6 run tests/checkout-load.js
```

The k6 check writes 100 disposable carts. Docker Desktop makes the host API reachable from the k6 container through `host.docker.internal`. To stop the local app after the exercise, run `docker compose down`.

## 3. Understand CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on branch pushes and pull requests targeting `main`, and can be started manually from the Actions tab. Unit, integration, dependency audit, Trivy scan, and image build run as separate jobs. The integration job starts its own MongoDB service container. The final `test-and-scan` job fails unless every check passes; keep it as the required branch protection check.

Push this project to GitHub, open a pull request, and inspect the named jobs in **Actions → CI**. To make a failed check block merging, configure a `main` branch ruleset or branch protection rule that requires `test-and-scan`. A workflow file alone does not enforce merge protection.

## 4. Configure delivery

[`.github/workflows/cd.yml`](.github/workflows/cd.yml) runs on pushes to `main`. Its `publish` job builds the Dockerfile and publishes `ghcr.io/<owner>/<repo>:latest` and a commit SHA tag. You can inspect the published image under the repository's **Packages** section without setting up a staging host. The `deploy` job runs after publication only when the repository **Actions variable** `DEPLOY_ENABLED` is set to `true`. When you have a staging deployment webhook, set these repository **Actions secrets** before enabling deployment:

- `DEPLOY_WEBHOOK_URL`: HTTPS URL of your staging deployment webhook.
- `DEPLOY_WEBHOOK_TOKEN`: Bearer token accepted by that webhook.

The POST body is `{"image":"ghcr.io/<owner>/<repo>@sha256:<digest>"}`. Your webhook must verify the token, pull that exact image, restart the staging API, and make MongoDB available through `MONGO_URI`. If the GHCR package is private, the staging host also needs read access to it. The repository does not include a hosting provider because no target server was specified. With `DEPLOY_ENABLED` unset, CD publishes the image and skips deployment. Protect `main` and require CI before relying on this workflow for deployment.

## 5. Configure nightly staging checks

Set the repository **Actions variable** `STAGING_URL` to the base URL of the deployed API, such as `https://staging.example.com`. [`.github/workflows/nightly.yml`](.github/workflows/nightly.yml) runs every day at **2:00 AM Asia/Kolkata** and can also be started manually from the Actions tab. Its API test adds a cart, views it, checks out, and confirms the cart is empty. Its k6 test starts 100 virtual users, each with a separate cart, and checks that checkout returns the expected total. Use a staging system sized for that load; the test writes disposable cart records.

To try the API check locally while the app is running:

```sh
STAGING_URL=http://localhost:3000 node tests/nightly-api.js
```

In PowerShell, set the variable with `$env:STAGING_URL = 'http://127.0.0.1:3000'` and then run `npm run test:smoke`. The local k6 command is in section 2. PowerShell's `curl` command resolves to `Invoke-WebRequest`; its `-Headers` parameter expects a hashtable such as `@{ 'X-Cart-Id' = 'my-cart' }`.

If this directory is not yet a Git repository, run `git init -b main`, add and commit the files, create a GitHub repository, and push `main`. After that, create feature branches for the CI exercise.

## Suggested learning sequence

1. Run the app and tests locally. Change the GST rate in `src/cart.js` and see the unit test fail; restore it.
2. Push a branch and open a pull request. Change a test expectation and observe the CI check fail; restore it.
3. Configure the `main` required check. Merge a passing pull request and inspect the `publish` job and GHCR image in the CD run.
4. Connect a staging webhook, set `DEPLOY_ENABLED=true` and `STAGING_URL`, then run the nightly workflow manually before waiting for its schedule.
