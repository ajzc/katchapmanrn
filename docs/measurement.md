# Measurement

Shared instrumentation for every public HTML template. `measurement.js` holds the rules. `script.js` starts them after the page is built. Tags load only after Accept.

`metaPixelId` and the Google Ads fields in `CONFIG` are empty on purpose. Empty integrations do not load and are marked `unconfigured`. Do not invent IDs.

## Event coverage

| Event | When it fires | Google Analytics 4 | Meta (only if a real pixel id is set) | HubSpot |
| --- | --- | --- | --- | --- |
| `page_view` | Once per page, after Accept, including the load where they accept | `page_view` with a coarse `page_location` and title `Kat Chapman RN` | `PageView` inside `/measure-frame.html`, not the treatment URL | Analytics script records the real path |
| `contact_click` | `tel:` or `sms:` click | `method` `call` or `text` | `Contact` with no parameters | Behavioral `contact_call` or `contact_text` |
| `booking_start` | Book link or HubSpot Meetings link click | `method` `scheduler` | Custom `BookingStart` | Behavioral `booking_start` |
| `outbound_click` | Instagram, journal, or `mailto:` click | `destination` `instagram`, `blog`, or `email` | Not sent | Not sent |
| `generate_lead` | HubSpot Forms API returns success | `form_id` `consult_request` or `contact` | `Lead` with no parameters | Behavioral `lead_consult_request` or `lead_contact` |
| `booking_completed` | Embedded Meetings `postMessage` with `meetingBookSucceeded === true` from `https://meetings.hubspot.com` or `https://meetings-eu1.hubspot.com` | `method` `hubspot_meetings` | `Schedule` with no parameters | Behavioral `booking_completed` |

These do not fire:

- A book click never emits `booking_completed`, `Schedule`, or a Google Ads conversion.
- `?joined=1` and `?sent=1` never emit `generate_lead`.
- A failed form response never emits `generate_lead`.
- Meta does not load while `metaPixelId` is empty.
- Google Ads does not load while the AW id or the conversion label is empty.
- Treatment paths, titles, form text, phone numbers, and appointment details are not Google or Meta parameters.

Coarse locations sent to Google are only `https://katchapmanrn.com/` plus `about`, `pricing`, `contact`, `gallery`, `faq`, `services`, `legal`, `not_found`, or `service`. Every treatment and city URL collapses to `/service`. Journal URLs collapse to `https://blog.katchapmanrn.com/journal`.

## Consent

Choice is stored in `kcrn_consent` (`granted` or `denied`) and mirrored in `sessionStorage` for the tab. On `katchapmanrn.com` and `blog.katchapmanrn.com` the cookie is `Domain=.katchapmanrn.com`. Reject, or turning it off later, stops later events, sets Google consent to denied, asks HubSpot to revoke, removes the Meta frame, and expires measurement cookies this page can delete. It cannot erase hits already sent.

Accept grants analytics and ads storage so click measurement can attribute, and denies ad personalization. Google signals and ads personalization signals stay off. URL passthrough stays off. Ads data redaction stays on. The Google tag is configured with `send_page_view: false` and one explicit `page_view`.

## Attribution

Kept and reattached only when the value passes the allowlist: `utm_source`, `utm_medium`, `utm_campaign`, `utm_id`, `gclid`, `gbraid`, `wbraid`, `gad_source`, `gad_campaignid`, `fbclid`, `msclkid`. `utm_term` and `utm_content` are dropped. Values that look like an email, a phone number, or a treatment word are dropped. Google hits receive the Google click ids and safe `utm_*` values on the coarse URL. Meta, when configured, receives `fbclid` only on `/measure-frame.html`. Outbound journal and Meetings links gain the scrubbed parameters. After consent, HubSpot cookies `__hstc`, `__hssc`, `__hsfp`, and `hubspotutk` are copied onto those links when the cookie value is a safe token.

The Google linker is limited to `katchapmanrn.com`, `blog.katchapmanrn.com`, and `meetings.hubspot.com`, with form decoration off. Meetings pages do not run this tag, so `_gl` does not continue a GA session inside the scheduler until that page is tagged.

## Booking completion

The public site opens Meetings in a new tab. That tab does not post `meetingBookSucceeded` back to the site. The listener is installed for an embedded scheduler only. It reads the boolean and ignores every other field. Do not treat `booking_start` as a completed visit. No thank-you URL is counted, because a public URL can be opened without a booking.

## Copy for review

This is not on the privacy page. Do not publish it until the Copy Humanizer approves it.

Banner, already in the interface so the control can be reviewed:

- Measurement stays off until you choose.
- Accept allows visit and click counts.
- Accept
- Reject
- Measurement choices
- Measurement is on.
- Measurement is off.
- Privacy Policy

Proposed replacement for the privacy page section "Analytics and tracking":

The site does not run Google Analytics, HubSpot analytics, or Meta measurement until you accept. Reject leaves those tags off. The choice is stored in a cookie named kcrn_consent so it can apply on katchapmanrn.com and the journal at blog.katchapmanrn.com. You can change it later from Measurement choices.

If you accept, Google Analytics 4 receives a coarse page category, such as home, pricing, or service, plus visit and click counts. It does not receive the treatment page address, the page title, form text, or appointment details. A click on Book a visit is counted as a click. It is not counted as a completed booking. A completed booking is counted only when HubSpot confirms that a meeting was booked. A form is counted only after HubSpot accepts the submission. The words you type stay in HubSpot and are not copied to Google or Meta.

Query details such as an email address or a treatment keyword are removed from the page address before measurement runs. HubSpot analytics, after you accept, still receives the page path and the page title so the practice can see which page a visit came from. Meta measurement stays off until a Meta dataset is connected. When it is connected, it runs from a neutral page that does not include the treatment address.

Cloudflare Web Analytics is already on the site, does not use advertising cookies, and still receives page addresses.

Turning measurement off stops later measurement and clears the measurement cookies this site can delete. It does not erase measurements already sent.

Personal information is not sold.

## Account work still required

Code on a branch does not turn production measurement on. These stay open:

1. Copy Humanizer review of the banner strings and the privacy section above, then an update to `privacy.html`. The current privacy page still says the tags load for everyone.
2. Paste a real Meta dataset id into `CONFIG.metaPixelId` only after confirming it. In Events Manager, turn automatic advanced matching off. The pixel is confined to an empty frame so form fields are not in its document, and `autoConfig` is false so automatic button and form scraping stays off. Frontend code cannot force the Events Manager toggle off. Health-category limits may drop `Lead`, `Schedule`, custom events, or parameters. This code does not send a Conversions API feed and does not send patient details.
3. Google Ads stays unconfigured. There is no `AW-` id and no conversion label in this repo. `booking_start` must not be marked as a key event. `generate_lead` and `booking_completed` can be marked only after the booking signal exists.
4. In GA4 Admin, turn off Enhanced measurement for form interactions, site search, and outbound clicks. Those automatic events can collect phone links, query strings, or form activity outside this snippet. Confirm DebugView shows the coarse `page_location` and the fixed title.
5. In HubSpot, create custom behavioral events with no properties: `booking_start`, `contact_call`, `contact_text`, `lead_consult_request`, `lead_contact`, `booking_completed`. Until they exist, HubSpot ignores them. The old `/track/call`, `/track/text`, and `/track/book` page views are removed.
6. HubSpot's cookie banner should not run beside this one. The code records analytics consent and refuses HubSpot advertisement cookies. Form posts still go to HubSpot when measurement is off, without the `hubspotutk` cookie. After consent, HubSpot's own tracker still receives the real path and title. Do not sync those HubSpot page views into Google or Meta.
7. Completed bookings are not measured for the current new-tab scheduler. An embed would be a scheduling change and is not part of this branch. Meetings HTML still has no Google or Meta tag.
8. The journal is not instrumented by this branch. Its current Google tag sends article addresses and titles into `G-0BX0PK6GZP`. Remove that tag, then add `https://katchapmanrn.com/measurement.js?v=1` and `https://katchapmanrn.com/measurement-blog.js?v=1` to the blog template. `measurement-blog.js` does nothing on the apex host.
9. Cloudflare Web Analytics still receives full URLs, including treatment paths. It was already on every page and is unchanged.

## Deploy

This repo has no GitHub Actions workflow, no Wrangler config, and no GitHub Pages site. `_redirects` is a Cloudflare Pages file, and every page loads the Cloudflare Web Analytics beacon. Production publishing is the connected Cloudflare Pages project. A merge to `main` is required before production changes if that project builds `main`. Preview deploys, if the project has them turned on, are a project setting and are not defined in the repo. This branch does not merge or deploy.
