import { TipShareActions } from "@/components/tip-share-actions";
import { getActionSubmissionInfo } from "@/lib/action-lookups";
import { paymentMemo } from "@/lib/constants";
import { ArrowLeft, Headphones, ReceiptText, Sparkles, Wallet } from "lucide-react";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function TipPage({ params }: PageProps) {
  const { id } = await params;
  const { bounty, submission } = await getActionSubmissionInfo(id);
  const origin = await getPublicOrigin();
  const shareUrl = `${origin}/tip/${id}`;
  const actionUrl = `${origin}/api/actions/submissions/${id}/tip`;
  const coverArt = bounty.cover_art || "/covers/river-manual.svg";

  return (
    <main className="min-h-screen px-4 py-5 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-ink/10 bg-white/75 p-4 shadow-line backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-ink/65 transition hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Project Vox
          </Link>
          <div className="inline-flex items-center gap-2 rounded-lg border border-vox/15 bg-vox/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-vox">
            <Sparkles className="h-4 w-4" />
            Shareable Solana tip
          </div>
        </header>

        <section className="overflow-hidden rounded-lg border border-ink/10 bg-white/80 shadow-line backdrop-blur">
          <div className="grid min-h-[660px] lg:grid-cols-[minmax(360px,0.82fr)_minmax(0,1fr)]">
            <div className="relative min-h-[430px] overflow-hidden bg-ink p-5 sm:p-8 lg:min-h-full">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(185,93,61,0.45),transparent_24rem),radial-gradient(circle_at_80%_82%,rgba(47,100,214,0.22),transparent_22rem)]" />
              <div className="relative flex h-full min-h-[390px] items-center justify-center">
                <div className="relative aspect-[3/4] w-full max-w-[410px] overflow-hidden rounded-[22px] border border-paper/10 bg-paper/5 shadow-2xl">
                  <Image src={coverArt} alt={`${bounty.title} cover art`} fill className="object-cover" priority />
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-7">
              <div className="flex flex-col gap-5">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.16em] text-clay">{bounty.genre}</p>
                  <p className="mt-3 text-sm font-black text-ink/45">{bounty.title}</p>
                  <h1 className="mt-2 font-serif text-5xl font-semibold leading-none">Tip {submission.narrator_name}</h1>
                  <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-ink/65">
                    Support this voice take with a direct devnet SOL tip. The tip action includes a memo that links the payment to this bounty
                    and audition.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <TipMetric label="Audition award" value={`${Number(bounty.reward_sol).toFixed(2)} SOL`} />
                  <TipMetric label="Full project" value={formatOptionalSol(bounty.full_project_budget_sol)} />
                  <TipMetric label="Network" value="Devnet" />
                </div>

                <div className="rounded-lg border border-ink/10 bg-paper/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-black">
                    <Headphones className="h-4 w-4 text-vox" />
                    Audition audio
                  </div>
                  <audio className="mt-3 w-full" controls src={submission.audio_url} />
                  <p className="mt-3 text-sm font-semibold leading-6 text-ink/60">{submission.note || "No narrator note was added."}</p>
                </div>

                <TipShareActions actionUrl={actionUrl} shareUrl={shareUrl} />

                <div className="grid gap-3">
                  <InfoLine icon={<Wallet className="h-4 w-4" />} label="Narrator wallet" value={submission.narrator_wallet} />
                  <InfoLine icon={<ReceiptText className="h-4 w-4" />} label="Memo" value={paymentMemo(bounty.id, submission.id)} />
                </div>

                <div className="rounded-lg border border-vox/20 bg-vox/10 p-4 text-sm font-semibold leading-6 text-ink/65">
                  This page is the human-readable share page. The Solana Action URL returns JSON in a normal browser, and supported clients render it
                  as signable tip buttons.
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function TipMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-paper px-3 py-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/40">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function InfoLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-white/70 px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-ink/45">
        <span className="text-clay">{icon}</span>
        {label}
      </div>
      <p className="mt-1 break-all text-sm font-bold text-ink/65">{value}</p>
    </div>
  );
}

async function getPublicOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (configuredOrigin) {
    return configuredOrigin.replace(/\/$/, "");
  }

  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || requestHeaders.get("host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || "https";

  return host ? `${proto}://${host}` : "";
}

function formatOptionalSol(value?: number | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "TBD";
  }

  return `${parsed.toFixed(2)} SOL`;
}
