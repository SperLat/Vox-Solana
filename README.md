# Project Vox

Solana devnet marketplace for audiobook narration bounties. Authors post short excerpts, narrators upload or record auditions, and authors/fans pay selected narrators directly with devnet SOL.

## Stack

- Next.js App Router, TypeScript, Tailwind
- Direct Phantom/Solflare browser wallet connector plus `@solana/web3.js`
- Supabase database and public storage bucket for live bounties and audio
- Solana Actions endpoint at `/api/actions/submissions/[id]/tip`
- Payment verifier endpoint at `/api/payments/verify`

No custom Solana program is used. Payments are direct wallet transfers with a memo:

```txt
project-vox:bounty=<id>:submission=<id>
```

## Local Setup

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example`:

```bash
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVER_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_DEMO_RECIPIENT_WALLET=
```

If Supabase variables are empty, the app runs from browser-local demo state so the UI can still be rehearsed.

For a fully functional deployed product path, configure `SUPABASE_SERVICE_ROLE_KEY`. The verifier route uses the service key to store receipts after checking the devnet transaction; the browser should not be trusted to mark payments paid.

`SUPABASE_SERVER_URL` is optional. Use it only when the server container should reach a self-hosted Supabase endpoint internally while browsers use `NEXT_PUBLIC_SUPABASE_URL`.

## Supabase

Run `supabase/schema.sql` in the Supabase SQL editor. Optional demo rows are in `supabase/seed.sql`.

The live schema is namespaced so it can share a demo Supabase project with Nagi/Cedar without colliding with its tables:

- `project_vox_bounties`
- `project_vox_submissions`
- `project_vox_payments`
- storage bucket `project-vox-auditions`

The hackathon policies are intentionally permissive for public demo writes. Tighten them before any production use.

## Demo Path

1. Connect Phantom or Solflare on devnet.
2. Create a bounty or select a seeded one.
3. Upload or record an audition.
4. Select an audition.
5. Pay the narrator with devnet SOL.
6. Wait for verification status: verified, pending verification, or failed.
7. Retry verification if RPC was temporarily unavailable.
8. Copy or open the Blink action link from an audition.

Only server-verified payments mark a bounty as paid. If devnet RPC is unreachable, the receipt remains pending instead of being shown as paid.

## Deployment

Deploy to Vercel with the same environment variables, or use `deploy/netcup/` for the Netcup/Coolify container path. After deployment, test:

- App loads from a clean browser session.
- Supabase read/write works.
- Audio upload lands in the `project-vox-auditions` bucket.
- `/api/actions/submissions/submission-luz/tip` returns action metadata.
- POST to the action endpoint returns a base64 transaction for the connected wallet.
- `/api/payments/verify` rejects fake or mismatched signatures and returns pending when RPC is unavailable.
