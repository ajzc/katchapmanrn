# Measurement copy for Humanizer

Status: NOT PUBLISHED. Do not copy these paragraphs into privacy.html until a Humanizer verdict approves them. privacy.html still has the old opt-in sentences. Those sentences are now inaccurate for the code in this branch.

## Notice, shown only while measurement is on

There is no consent popup and no Allow measurement button.

Google, HubSpot, and Meta measure this page. Opt out any time.

Keep measurement off

Privacy

The Privacy control is a link to /privacy. Keep measurement off saves the opt-out and reloads the page.

## Proposed replacement for the Analytics and tracking paragraphs in privacy.html

These five paragraphs would replace the five paragraphs under Analytics and tracking. They are not in privacy.html.

On this site, Google Analytics, HubSpot analytics, and Meta measure visits from the United States on marketing pages that are not treatment, booking, consult, or form pages. Visitors outside the United States, and visits with no confirmed country, are not measured. A Global Privacy Control signal or a saved opt-out turns measurement off. There is no consent popup. A short notice with an opt-out appears only while measurement is on. This United States limit is a conservative choice. It is not a guarantee that the setup meets every privacy law.

Contact forms work separately. The name, email, phone number, and message you submit go to HubSpot even if measurement is off. HubSpot analytics does not load on treatment, booking, consult, or form pages, and it does not connect those visits to a form.

Google Analytics and Meta do not load on treatment, booking, consult, or form pages, or when the previous page or the address query names a treatment. On measured pages, they can receive page URLs, titles, referrers, technical and cookie identifiers, and permitted campaign identifiers. We do not add your name, email, phone number, message, or appointment time to Google or Meta event data. Google ad storage and advertising signals stay off.

Meta loads only for a measured United States visit and a configured pixel ID. Automatic matching stays off. Meta receives a page view only. This site does not send form, booking, or procedure events to Meta.

We measure page views on those marketing pages in HubSpot and Google Analytics. Clicks to call, text, or an external scheduler can be measured there too. A Book click is not a completed booking. Google Analytics records a booking event only after the embedded scheduler confirms a booking, and only if that page is being measured. Meta does not receive that booking event.

## Unchanged booking copy, already on the site

The scheduler works even if measurement is off. The scheduler is HubSpot Meetings. The name and contact details you enter there go to HubSpot to book the visit, and HubSpot sets cookies to run the scheduler. That is separate from measurement. HubSpot privacy notice: https://legal.hubspot.com/privacy-policy

The scheduler is on this page. It works even if measurement is off.

Open the scheduler in a new tab.

## Still not a release

This file is the follow-up humanizer pass. Do not deploy from this wording. Cloudflare country is read only from the worker. Until that worker is published after Pages, pages have no country and measurement stays off.
