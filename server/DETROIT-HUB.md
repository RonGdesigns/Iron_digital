# Detroit Hub change reports

Detroit Hub uses **beehiiv for newsletters** and **Resend for change reports**. This server handles reports only; it does not create subscriber lists or send weekend broadcasts.

`server.js` mounts `detroit-hub.js` separately from the existing Iron Digital intake routes. It reuses `RESEND_API_KEY` and the existing `NOTIFY_EMAIL` recipient. The approved sender is `contact@irondigitalmi.com`; `HUB_FROM_EMAIL` can override it. Only Resend email-sending access is needed.

`POST /detroit-hub/report` validates event paths and report fields, sends plain text to the fixed notification recipient, and sets the optional reporter address as Reply-To. Origin checks, a honeypot, per-IP/global rate limits, and idempotency remain in place. Reports require manual review; they never modify event listings directly.

`GET /detroit-hub/config` advertises report availability and `newsletterProvider: beehiiv`. The retired `/subscribe`, `/confirm` and `/weekend-send` routes return 410 without sending email or changing any contacts. No existing subscriber records are deleted or migrated by this cleanup. Newsletter preferences are managed in beehiiv.

Run `npm ci --ignore-scripts` and `npm test` in this directory. Five tests cover validation, recipient routing, idempotency, failures, spam limits and retired newsletter routes. Tests use a local HTTP server with mocked Resend responses; they send no real mail.

After merging and Render deploying, check `/detroit-hub/config`, submit a clearly labeled test report on Detroit Hub, and verify inbox delivery. The site PR is https://github.com/RonGdesigns/detroit-hub/pull/7.

The limiter uses memory for the current single Render instance: 150 public requests/hour and 10/client/hour. With `RENDER` set, the last proxy-supplied forwarded address is used; locally the socket is used. Multiple instances need shared limiting before scaling. The form fails honestly if Render or Resend is unavailable.
