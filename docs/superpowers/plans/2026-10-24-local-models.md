# Optional on-device models implementation plan

**Goal:** Deliver the user's approved lightweight/stronger local model flow, with no provider daily message quota, optional explicit downloads, and honest device requirements.

**Architecture:** Keep the existing WebLLM worker and bilingual interface. Use pinned Qwen3 1.7B and 4B packages compatible with WebLLM 0.2.86. Add a first-visit welcome dialog that opens model selection, and expose the current model beside the composer. Preserve all cloud/tool permissions.

**Approved brief:** First entry offers Download or Later. Download opens model selection; selecting a model alone downloads nothing. Display approximate download size and GPU memory before confirmation. Show preparation progress and cancellation, select only after successful preparation, and show failure without claiming readiness. No paid infrastructure or new provider is introduced.

**Approaches:** Browser execution fits the approved no-server/no-budget constraint. Server hosting would avoid client downloads but needs funded compute; a separately installed app would change the requested web flow.

## Tasks

- [x] Add regression checks for the upgraded model catalog and the first-entry/skip/download flow; observe failures.
- [x] Upgrade and pin the two local models; expose a responsive model selector and optional first-entry welcome with size/memory/privacy information.
- [x] Verify cancel, retry, successful preparation and unsupported-device behavior without uploading conversation text; run existing AI tests and build.
- [ ] Review the diff, save user-facing preview/patch, and create a reviewable PR if connected access permits. Report actual inference separately from mock-worker verification.

## Review focus

No download before confirmation; Later/Escape does not download; errors never show Ready; larger model has verified WASM URL; unsupported browsers get clear guidance; mobile/RTL dialogs fit; cloud/tool permissions remain enforced.

## Verification

52 AI tests passed. Browser onboarding passed at 360/390/768/1280px, including persistent choice after reload, first-visit skip, explicit download, progress/cancel, failure/retry, and unsupported-device guidance (mock worker). Existing frontend/backend integration and reply/stop suites passed. Worker build, static AI checks, and validation of 48 documents passed. A fresh reviewer identified retired-model cache cleanup and accessibility disclosure; both were fixed. Actual GPU inference and full model-weight downloads were not run. Pinned manifests/configs and WASM URLs returned HTTP 200.
