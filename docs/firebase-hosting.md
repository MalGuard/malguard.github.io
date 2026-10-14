# Firebase Hosting preparation

This change prepares `MalGuard/malguard.github.io` for project **`malguard1`**,
Hosting site **`malguard`**. It does not deploy, create a preview channel, change
DNS, replace GitHub Pages, modify the public UI, or move the Vercel APIs.
The new deployment workflow has only `workflow_dispatch`; neither opening this
PR nor merging it invokes Firebase deployment. The existing Pages workflow still
deploys on `main` pushes, so merging this PR will run that existing workflow.

## Public output and routing

`firebase.json` serves only `_site`, built by the existing
`python3 tools/build-public-site.py`. No SPA rewrite, `cleanUrls` transformation,
or backend configuration is added. Existing `.html` pages, the custom `404.html`,
and `.well-known/security.txt` are preserved. HTML and release/status JSON use
`Cache-Control: no-cache`. Public files are copied without changing their bytes.
Server sources, sealed installer pieces, tests, prototypes, dependencies, Git
metadata, and authentication credentials cannot enter the Hosting output.

The existing reviewed historical password-encrypted `.7z` under `release/private`
remains part of the current public build. The active Windows x64 installer is
still served by the password-protected Vercel endpoint recorded in release JSON;
this PR changes no download URLs or architecture labels. A Firebase Hosting
deploy cannot host the repository's Vercel server functions. Do not add rewrites
to those APIs or change download CORS/allowlists without a separate review.
Existing canonical URLs continue to point to `https://malguard.github.io/`;
this prepares a Hosting destination, not a canonical-domain migration.

## Authentication: GitHub OIDC, without service-account keys

The workflow uses the pinned `google-github-actions/auth` action to exchange a
GitHub OIDC token through Google Workload Identity Federation and impersonate
`github-hosting@malguard1.iam.gserviceaccount.com`. Firebase CLI uses the resulting
Application Default Credentials. There is no `FIREBASE_TOKEN`, JSON service-account
key, Firebase GitHub integration generated key, or repository credential secret.
The action creates its temporary credential file outside `_site` and removes it
on job cleanup. `.gitignore` and Hosting ignore rules also exclude these files.

OIDC permission belongs only to the manual production job. PR validation has
`contents: read`, no environment, and no cloud authentication or deployment step.
Actions are pinned to commit SHAs. Firebase CLI and its dependency graph are
locked separately under `.github/firebase`, leaving site dependencies unchanged.

## One-time administrator setup (instructions only)

No Google IAM, Firebase, GitHub environment, variable, or DNS settings are
modified by this PR. An administrator with access to `malguard1` must complete
the setup below before the connection can be used. Run these commands from an
administrator session with the intended Google identity. They configure IAM;
they do not deploy Hosting content. Do not run `firebase init hosting:github`,
`firebase login:ci`, or `gcloud iam service-accounts keys create`.

Verify that project `malguard1` exists and that Hosting site `malguard` belongs to
it. The site ID need not equal the project ID. If either is missing or belongs to
another project, stop and resolve that separately; do not silently choose a site.

```bash
gcloud projects describe malguard1 --format='value(projectNumber)'
firebase hosting:sites:list --project malguard1
```

Create a dedicated service account and pool/provider, or inspect existing ones
and reuse them only if their policies match these restrictions. Commands using
`create` below assume the named resources do not already exist.

```bash
PROJECT_ID=malguard1
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
SERVICE_ACCOUNT=github-hosting@malguard1.iam.gserviceaccount.com

gcloud services enable iam.googleapis.com iamcredentials.googleapis.com \
  sts.googleapis.com firebasehosting.googleapis.com \
  --project="$PROJECT_ID"

gcloud iam service-accounts create github-hosting \
  --display-name='GitHub Actions: MalGuard Hosting' --project="$PROJECT_ID"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SERVICE_ACCOUNT" --role=roles/firebasehosting.admin
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SERVICE_ACCOUNT" --role=roles/serviceusage.serviceUsageConsumer

gcloud iam workload-identity-pools create malguard-github \
  --location=global --display-name='MalGuard GitHub Actions' --project="$PROJECT_ID"

gcloud iam workload-identity-pools providers create-oidc github \
  --location=global --workload-identity-pool=malguard-github \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping='google.subject=assertion.sub,attribute.repository_id=assertion.repository_id' \
  --attribute-condition="assertion.repository_id == '1354668748' && assertion.repository_owner_id == '324013805' && assertion.repository == 'MalGuard/malguard.github.io' && assertion.ref == 'refs/heads/main' && assertion.event_name == 'workflow_dispatch' && assertion.workflow_ref == 'MalGuard/malguard.github.io/.github/workflows/firebase-hosting.yml@refs/heads/main' && assertion.sub == 'repo:MalGuard/malguard.github.io:environment:firebase-production'" \
  --project="$PROJECT_ID"

gcloud iam service-accounts add-iam-policy-binding "$SERVICE_ACCOUNT" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/malguard-github/attribute.repository_id/1354668748" \
  --project="$PROJECT_ID"
```

The provider checks the immutable repository and owner IDs, repository name,
`main`, manual event, exact workflow path, and production environment subject.
Forks, PR events, branch runs, and unrelated workflows do not satisfy it. Keep
the pool dedicated: a second, weaker provider in the same pool could bypass the
provider's restrictions when using this principal-set binding. The service account
gets Hosting administration and service usage only, not Owner/Editor, Functions,
Firestore, Storage, or a project-wide Service Account Token Creator grant.
`roles/firebasehosting.admin` is project-scoped and can administer other Hosting
sites in `malguard1`; the site restriction in this PR is enforced by the checked
configuration and workflow, not by a claim of per-site IAM isolation.

Before setting the enablement variable, create GitHub environment
**`firebase-production`** in this repository and configure:

- Deployment branch policy allowing only the exact `main` branch, with no tags.
- Required reviewers, prevent self-review, and disallow administrator bypass.
- Environment variables (identifiers, not credential secrets):
  - `FIREBASE_WIF_PROVIDER` = `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/malguard-github/providers/github`
  - `FIREBASE_SERVICE_ACCOUNT` = `github-hosting@malguard1.iam.gserviceaccount.com`
  - Leave `FIREBASE_HOSTING_ENABLED` unset until a future deployment is authorized;
    set it to `true` only after IAM and environment protection have been checked.

Replace `PROJECT_NUMBER` with the numeric project number returned by Google;
`malguard1` is a project ID, not a project number. The workflow fails before
authentication if enablement/provider/service-account configuration is missing.
GitHub may otherwise auto-create an unprotected environment on first use; create
and protect it in advance. Ensure branch protection and code review cover changes
to these workflows/configuration before granting the provider access.

## Verification without deployment

```bash
npm ci --prefix .github/firebase --ignore-scripts --no-audit --no-fund
python3 tests/validate-trust.py
python3 tools/build-public-site.py
node tests/firebase-hosting.test.mjs
.github/firebase/node_modules/.bin/firebase --version
.github/firebase/node_modules/.bin/firebase emulators:exec \
  --only hosting --project demo-malguard1 --config firebase.json \
  --non-interactive 'node tests/firebase-hosting-emulator.mjs'
```

The new PR check runs build, configuration, workflow safety, and public-artifact
tests without a Google identity or any Firebase mutation. Negative tests reject
wrong projects/sites, repository-root publishing, SPA rewrites, automatic triggers,
weakened guards, credential leakage, and server payloads. Artifact verification
compares every shipped file with its source bytes and requires all reviewed pages.
The Hosting emulator uses a `demo-` project and checks localhost routes, MIME types,
cache headers, `.well-known`, and custom 404s without accessing production.
Existing site and browser checks remain enabled. A green offline check establishes
repository readiness; it does not prove that Google IAM or remote site ownership
has been configured.

## Future deployment (not authorized by this preparation)

After a separate deployment decision, reviewed merge, successful required checks,
and administrator setup, select **Deploy Firebase Hosting manually**, choose
`main`, enter `malguard1/malguard`, and obtain the production environment review.
Only then does the workflow run:

```bash
.github/firebase/node_modules/.bin/firebase deploy \
  --only hosting --project malguard1 --config firebase.json --non-interactive
```

There is one Hosting configuration, whose explicit `site` is `malguard`; no other
Firebase resource is selected. Treat this command as a live production write,
not a test or dry run. Do not dispatch it for this PR. For the first later deploy,
verify the reported site/project, pages and asset MIME types, `.well-known`, custom
404, mobile/iPhone/tablet/desktop runtime, and the separate password download flow.
Do not rotate canonical URLs or move DNS as part of this workflow. Disable the
enablement variable to stop future runs; revoke the WIF impersonation binding if
access must be removed. Use Firebase Hosting release history for a separately
authorized rollback, without service-account keys.

References: [GitHub OIDC with Google Cloud](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-google-cloud-platform),
[Google authentication action](https://github.com/google-github-actions/auth),
[Firebase CLI CI authentication](https://firebase.google.com/docs/cli#cli-ci-systems),
[Firebase Hosting configuration](https://firebase.google.com/docs/hosting/full-config).
