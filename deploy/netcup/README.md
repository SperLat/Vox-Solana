# Netcup / Coolify Deployment

Project Vox can run as a standalone Next.js container behind the existing Netcup Coolify Traefik proxy.

## Shape

- Container port: `3000`
- Docker network: external `coolify`
- Traefik entrypoint: `https`
- TLS resolver: `letsencrypt`
- Database: Supabase, using namespaced Project Vox tables:
  - `project_vox_bounties`
  - `project_vox_submissions`
  - `project_vox_payments`
  - storage bucket `project-vox-auditions`

## Setup

1. Create a git repository for this app and connect it to Coolify.
2. In Coolify, use the repo root Dockerfile or this compose file.
3. Add env vars from `.env.example`.
4. Run `supabase/schema.sql` manually in the target Supabase project before enabling live persistence.
5. Optional: run `supabase/seed.sql` manually for demo data.

Do not run database mutations from an agent session. Treat schema and seed SQL as manual operator steps.

## Update Flow

```bash
git add Dockerfile .dockerignore next.config.ts deploy/netcup README.md supabase lib app components
git commit -m "Add Project Vox Netcup deployment"
git push
```

Coolify can redeploy from the pushed commit. If deploying manually on the VPS, discover the real app directory/container first; Coolify may generate names.
