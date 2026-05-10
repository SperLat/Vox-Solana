# Project Vox

Solana devnet marketplace for audiobook narration bounties. Authors post paid audition awards with a larger full-book narration budget, narrators upload or record auditions, and authors/fans pay selected narrators directly with devnet SOL.

## Stack

- Next.js App Router, TypeScript, Tailwind
- Direct Phantom/Solflare browser wallet connector plus `@solana/web3.js`
- Supabase database and public storage bucket for live bounties and audio
- Wallet profile workspace for authors and narrators
- Public visual tip pages at `/tip/[submission-id]`
- Solana Actions endpoint at `/api/actions/submissions/[id]/tip`
- Payment verifier endpoint at `/api/payments/verify`

No custom Solana program is used. The hackathon MVP verifies direct payments for the selected audition award; the full narration budget is displayed as the follow-on project amount. Payments are direct wallet transfers with a memo:

```txt
project-vox:bounty=<id>:submission=<id>
```

## License

Project Vox is open source under the GNU Affero General Public License v3.0 only (`AGPL-3.0-only`). See `LICENSE`.

## Local Setup

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example`:

```bash
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVER_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_DEMO_RECIPIENT_WALLET=
```

If Supabase variables are empty, the app runs from browser-local demo state so the UI can still be rehearsed.

For a fully functional deployed product path, configure `SUPABASE_SERVICE_ROLE_KEY`. The verifier route uses the service key to store receipts after checking the devnet transaction; the browser should not be trusted to mark payments paid.

## Identity Model

Project Vox is wallet-first. Browsing and listening are public. Creating bounties, submitting auditions, saving profiles, grading/shortlisting/selecting auditions, and paying audition awards require a connected Phantom or Solflare wallet. Author-only controls are locked to the wallet that created the bounty.

`SUPABASE_SERVER_URL` is optional. Use it only when the server container should reach a self-hosted Supabase endpoint internally while browsers use `NEXT_PUBLIC_SUPABASE_URL`.

`NEXT_PUBLIC_APP_URL` is optional locally, but set it in production to the public app origin, for example `https://vox.sperlat.dev`. Solana Action metadata uses it for absolute public tip-action URLs behind reverse proxies.

## Supabase

Run `supabase/schema.sql` in the Supabase SQL editor. Optional demo rows are in `supabase/seed.sql`.

The live schema is namespaced so it can share a demo Supabase project with Nagi/Cedar without colliding with its tables:

- `project_vox_bounties`
- `project_vox_submissions`
- `project_vox_payments`
- `project_vox_profiles`
- storage bucket `project-vox-auditions`

The hackathon policies are intentionally permissive for public demo writes. Tighten them before any production use.

## Demo Path

1. Connect Phantom or Solflare on devnet.
2. Save a wallet profile in My workspace.
3. Create a bounty or select a seeded one.
4. Upload or record an audition.
5. Select an audition.
6. Pay the selected narrator the audition award with devnet SOL.
7. Wait for verification status: verified, pending verification, or failed.
8. Retry verification if RPC was temporarily unavailable.
9. Copy or open the public tip page from an audition, or inspect its Solana Action JSON.

Only server-verified payments mark a bounty as paid. If devnet RPC is unreachable, the receipt remains pending instead of being shown as paid.

## Deployment

Deploy to Vercel with the same environment variables, or use `deploy/netcup/` for the Netcup/Coolify container path. After deployment, test:

- App loads from a clean browser session.
- Supabase read/write works.
- Audio upload lands in the `project-vox-auditions` bucket.
- `/api/actions/submissions/submission-luz/tip` returns action metadata.
- POST to the action endpoint returns a base64 transaction for the connected wallet.
- `/api/payments/verify` rejects fake or mismatched signatures and returns pending when RPC is unavailable.
