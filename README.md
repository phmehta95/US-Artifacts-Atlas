# Ultrasound artifact atlas

## Private image review

Contributors must confirm that submitted images and captions contain no patient-identifiable information. Images are stored in a private Cloudflare R2 bucket and remain hidden from the public galleries while pending. The reviewer signs in to `/review.html` to inspect submissions and approve or decline them. Approval publishes images to the relevant gallery; declining or leaving a submission unreviewed for seven days removes it. Reviewers can also delete individual approved images from the private dashboard.

After a submission is stored, the Worker sends a notification to `pruthvi.mehta@nhs.net` through Resend using its `onboarding@resend.dev` test sender. The notification contains a link to the private dashboard, not the uploaded image or caption. Resend's test sender only delivers to the email address associated with the Resend account. If the API key is missing or Resend rejects the request, the submission remains safely stored and the upload page reports that the notification was not sent. The dashboard page is public, but its queue, image previews, approved-image management, and review APIs require a password-protected session.

## Configure Cloudflare

Run these commands from the repository root in the Cloudflare account that owns the `us-artifacts-atlas` Worker:

1. Run `npx wrangler login` and `npx wrangler whoami` to verify the account.
2. Create the private storage resources if they do not already exist:
   - `npx wrangler d1 create us-artifacts-atlas-review`
   - `npx wrangler r2 bucket create us-artifacts-atlas-review`
3. Copy the D1 database ID returned by Wrangler into the `database_id` property of the `DB` entry in `wrangler.jsonc`.
4. Apply the schema and set a strong reviewer password:
   - `npx wrangler d1 migrations apply us-artifacts-atlas-review --remote`
   - `npx wrangler secret put REVIEWER_PASSWORD`
   - `npx wrangler secret put RESEND_API_KEY`

   Enter a unique password of at least 24 characters when prompted. Keep it in a password manager and do not commit it or share it in chat. Changing this secret signs out existing dashboard sessions.
   Create a Resend API key in the Resend dashboard and enter it only at Wrangler's secret prompt. Do not put it in source code or `wrangler.jsonc`.
5. Deploy with `npx wrangler deploy`.

The reviewer dashboard is at `https://<worker-name>.<account-subdomain>.workers.dev/review.html`. Reviewer sessions are signed, stored in `Secure`, `HttpOnly`, `SameSite=Strict` cookies, and expire after eight hours. Sign out when finished.

The Worker rate-limits uploads, sign-in attempts, review decisions, and approved-image deletion to five requests per minute per client IP. An automatic daily cleanup removes declined submissions and pending submissions older than seven days. Approved images remain in private R2 storage and are served through the Worker only when their D1 status is `approved`.

Test with a non-sensitive, de-identified image. Confirm it is absent from the public gallery while pending, visible only after reviewer sign-in, published to the selected artifact gallery after approval, and removable from both the gallery and private storage by the reviewer. Confirm the notification reaches the Resend account email. Local tests use in-memory D1/R2 and a mocked Resend response; they do not deploy or send external email.

Run the Worker workflow tests with `node --test tests\worker.test.mjs`.
