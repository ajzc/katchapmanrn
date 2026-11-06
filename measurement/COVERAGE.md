# Measurement coverage — Kat Chapman RN

Live Meta delivery is not verified. `META_PIXEL_ID` is empty. Adspirer did not return a pixel ID. No ID was invented.

The pixel, when an ID exists, loads on the real page. A hidden frame is not used to stand in for the site. Meta's tag template accepts a numeric dataset ID and does not publish a 15- or 16-digit limit, so this code does not reject an ID for length.

## Events

| Action | HubSpot | GA4 `G-0BX0PK6GZP` | Meta |
|---|---|---|---|
| Allow, then a page view | Native page view of the real path and title, including treatment pages. One view. | One `page_view` only when the URL is not a treatment path. No stand-in URL is sent. A treatment referrer is cut back to the site origin. A title that names a treatment is not sent. | No request on a treatment URL, a treatment query, or a treatment referrer. Otherwise one `PageView` with no extra object. |
| Call or text | `/track/call` or `/track/text`, then the path is restored | `outbound_click` with `link_kind` only | `OutboundClick` with `link_kind` only |
| Book control to `/book` | The `/book` page view. No extra `/track/book`. | The `/book` page view. Not a booking. | The page view. Not `Schedule`. |
| Direct scheduler link | `/track/book` intent only | `outbound_click` `link_kind=book`. Not a booking. | `OutboundClick`. Not `Schedule`. |
| Contact form success | Forms API form `520f79d5-f010-4465-8a88-56b22f41ab0d` with the typed fields. `hutk` only after Allow. `pageUri` is omitted. | One `generate_lead` with `form_id=contact` | One `Lead` with no field object |
| Contact form while measurement is off | The same form post, without `hutk` | No lead | No Lead |
| Form failure | No new success record | `form_submit_failed` | Nothing |
| Scheduler confirms a visit | HubSpot Meetings creates the meeting. This code does not replace it. | `booking_completed` once, from `meetingBookSucceeded === true` on the official embed iframe | `Schedule` with no date and no contact fields |

Book is not a completed booking. `/track/book` is not a meeting.

Every public HTML template loads `script.js`, including `/book`. Blog articles are not in this repo. `measurement/HUBSPOT_BLOG_SNIPPET.html` is the separate header the parent pastes once into the HubSpot blog template. It does not add a second GA4 tag or a second HubSpot tracking script.

## What is withheld from Google and Meta

Name, email, phone, message text, and appointment time are not event parameters. The meetings payload is ignored. Contact-like query parameters are removed before tags load. Campaign parameters and click IDs stay, so attribution is not replaced with a stand-in page.

Google signals and ad storage stay off. Meta `init` receives the pixel ID only. `autoConfig` is false. Limited Data Use is set. Automatic Advanced Matching is an Events Manager switch this repo cannot see.

## Gaps

- Pixel ID `2738351096678050` is set. The dataset had no website source and no events when it was added. Assign `katchapmanrn.com` in Events Manager if that screen requires a domain. Do not also enable a HubSpot Meta pixel. Automatic event detection in Events Manager remains unconfigured until that source exists.
- If a Cloudflare rule still redirects `/book` to HubSpot, the same-site embed will not load until that rule is removed. The direct scheduler link remains.
- Completed-booking events require the embed message. A new-tab booking does not send it.
- Blog snippet does nothing until the parent pastes it and the pixel ID matches `measurement/config.mjs`.
- Expanded privacy wording in `measurement/CONSENT_COPY_FOR_REVIEW.md` needs a second humanizer pass before it is published. `privacy.html` was not changed.
