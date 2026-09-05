# Detroit Hub email integration

`server.js` mounts `detroit-hub.js` before the existing Iron Digital CORS middleware, so existing intake routes keep their behavior.

The new routes reuse `RESEND_API_KEY` and `NOTIFY_EMAIL`. The owner approved sender `contact@irondigitalmi.com` and newsletter footer `313 Park Ave, Detroit, MI 48226`. Set optional `HUB_FROM_EMAIL` / `HUB_POSTAL_ADDRESS` to override, `HUB_CONFIRM_SECRET` for a separate signing secret, or `HUB_NEWSLETTER_ENABLED=false` to pause the newsletter. Never place the API key in Detroit Hub's static files.

The newsletter requires a Resend key with Contacts, Segments, Topics and Broadcasts access. The first signup creates/reuses a separate Detroit Hub segment/topic. Existing business contacts are never added automatically. Double confirmation and provider unsubscribe handling are built in. Reports are sent only to the existing notification recipient, as plain text, for manual review.

The weekly send endpoint accepts only a signed GitHub OIDC token for RonGdesigns/detroit-hub, immutable repo ID 1356662651, owner ID 139249566, master, and `.github/workflows/weekend.yml`. That companion site workflow runs on Thursday mornings and offers an editor-only preview. No shared cron password is needed. A separate named broadcast per weekend prevents repeat scheduled sends.

Run `npm ci --ignore-scripts && npm test` in this directory. Tests use a local HTTP server and mocked Resend responses, and verify real RSA JWT signatures. No real email is sent by tests.

After merging and Render redeploying:

1. Check `https://iron-digital-server.onrender.com/detroit-hub/config`.
2. Submit a labeled test report on an event page; verify delivery to the existing notification inbox.
3. Merge the companion Detroit Hub PR and run **Send the Detroit weekend guide** with **preview** checked. Check the approved sender and footer.
4. Test signup with an address you control, confirmation, and unsubscribe before promoting the list.

Rate limits are in memory for the current single-instance Render deployment (150 total public requests/hour; 10/client/hour; 2 confirmation emails/address/hour). With `RENDER` set, the last proxy-supplied forwarded address is used; locally the socket is used. Multiple instances need shared rate limiting before scaling. The public form fails honestly if Render or Resend is unavailable.
