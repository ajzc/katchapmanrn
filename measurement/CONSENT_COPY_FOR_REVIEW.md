# Consent copy

Short banner is unchanged:

Measurement stays off until you allow it. With your permission, HubSpot can record pages you visit on Kat Chapman RN and connect a submitted form to that visit. Submitted contact form details go to HubSpot. Google, and Meta when a pixel is configured, receive measurement data. You can change your choice in Privacy settings.

Allow measurement

Keep measurement off

Privacy settings

## Published in privacy.html

Google, Meta, and HubSpot measurement scripts stay off until you choose Allow measurement. Keep measurement off leaves them off. You can turn measurement off later in Privacy settings to stop future measurement.

Contact forms work separately. The name, email, phone number, and message you submit go to HubSpot even if measurement is off. With measurement allowed, HubSpot analytics can receive page URLs and titles and may connect your form submission to your visit.

Google Analytics and Meta do not load on treatment pages or receive treatment page URLs, titles, or referrers. On permitted pages, they can receive page URLs, titles, referrers, technical and cookie identifiers, and permitted campaign identifiers. We do not add your name, email, phone number, message, or appointment time to Google or Meta event data. Google ad storage and advertising signals stay off.

Meta loads only with your permission and a verified pixel ID. Automatic matching stays off.

We measure page views, successful form submissions, and clicks to call, text, or book in HubSpot and, on permitted pages, in Google Analytics. A Book click is not a completed booking. We record a booking event only after the embedded scheduler confirms a booking. Meta may block the form event and the booking event under its health and wellness settings. This site does not rename those events or send them another way. Whether Meta receives those two events is not confirmed.

The scheduler works even if measurement is off.

## Published on the booking page

The scheduler is on this page. It works even if measurement is off.

Open the scheduler in a new tab.

## Not published — needs a follow-up humanizer pass

The returned sentence "Automatic matching and automatic event collection stay off" is not published as a whole. Automatic matching is confirmed off in Events Manager. The automatic event detection control was not available before a website source existed, so this page does not claim that control is off. The code sets autoConfig to false. Recheck that setting after the pixel is connected to katchapmanrn.com.

This sentence was added so the policy does not promise events Meta may block. It is not part of the returned draft:

Meta may block the form event and the booking event under its health and wellness settings. This site does not rename those events or send them another way. Whether Meta receives those two events is not confirmed.

This sentence was added because the scheduler is operational HubSpot, not measurement. It is not part of the returned draft:

The scheduler is HubSpot Meetings. The name and contact details you enter there go to HubSpot to book the visit, and HubSpot sets cookies to run the scheduler. That is separate from measurement. HubSpot privacy notice: https://legal.hubspot.com/privacy-policy

## Still conditional after this repo change

The short banner says measurement stays off until Allow. That is true for Google, Meta, and HubSpot measurement in this repo after the manual Cloudflare beacon tags are removed. It stays false if Cloudflare Web Analytics automatic injection is still enabled. Dashboard path, from Cloudflare's Web Analytics get-started page: Web Analytics, the site card, Manage site, JS snippet setup, Disable. That option is documented as: the JS snippet will not be injected and has been disabled. Removing only the tags in this repo does not switch that control.

Turning measurement off reloads the page after the denial is saved and in-progress contact fields are stored. The reload is what stops a script that already loaded. Consent updates alone are not treated as enough.
