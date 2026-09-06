# Detroit Hub change reports

Detroit Hub uses **beehiiv for newsletters** and **Resend for change reports and sponsorship inquiries**. This server does not create subscriber lists or send weekend broadcasts.

`POST /detroit-hub/sponsor` accepts a business, contact name/email, business/event URL, selected package, optional preferred date, details and request ID. It sends plain text only to the existing `NOTIFY_EMAIL`, with the contact as Reply-To. It validates fields, shares report rate limits/origin checks/honeypot handling, and uses `hub-sponsor/<requestId>` for Resend idempotency. No payment, reservation, subscriber enrollment or public listing is created.

`GET /detroit-hub/config` now includes `sponsor: true` when the existing email key and recipient are configured. Deploy this change before the Detroit Hub Advertise page; older servers leave that form disabled with an email fallback. Existing change reports remain supported. Tests mock delivery and send no live email; inbox receipt still needs a controlled post-deployment check.

`server.js` mounts `detroit-hub.js` separately from the existing Iron Digital intake routes. It reuses `RESEND_API_KEY` and the existing `NOTIFY_EMAIL` recipient. The approved sender is `contact@irondigitalmi.com`; `HUB_FROM_EMAIL` can override it. Only Resend email-sending access is needed.

`POST /detroit-hub/report` validates event paths and report fields, sends plain text to the fixed notification recipient, and sets the optional reporter address as Reply-To. Origin checks, a honeypot, per-IP/global rate limits, and idempotency remain in place. Reports require manual review; they never modify event listings directly.

`GET /detroit-hub/config` advertises report availability and `newsletterProvider: beehiiv`. The retired `/subscribe`, `/confirm` and `/weekend-send` routes return 410 without sending email or changing any contacts. No existing subscriber records are deleted or migrated by this cleanup. Newsletter preferences are managed in beehiiv.

Run `npm ci --ignore-scripts` and `npm test` in this directory. Five tests cover validation, recipient routing, idempotency, failures, spam limits and retired newsletter routes. Tests use a local HTTP server with mocked Resend responses; they send no real mail.

After merging and Render deploying, check `/detroit-hub/config`, submit a clearly labeled test report on Detroit Hub, and verify inbox delivery. The site PR is https://github.com/RonGdesigns/detroit-hub/pull/7.

The limiter uses memory for the current single Render instance: 150 public requests/hour and 10/client/hour. With `RENDER` set, the last proxy-supplied forwarded address is used; locally the socket is used. Multiple instances need shared limiting before scaling. The form fails honestly if Render or Resend is unavailable.
