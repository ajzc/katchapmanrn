# Measurement coverage — Kat Chapman RN

Live Meta delivery is **not verified**. `META_PIXEL_ID` in `measurement/config.mjs` is empty on purpose. Adspirer was not available in this session, so no pixel ID could be read. Do not paste a guessed ID.

## What is implemented in this repo

| Action | HubSpot | GA4 `G-0BX0PK6GZP` | Meta |
|---|---|---|---|
| Page view, after Allow | Native tracking-code page view of the real path and title | One `page_view` with neutral category URL `/p/home`, `/p/contact`, `/p/local`, `/p/article`, and so on. Title is always `Kat Chapman RN` | One `PageView` inside the sandboxed frame, only after a real pixel ID is set. The frame URL is neutral. The treatment URL is not a parameter |
| Call, text, or Book click | Synthetic page view `/track/call`, `/track/text`, or `/track/book`, then the path is restored. This is an intent count already used in HubSpot | One non-conversion `outbound_click` with `link_kind` only | `OutboundClick` custom event with `link_kind` only, when a pixel ID is set. Not Lead, Contact, or Schedule |
| Book click | `/track/book` only | Not a booking | Not a booking |
| Contact form success | Existing Forms API submission to portal `22023986`, form `520f79d5-f010-4465-8a88-56b22f41ab0d`. Contact source stays FORM. Fields are the ones the visitor typed | One `generate_lead` with `form_id=contact` | One `Lead` with no parameters, when a pixel ID is set |
| Join form success | Form `2b288535-f430-41df-aea1-2c15d800d311`, only if a real `<form id="join">` is on the page. The homepage block is not a form today | `generate_lead` with `form_id=join` | One `Lead` |
| Form failure | Nothing new. The visitor sees HubSpot's error. The response body is not copied into analytics | `form_submit_failed` with `rejected` or `network` | Nothing |
| Completed booking | HubSpot Meetings creates the meeting and contact association on HubSpot's scheduler. This code does not replace that | `booking_completed` only if a sandboxed-off official embed posts `meetingBookSucceeded: true` from `https://meetings.hubspot.com` for this exact scheduler | `Schedule` with no date and no contact fields, same signal only |
| Return visit with `?sent=1` or `?joined=1` | No second form post | No lead | No Lead |

Book is not a completed booking. `/track/book` is not a meeting. A click never emits `booking_completed` or Meta `Schedule`.

Every public HTML template loads `script.js`, including local pages, core pages, the contact page, the homepage, and the 404. Articles stay on the HubSpot blog, which this repo does not publish.

## What HubSpot receives that Google and Meta do not

- The real page path and document title, after Allow, through the existing HubSpot tracking code.
- Form values the visitor submits: first name, email, phone, and the contact message. That message still includes the existing consultation yes/no line. Those values go only to the Forms API.
- `context.pageName` and, after Allow, `context.hutk`. `pageUri` is still omitted. A v3 submission with `pageUri` on katchapmanrn.com was verified on 2026-10-20 to return HTTP 200 and then disappear.
- First-touch `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, and `utm_content` copied onto the meetings link. Unsafe values (email, phone, URL) are dropped.
- The meeting record itself, when someone finishes the scheduler. Zero recent meetings is not evidence that this wiring is missing.

HubSpot does not receive GA4 or Meta events through this code. A native HubSpot ads connector does not import those events by itself, and this session could not change that connector.

## What Google and Meta receive that HubSpot already had another way

- GA4 gets the neutral page category, not the treatment path, title, query string, form text, or appointment time.
- Meta, once configured, gets PageView, OutboundClick, Lead, and Schedule from the sandboxed frame. Parameters are the event name and, for clicks, `link_kind`. Limited Data Use is set. `autoConfig` is false. `fbq('init')` is called with the pixel ID only, so the page does not pass advanced matching fields.
- Neither platform gets a noscript pixel. Neither is loaded before Allow. Deny and Turn measurement off stop later events. Revoke also asks HubSpot to revoke its consent cookie.

## Unconfigured until the parent acts

- Meta pixel ID. Status on the page: `data-measurement-meta="unconfigured"`. No request to `connect.facebook.net` until the constant is a 15- or 16-digit ID.
- Events Manager: turn off Automatic Advanced Matching. The page cannot force that account setting off. Leave it on and the pixel can still read form fields after it loads.
- Do not build custom audiences from treatment pages. Do not add patient-level Conversions API.
- GA4 Admin: mark `generate_lead` and `booking_completed` as key events. Do not mark `page_view`, `outbound_click`, or `form_submit_failed`.
- Google Ads `AW-` and GTM are not installed. `ad_storage` stays denied. `G-R3W00H7HMB` belongs to a different property and is not used.
- HubSpot UI, which this connector cannot edit: tracking domains for `katchapmanrn.com` and `blog.katchapmanrn.com`, the duplicate cookie banner, GA4 linker settings on the blog, and the meetings scheduler. The blog already loads `G-0BX0PK6GZP`. Do not add a second GA tag there.
- The current Book control opens the scheduler in a new tab. That path cannot emit the embed success message. Completed-booking ads events stay at zero until an official embed is added without removing the working scheduler. The HubSpot meeting record does not depend on that embed.

## Safe limits, not promises

- Google and Meta do not see which treatment page was opened. Local pages share one category.
- Campaign names can still sit on the HubSpot meetings link. They are not copied into GA4 or Meta parameters.
- `gclid` and `fbclid` are stripped before tags load. There is no Google Ads tag to use `gclid`.
- The sandboxed frame cannot read the parent page. Meta match quality will be low: no advanced matching, no treatment URL, and the frame is not allowed to share the parent page's cookies.
- Cloudflare's existing web analytics beacon is still on the HTML pages and is not part of this consent gate. It can still receive the page path.
- A declined visitor can still submit the contact form. HubSpot gets the message. Google and Meta do not get a lead.
