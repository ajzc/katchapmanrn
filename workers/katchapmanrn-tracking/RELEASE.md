# katchapmanrn-tracking release

This directory is the replacement for the live worker captured as SHA-256 `39c6f399849a2018cb6dc10aa5cd629a61a138e919b91f2d85fa5382c5c36e89`. It is not deployed.

The live script returns 302 for `/book` and `/book/` to HubSpot Meetings, serves an always-on Google/HubSpot/Meta script at `/js/main.js`, and removes `#consent`. This replacement does not. `/blog`, `/blog/`, and `/blog.html` still proxy `https://katchapmanrn.pages.dev/blog` with the same header edits. Every other path, including `/book` and `/js/main.js`, is fetched from the origin unchanged.

## Order

1. Publish the Pages project that contains `book.html` and consent-gated `script.js`. Confirm `https://katchapmanrn.pages.dev/book` is the embed page and not a redirect.
2. Only then replace the worker script `katchapmanrn-tracking` with `src/index.mjs`. Do not run that deploy as part of this pull request.
3. After the worker deploy, confirm `https://katchapmanrn.com/book` is the same embed page and that `/blog` still opens the journal.

Deploying this worker first leaves apex `/book` on Pages that do not yet have `book.html`, so the current HubSpot booking redirect stops before the embed exists.

## Rollback

Redeploying the captured script restores the `/book` 302, so booking works again through HubSpot, and it also restores always-on vendor loads and banner removal. That rollback is not privacy-safe.

A privacy-safe rollback is to redeploy the previous Pages version and this same pass-through worker together only if `/book` on that Pages version is still an embed. If it is not, keep the live 302 worker until the embed is published, and do not describe that 302 worker as the privacy-safe rollback.
