"use client";

import {
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  Check,
  CircleDollarSign,
  Clock3,
  Clipboard,
  ClipboardCheck,
  Copy,
  FileAudio2,
  Filter,
  Headphones,
  ImageIcon,
  ListChecks,
  Loader2,
  Mic,
  Plus,
  ReceiptText,
  Search,
  Send,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  Star,
  Timer,
  Upload,
  Users,
  Wallet,
  Wand2,
  X
} from "lucide-react";
import Image from "next/image";
import { clusterApiUrl, Connection } from "@solana/web3.js";
import type { ButtonHTMLAttributes, FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildPaymentTransaction } from "@/lib/solana-payments";
import {
  createBounty,
  createSubmission,
  loadMarketplaceState,
  markSubmissionSelected,
  recordPayment,
  resetLocalDemoState,
  updatePaymentVerification,
  upsertProfile,
  verifyPayment
} from "@/lib/marketplace-store";
import { explorerTxUrl, paymentMemo } from "@/lib/constants";
import type { Bounty, BountyStatus, MarketplaceState, Payment, PaymentStatus, ProfileRole, Submission, VoxProfile } from "@/lib/types";
import { useVoxWallet } from "@/components/wallet-context-provider";

type Toast = {
  tone: "success" | "error" | "info";
  message: string;
};

type BoardStatusFilter = "all" | BountyStatus;
type BoardSort = "newest" | "reward_desc" | "reward_asc" | "most_auditions";
type DemoRole = "author" | "narrator" | "fan";
type BoardFilters = {
  query: string;
  genre: string;
  status: BoardStatusFilter;
  sort: BoardSort;
};

type AudioMeta = {
  name: string;
  type: string;
  sizeMb: number;
  duration: number | null;
};

type ReviewCriterion = "tone" | "clarity" | "pacing" | "fit";
type SubmissionReview = Record<ReviewCriterion, number> & {
  shortlisted: boolean;
  note: string;
};
type ReviewState = Record<string, SubmissionReview>;
type ManualVerifyForm = {
  tx_signature: string;
  submission_id: string;
};
type ProfileForm = {
  display_name: string;
  role: ProfileRole;
  bio: string;
};
type NarratorProfile = {
  wallet: string;
  name: string;
  submissions: number;
  selected: number;
  verifiedSol: number;
  genres: string[];
  average: number | null;
  topSubmission: Submission | null;
};
type AccountSubmission = {
  submission: Submission;
  bounty: Bounty | null;
};
type AccountWorkspace = {
  profile: VoxProfile | null;
  authoredBounties: Bounty[];
  narratorSubmissions: AccountSubmission[];
  incomingPayments: Payment[];
  outgoingPayments: Payment[];
  verifiedIncomingSol: number;
  verifiedOutgoingSol: number;
};

const initialBountyForm = {
  title: "",
  genre: "Fiction",
  reward_sol: "0.15",
  full_project_budget_sol: "1.50",
  excerpt: "",
  author_wallet: "",
  cover_art: "/covers/red-library.svg"
};

const initialSubmissionForm = {
  narrator_name: "",
  narrator_wallet: "",
  note: ""
};
const initialManualVerifyForm: ManualVerifyForm = {
  tx_signature: "",
  submission_id: ""
};
const initialProfileForm: ProfileForm = {
  display_name: "",
  role: "both",
  bio: ""
};

const demoSteps = [
  "Browse bounty",
  "Submit audition",
  "Select narrator",
  "Pay on devnet",
  "Verify receipt",
  "Share tip link"
];
const demoRoles: DemoRole[] = ["author", "narrator", "fan"];
const roleGuides: Record<
  DemoRole,
  {
    label: string;
    icon: ReactNode;
    headline: string;
    description: string;
    primaryAction: string;
  }
> = {
  author: {
    label: "Author",
    icon: <BookOpen className="h-4 w-4" />,
    headline: "Author view",
    description: "Create a paid audition with a full-book budget, compare takes, select a narrator, then pay with devnet SOL.",
    primaryAction: "Use Post a bounty and the review controls."
  },
  narrator: {
    label: "Narrator",
    icon: <Mic className="h-4 w-4" />,
    headline: "Narrator view",
    description: "Browse open bounties, upload or record an audition, and set the wallet that should receive payment.",
    primaryAction: "Use Submit an audition."
  },
  fan: {
    label: "Fan",
    icon: <CircleDollarSign className="h-4 w-4" />,
    headline: "Fan view",
    description: "Listen to auditions, open a shareable Solana tip action, and tip a narrator directly on devnet.",
    primaryAction: "Use the tip link and payment receipt panels."
  }
};

const MAX_AUDIO_MB = 15;
const MAX_COVER_MB = 6;
const REVIEW_STORAGE_KEY = "project-vox-review-v1";
const coverPresets = [
  { label: "Red Library", value: "/covers/red-library.svg" },
  { label: "River Manual", value: "/covers/river-manual.svg" },
  { label: "Orchid Clock", value: "/covers/orchid-clock.svg" }
];
const defaultBoardFilters: BoardFilters = {
  query: "",
  genre: "all",
  status: "all",
  sort: "newest"
};
const reviewCriteria: Array<{ key: ReviewCriterion; label: string }> = [
  { key: "tone", label: "Tone" },
  { key: "clarity", label: "Clarity" },
  { key: "pacing", label: "Pacing" },
  { key: "fit", label: "Fit" }
];
const seededReviewState: ReviewState = {
  "submission-luz": {
    tone: 4,
    clarity: 5,
    pacing: 4,
    fit: 5,
    shortlisted: true,
    note: "Strong discovery mood; best fit for the glass-library reveal."
  },
  "submission-ari": {
    tone: 4,
    clarity: 4,
    pacing: 5,
    fit: 4,
    shortlisted: true,
    note: "Energetic serial pacing. Good sample for the action-heavy bounty."
  },
  "submission-mika": {
    tone: 5,
    clarity: 5,
    pacing: 4,
    fit: 5,
    shortlisted: true,
    note: "Cleanest award candidate; already selected in the seeded demo."
  }
};
const bountyTemplate = {
  title: "Night Train to Meridian",
  genre: "Noir fantasy",
  reward_sol: "0.21",
  full_project_budget_sol: "2.10",
  excerpt:
    "The train arrived without a whistle, carrying three passengers and a conductor who cast no shadow. Elias checked his ticket twice; the destination had changed to a city he had only dreamed.",
  author_wallet: "",
  cover_art: "/covers/orchid-clock.svg"
};
const submissionTemplate = {
  narrator_name: "Nova Vale",
  narrator_wallet: "",
  note: "Measured noir delivery with clear scene tension and a softer final line for the reveal."
};

export function MarketplaceApp() {
  const { publicKey, sendTransaction, connected } = useVoxWallet();
  const connection = useMemo(() => new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("devnet"), "confirmed"), []);
  const [state, setState] = useState<MarketplaceState | null>(null);
  const [demoRole, setDemoRole] = useState<DemoRole>("author");
  const [selectedBountyId, setSelectedBountyId] = useState<string>("");
  const [bountyForm, setBountyForm] = useState(initialBountyForm);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [submissionForm, setSubmissionForm] = useState(initialSubmissionForm);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string>("");
  const [audioMeta, setAudioMeta] = useState<AudioMeta | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [pendingAction, setPendingAction] = useState<string>("");
  const [recording, setRecording] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [blinkOrigin, setBlinkOrigin] = useState("");
  const [demoMode, setDemoMode] = useState(true);
  const [boardFilters, setBoardFilters] = useState<BoardFilters>(defaultBoardFilters);
  const [reviewState, setReviewState] = useState<ReviewState>({});
  const [manualVerifyForm, setManualVerifyForm] = useState<ManualVerifyForm>(initialManualVerifyForm);
  const [profileForm, setProfileForm] = useState<ProfileForm>(initialProfileForm);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setBlinkOrigin(window.location.origin);
    setReviewState(readReviewState());
    void refreshState();
  }, []);

  useEffect(() => {
    if (publicKey) {
      const wallet = publicKey.toBase58();
      setBountyForm((current) => ({ ...current, author_wallet: current.author_wallet || wallet }));
      setSubmissionForm((current) => ({ ...current, narrator_wallet: current.narrator_wallet || wallet }));
    }
  }, [publicKey]);

  useEffect(() => {
    const wallet = publicKey?.toBase58();
    if (!wallet) {
      setProfileForm(initialProfileForm);
      return;
    }

    const profile = state?.profiles.find((item) => item.wallet === wallet);
    setProfileForm({
      display_name: profile?.display_name || "",
      role: profile?.role || "both",
      bio: profile?.bio || ""
    });
  }, [publicKey, state?.profiles]);

  useEffect(() => {
    if (!audioFile) {
      setAudioPreview("");
      setAudioMeta(null);
      return;
    }

    const url = URL.createObjectURL(audioFile);
    setAudioPreview(url);
    setAudioMeta({
      name: audioFile.name,
      type: audioFile.type || "audio file",
      sizeMb: audioFile.size / 1024 / 1024,
      duration: null
    });

    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = url;
    audio.onloadedmetadata = () => {
      setAudioMeta((current) => (current ? { ...current, duration: Number.isFinite(audio.duration) ? audio.duration : null } : current));
    };

    return () => {
      audio.src = "";
      URL.revokeObjectURL(url);
    };
  }, [audioFile]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview("");
      return;
    }

    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  useEffect(() => {
    if (!recording || !recordingStartedAt) {
      return;
    }

    const timer = window.setInterval(() => {
      setRecordingSeconds(Math.floor((Date.now() - recordingStartedAt) / 1000));
    }, 500);

    return () => window.clearInterval(timer);
  }, [recording, recordingStartedAt]);

  async function refreshState() {
    const nextState = await loadMarketplaceState();
    setState(nextState);
    setSelectedBountyId((current) => current || nextState.bounties[0]?.id || "");
  }

  const selectedBounty = useMemo(() => state?.bounties.find((bounty) => bounty.id === selectedBountyId) || null, [selectedBountyId, state]);
  const selectedSubmissions = useMemo(
    () => (state?.submissions || []).filter((submission) => submission.bounty_id === selectedBountyId),
    [selectedBountyId, state]
  );
  const selectedPayments = useMemo(
    () => (state?.payments || []).filter((payment) => payment.bounty_id === selectedBountyId),
    [selectedBountyId, state]
  );
  useEffect(() => {
    if (!selectedSubmissions.length) {
      setManualVerifyForm((current) => (current.submission_id ? { ...current, submission_id: "" } : current));
      return;
    }

    setManualVerifyForm((current) => {
      if (selectedSubmissions.some((submission) => submission.id === current.submission_id)) {
        return current;
      }

      const selected = selectedSubmissions.find((submission) => submission.selected) || selectedSubmissions[0];
      return { ...current, submission_id: selected.id };
    });
  }, [selectedSubmissions]);
  const bountySubmissionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const submission of state?.submissions || []) {
      counts.set(submission.bounty_id, (counts.get(submission.bounty_id) || 0) + 1);
    }

    return counts;
  }, [state?.submissions]);
  const genres = useMemo(() => Array.from(new Set((state?.bounties || []).map((bounty) => bounty.genre))).sort(), [state?.bounties]);
  const filteredBounties = useMemo(() => {
    const query = boardFilters.query.trim().toLowerCase();
    const bounties = (state?.bounties || []).filter((bounty) => {
      const matchesQuery =
        !query ||
        [bounty.title, bounty.genre, bounty.excerpt, bounty.author_wallet].some((value) => value.toLowerCase().includes(query));
      const matchesGenre = boardFilters.genre === "all" || bounty.genre === boardFilters.genre;
      const matchesStatus = boardFilters.status === "all" || bounty.status === boardFilters.status;
      return matchesQuery && matchesGenre && matchesStatus;
    });

    return [...bounties].sort((a, b) => {
      if (boardFilters.sort === "reward_desc") {
        return b.reward_sol - a.reward_sol;
      }

      if (boardFilters.sort === "reward_asc") {
        return a.reward_sol - b.reward_sol;
      }

      if (boardFilters.sort === "most_auditions") {
        return (bountySubmissionCounts.get(b.id) || 0) - (bountySubmissionCounts.get(a.id) || 0);
      }

      return new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime();
    });
  }, [boardFilters, bountySubmissionCounts, state?.bounties]);
  const paymentStatusBySubmission = useMemo(() => {
    const map = new Map<string, PaymentStatus>();
    for (const payment of state?.payments || []) {
      if (payment.status === "verified" || !map.has(payment.submission_id)) {
        map.set(payment.submission_id, payment.status);
      }
    }

    return map;
  }, [state?.payments]);

  const stats = useMemo(() => {
    const bounties = state?.bounties.length || 0;
    const submissions = state?.submissions.length || 0;
    const volume = state?.payments.reduce((total, payment) => (payment.status === "verified" ? total + payment.amount_sol : total), 0) || 0;
    return { bounties, submissions, volume };
  }, [state]);
  const narratorProfiles = useMemo(() => buildNarratorProfiles(state, reviewState), [reviewState, state]);
  const connectedWallet = publicKey?.toBase58() || "";
  const accountWorkspace = useMemo(() => buildAccountWorkspace(state, connectedWallet), [connectedWallet, state]);
  const canManageSelectedBounty = isBountyAuthor(selectedBounty, connectedWallet);

  function canManageBounty(bounty: Bounty | null | undefined) {
    return isBountyAuthor(bounty, connectedWallet);
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const wallet = publicKey?.toBase58();
    if (!wallet) {
      setToast({ tone: "error", message: "Connect a wallet before saving a profile." });
      return;
    }

    setPendingAction("save-profile");
    try {
      await upsertProfile({
        wallet,
        display_name: profileForm.display_name,
        role: profileForm.role,
        bio: profileForm.bio
      });
      await refreshState();
      setToast({ tone: "success", message: "Profile saved for this wallet." });
    } catch (error) {
      setToast({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setPendingAction("");
    }
  }

  async function handleCreateBounty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!publicKey) {
      setToast({ tone: "error", message: "Connect a wallet before posting a bounty." });
      return;
    }

    if (!bountyForm.title.trim() || !bountyForm.excerpt.trim()) {
      setToast({ tone: "error", message: "Add a title and excerpt before posting." });
      return;
    }

    const auditionAwardSol = Number(bountyForm.reward_sol);
    const fullProjectBudgetSol = bountyForm.full_project_budget_sol.trim() ? Number(bountyForm.full_project_budget_sol) : null;

    if (!Number.isFinite(auditionAwardSol) || auditionAwardSol <= 0) {
      setToast({ tone: "error", message: "Audition award must be greater than zero." });
      return;
    }

    if (fullProjectBudgetSol !== null && (!Number.isFinite(fullProjectBudgetSol) || fullProjectBudgetSol <= 0)) {
      setToast({ tone: "error", message: "Full narration budget must be greater than zero or left blank." });
      return;
    }

    if (fullProjectBudgetSol !== null && fullProjectBudgetSol <= auditionAwardSol) {
      setToast({ tone: "error", message: "Full narration budget should be higher than the audition award." });
      return;
    }

    setPendingAction("create-bounty");
    try {
      const bounty = await createBounty({
        title: bountyForm.title.trim(),
        excerpt: bountyForm.excerpt.trim(),
        genre: bountyForm.genre.trim() || "Fiction",
        reward_sol: auditionAwardSol,
        full_project_budget_sol: fullProjectBudgetSol,
        author_wallet: publicKey.toBase58(),
        cover_art: bountyForm.cover_art
      }, coverFile);
      setBountyForm(initialBountyForm);
      setCoverFile(null);
      await refreshState();
      setSelectedBountyId(bounty.id);
      setToast({ tone: "success", message: "Bounty posted." });
    } catch (error) {
      setToast({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setPendingAction("");
    }
  }

  function handleAudioSelected(file: File | null) {
    if (!file) {
      setAudioFile(null);
      return;
    }

    if (!isAudioFile(file)) {
      setToast({ tone: "error", message: "Choose an audio file: WAV, MP3, M4A, OGG, or WebM." });
      return;
    }

    if (file.size > MAX_AUDIO_MB * 1024 * 1024) {
      setToast({ tone: "error", message: `Keep auditions under ${MAX_AUDIO_MB} MB for the hackathon demo.` });
      return;
    }

    setAudioFile(file);
  }

  function handleCoverSelected(file: File | null) {
    if (!file) {
      setCoverFile(null);
      return;
    }

    if (!isImageFile(file)) {
      setToast({ tone: "error", message: "Choose a cover image: PNG, JPG, WebP, GIF, or SVG." });
      return;
    }

    if (file.size > MAX_COVER_MB * 1024 * 1024) {
      setToast({ tone: "error", message: `Keep cover images under ${MAX_COVER_MB} MB for the demo.` });
      return;
    }

    setCoverFile(file);
  }

  function handleFillBountyTemplate() {
    setBountyForm({
      ...bountyTemplate,
      author_wallet: bountyForm.author_wallet || publicKey?.toBase58() || ""
    });
    setCoverFile(null);
    setToast({ tone: "info", message: "Bounty template loaded. You can edit it before posting." });
  }

  async function handleUseDemoAudition() {
    setPendingAction("demo-audio");
    try {
      const response = await fetch("/audio/demo-audition.wav");
      if (!response.ok) {
        throw new Error("Demo audition audio could not be loaded.");
      }

      const blob = await response.blob();
      handleAudioSelected(new File([blob], "project-vox-demo-audition.wav", { type: blob.type || "audio/wav" }));
      setToast({ tone: "success", message: "Demo audition audio loaded." });
    } catch (error) {
      setToast({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setPendingAction("");
    }
  }

  async function handleFillSubmissionTemplate() {
    setSubmissionForm({
      ...submissionTemplate,
      narrator_wallet: publicKey?.toBase58() || ""
    });

    if (!audioFile) {
      await handleUseDemoAudition();
      return;
    }

    setToast({ tone: "info", message: "Narrator draft loaded. You can edit it before submitting." });
  }

  async function handleCreateSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!publicKey) {
      setToast({ tone: "error", message: "Connect a wallet before submitting an audition." });
      return;
    }

    if (!selectedBounty || !audioFile) {
      setToast({ tone: "error", message: "Choose or record an audio audition first." });
      return;
    }

    setPendingAction("create-submission");
    try {
      await createSubmission(
        {
          bounty_id: selectedBounty.id,
          narrator_name: submissionForm.narrator_name.trim() || accountWorkspace.profile?.display_name || "Anonymous narrator",
          narrator_wallet: publicKey.toBase58(),
          note: submissionForm.note.trim()
        },
        audioFile
      );
      setSubmissionForm(initialSubmissionForm);
      setAudioFile(null);
      await refreshState();
      setToast({ tone: "success", message: "Audition submitted." });
    } catch (error) {
      setToast({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setPendingAction("");
    }
  }

  function updateReview(submissionId: string, patch: Partial<SubmissionReview>) {
    const submission = state?.submissions.find((item) => item.id === submissionId);
    const bounty = submission ? state?.bounties.find((item) => item.id === submission.bounty_id) : null;
    if (!canManageBounty(bounty)) {
      setToast({ tone: "error", message: "Only the bounty author wallet can grade or shortlist auditions." });
      return;
    }

    setReviewState((current) => {
      const next = {
        ...current,
        [submissionId]: {
          ...emptyReview(),
          ...current[submissionId],
          ...patch
        }
      };
      writeReviewState(next);
      return next;
    });
  }

  async function handleSelectSubmission(submission: Submission) {
    const bounty = state?.bounties.find((item) => item.id === submission.bounty_id) || null;
    if (!canManageBounty(bounty)) {
      setToast({ tone: "error", message: "Only the bounty author wallet can select a narrator." });
      return;
    }

    setPendingAction(`select-${submission.id}`);
    try {
      await markSubmissionSelected(submission.id, submission.bounty_id);
      await refreshState();
      setToast({ tone: "success", message: `${submission.narrator_name} selected for this bounty.` });
    } catch (error) {
      setToast({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setPendingAction("");
    }
  }

  async function handlePaySubmission(submission: Submission, bounty: Bounty) {
    if (!publicKey) {
      setToast({ tone: "error", message: "Connect a devnet wallet before paying." });
      return;
    }

    if (!canManageBounty(bounty)) {
      setToast({ tone: "error", message: "Only the bounty author wallet can pay the audition award." });
      return;
    }

    setPendingAction(`pay-${submission.id}`);
    const memo = paymentMemo(bounty.id, submission.id);

    try {
      const { transaction, lastValidBlockHeight } = await buildPaymentTransaction({
        connection,
        payer: publicKey,
        recipient: submission.narrator_wallet,
        amountSol: bounty.reward_sol,
        memo
      });

      const signature = await sendTransaction(transaction, connection);

      try {
        await connection.confirmTransaction(
          {
            signature,
            blockhash: transaction.recentBlockhash || "",
            lastValidBlockHeight
          },
          "confirmed"
        );
      } catch {
        setToast({ tone: "info", message: "Transaction sent. Verification will decide whether it can be marked paid." });
      }

      const verification = await verifyPayment({
        tx_signature: signature,
        bounty_id: bounty.id,
        submission_id: submission.id
      });

      if (!verification.persisted) {
        await recordPayment({
          bounty_id: bounty.id,
          submission_id: submission.id,
          payer_wallet: verification.payer_wallet || publicKey.toBase58(),
          recipient_wallet: verification.recipient_wallet || submission.narrator_wallet,
          amount_sol: verification.amount_sol || bounty.reward_sol,
          tx_signature: signature,
          memo: verification.memo || memo,
          status: verification.status,
          verified_at: verification.verified_at,
          verification_error: verification.verification_error
        });
      }

      await refreshState();
      setToast({
        tone: verification.status === "verified" ? "success" : verification.status === "pending_verification" ? "info" : "error",
        message:
          verification.status === "verified"
            ? `Audition award verified: ${signature.slice(0, 10)}...`
            : verification.verification_error || `Payment recorded as ${verification.status}.`
      });
    } catch (error) {
      setToast({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setPendingAction("");
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setToast({ tone: "error", message: "This browser does not support microphone recording." });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        handleAudioSelected(new File([blob], `project-vox-audition-${Date.now()}.webm`, { type }));
        streamRef.current?.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      setRecording(true);
      setRecordingStartedAt(Date.now());
      setRecordingSeconds(0);
    } catch (error) {
      setToast({ tone: "error", message: getErrorMessage(error) });
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    setRecordingStartedAt(null);
  }

  async function copyBlinkLink(submissionId: string) {
    const link = `${blinkOrigin}/tip/${submissionId}`;
    try {
      await navigator.clipboard.writeText(link);
      setToast({ tone: "success", message: "Share page link copied." });
    } catch {
      setToast({ tone: "info", message: link });
    }
  }

  async function handleRetryVerification(payment: Payment) {
    const bounty = state?.bounties.find((item) => item.id === payment.bounty_id) || null;
    const wallet = publicKey?.toBase58() || "";
    if (!wallet || (payment.payer_wallet !== wallet && payment.recipient_wallet !== wallet && !isBountyAuthor(bounty, wallet))) {
      setToast({ tone: "error", message: "Connect as the payer, recipient, or bounty author to retry this receipt." });
      return;
    }

    setPendingAction(`verify-${payment.id}`);
    try {
      const verification = await verifyPayment({
        tx_signature: payment.tx_signature,
        bounty_id: payment.bounty_id,
        submission_id: payment.submission_id
      });

      if (!verification.persisted) {
        await updatePaymentVerification(payment.id, payment.bounty_id, verification);
      }
      await refreshState();
      setToast({
        tone: verification.status === "verified" ? "success" : verification.status === "pending_verification" ? "info" : "error",
        message: verification.status === "verified" ? "Receipt verified." : verification.verification_error || `Receipt is ${verification.status}.`
      });
    } catch (error) {
      setToast({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setPendingAction("");
    }
  }

  async function handleManualVerifyReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedBounty) {
      setToast({ tone: "error", message: "Select a bounty before verifying a receipt." });
      return;
    }

    if (!canManageBounty(selectedBounty)) {
      setToast({ tone: "error", message: "Only the bounty author wallet can manually verify award receipts." });
      return;
    }

    const submission = selectedSubmissions.find((item) => item.id === manualVerifyForm.submission_id);
    if (!submission) {
      setToast({ tone: "error", message: "Choose the audition this transaction should pay." });
      return;
    }

    const txSignature = manualVerifyForm.tx_signature.trim();
    if (!txSignature) {
      setToast({ tone: "error", message: "Paste a devnet transaction signature first." });
      return;
    }

    setPendingAction("manual-verify");
    try {
      const verification = await verifyPayment({
        tx_signature: txSignature,
        bounty_id: selectedBounty.id,
        submission_id: submission.id
      });

      if (!verification.persisted) {
        const existingPayment = state?.payments.find((payment) => payment.tx_signature === txSignature);
        if (existingPayment) {
          await updatePaymentVerification(existingPayment.id, existingPayment.bounty_id, verification);
        } else {
          await recordPayment({
            bounty_id: selectedBounty.id,
            submission_id: submission.id,
            payer_wallet: verification.payer_wallet || publicKey?.toBase58() || "",
            recipient_wallet: verification.recipient_wallet || submission.narrator_wallet,
            amount_sol: verification.amount_sol || selectedBounty.reward_sol,
            tx_signature: txSignature,
            memo: verification.memo || paymentMemo(selectedBounty.id, submission.id),
            status: verification.status,
            verified_at: verification.verified_at,
            verification_error: verification.verification_error
          });
        }
      }

      setManualVerifyForm((current) => ({ ...current, tx_signature: "" }));
      await refreshState();
      setToast({
        tone: verification.status === "verified" ? "success" : verification.status === "pending_verification" ? "info" : "error",
        message:
          verification.status === "verified"
            ? "Manual receipt verified."
            : verification.verification_error || `Receipt recorded as ${verification.status}.`
      });
    } catch (error) {
      setToast({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setPendingAction("");
    }
  }

  async function handleResetDemo() {
    const nextState = resetLocalDemoState();
    setState(nextState);
    setSelectedBountyId(nextState.bounties[0]?.id || "");
    setBountyForm(initialBountyForm);
    setSubmissionForm(initialSubmissionForm);
    setAudioFile(null);
    setBoardFilters(defaultBoardFilters);
    setReviewState(seededReviewState);
    writeReviewState(seededReviewState);
    setManualVerifyForm(initialManualVerifyForm);
    setToast({ tone: "success", message: "Local demo state reset. Supabase data was not changed." });
  }

  function navigateToSection(sectionId: string, role?: DemoRole) {
    if (role) {
      setDemoRole(role);
    }

    window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (!state) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white/70 px-5 py-4 shadow-line">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-bold">Loading Project Vox</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-5 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-ink/10 bg-white/70 p-4 shadow-line backdrop-blur xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-ink text-paper">
              <Headphones className="h-6 w-6" />
            </div>
            <div>
              <p className="font-serif text-2xl font-semibold leading-none">Project Vox</p>
              <p className="text-sm font-medium text-ink/60">Audiobook narration bounties on Solana devnet</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <TopNav onNavigate={navigateToSection} />
            <WalletControls />
          </div>
        </header>

        <ProductLaunchPanel
          stats={stats}
          connected={connected}
          publicKey={publicKey?.toBase58() || ""}
          profile={accountWorkspace.profile}
          onBrowse={() => navigateToSection("bounty-board", "fan")}
          onAuthor={() => navigateToSection("create-bounty", "author")}
          onNarrator={() => navigateToSection("submit-audition", "narrator")}
        />

        <AccountWorkspacePanel
          connected={connected}
          wallet={publicKey?.toBase58() || ""}
          workspace={accountWorkspace}
          profileForm={profileForm}
          pending={pendingAction === "save-profile"}
          onProfileChange={(patch) => setProfileForm((current) => ({ ...current, ...patch }))}
          onSaveProfile={handleSaveProfile}
          onAuthor={() => navigateToSection("create-bounty", "author")}
          onNarrator={() => navigateToSection("submit-audition", "narrator")}
          onOpenBounty={(bountyId) => {
            setSelectedBountyId(bountyId);
            navigateToSection("bounty-detail");
          }}
        />

        {demoMode ? <RoleSwitch role={demoRole} onChange={setDemoRole} /> : null}

        {toast ? (
          <div
            className={`flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-sm font-semibold shadow-line ${
              toast.tone === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : toast.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-blue-200 bg-blue-50 text-blue-800"
            }`}
          >
            <span>{toast.message}</span>
            <button className="text-current opacity-70 hover:opacity-100" onClick={() => setToast(null)}>
              Dismiss
            </button>
          </div>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-5">
            <DemoModePanel enabled={demoMode} onToggle={() => setDemoMode((current) => !current)} onReset={() => void handleResetDemo()} />
            {demoMode ? (
              <DemoToolkitPanel
                pendingAction={pendingAction}
                onFillBountyTemplate={handleFillBountyTemplate}
                onFillSubmissionTemplate={() => void handleFillSubmissionTemplate()}
                onUseDemoAudition={() => void handleUseDemoAudition()}
              />
            ) : null}

            <StudioProofPanel />

            <Panel id="bounty-board" className={`scroll-mt-5 ${demoMode && demoRole === "fan" ? "ring-2 ring-vox/20" : ""}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-ink/50">Bounty board</h2>
                <Filter className="h-4 w-4 text-clay" />
              </div>
              <BoardControls
                filters={boardFilters}
                genres={genres}
                shown={filteredBounties.length}
                total={state.bounties.length}
                onChange={(patch) => setBoardFilters((current) => ({ ...current, ...patch }))}
                onClear={() => setBoardFilters(defaultBoardFilters)}
              />
              <div className="mt-4 flex flex-col gap-2">
                {filteredBounties.length ? (
                  filteredBounties.map((bounty) => (
                    <button
                      key={bounty.id}
                      className={`group rounded-lg border p-3 text-left transition ${
                        bounty.id === selectedBountyId
                          ? "border-ink bg-ink text-paper shadow-soft"
                          : "border-ink/10 bg-white/60 hover:border-ink/30 hover:bg-white"
                      }`}
                      onClick={() => setSelectedBountyId(bounty.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Image src={bounty.cover_art || "/covers/river-manual.svg"} width={48} height={64} alt="" className="rounded-md border border-black/10" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-sm font-black">{bounty.title}</p>
                            <span className={`text-xs font-black ${bounty.id === selectedBountyId ? "text-paper/70" : "text-clay"}`}>
                              {bounty.reward_sol.toFixed(2)} SOL audition
                            </span>
                          </div>
                          <p className={`mt-1 text-xs font-semibold ${bounty.id === selectedBountyId ? "text-paper/60" : "text-ink/50"}`}>
                            {bounty.genre} / {bounty.status} / {bountySubmissionCounts.get(bounty.id) || 0} takes
                          </p>
                          <p className={`mt-1 text-xs font-bold ${bounty.id === selectedBountyId ? "text-paper/60" : "text-ink/45"}`}>
                            Full project: {formatOptionalSol(bounty.full_project_budget_sol)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-ink/20 bg-white/60 p-5 text-center">
                    <Search className="mx-auto h-6 w-6 text-clay" />
                    <p className="mt-2 text-sm font-black">No bounties match</p>
                    <p className="mt-1 text-xs font-semibold text-ink/50">Clear filters or post a new bounty.</p>
                  </div>
                )}
              </div>
            </Panel>

            <Panel id="create-bounty" className={`scroll-mt-5 ${demoMode && demoRole === "author" ? "ring-2 ring-clay/25" : ""}`}>
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-clay" />
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-ink/50">Post a bounty</h2>
              </div>
              {demoMode ? (
                <button
                  type="button"
                  className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-ink/10 bg-paper px-3 text-sm font-black text-ink transition hover:border-ink/30 hover:bg-white"
                  onClick={handleFillBountyTemplate}
                >
                  <Wand2 className="h-4 w-4" />
                  Fill judge template
                </button>
              ) : null}
              <form className={`${demoMode ? "mt-4" : "mt-3"} flex flex-col gap-3`} onSubmit={handleCreateBounty}>
                <TextInput label="Title" value={bountyForm.title} onChange={(value) => setBountyForm((current) => ({ ...current, title: value }))} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <TextInput label="Genre" value={bountyForm.genre} onChange={(value) => setBountyForm((current) => ({ ...current, genre: value }))} />
                  <TextInput
                    label="Audition award SOL"
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={bountyForm.reward_sol}
                    onChange={(value) => setBountyForm((current) => ({ ...current, reward_sol: value }))}
                  />
                  <TextInput
                    label="Full budget SOL"
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={bountyForm.full_project_budget_sol}
                    onChange={(value) => setBountyForm((current) => ({ ...current, full_project_budget_sol: value }))}
                  />
                </div>
                <TextArea label="Excerpt" value={bountyForm.excerpt} onChange={(value) => setBountyForm((current) => ({ ...current, excerpt: value }))} />
                <BountyCoverControl
                  selectedCover={bountyForm.cover_art}
                  preview={coverPreview || bountyForm.cover_art}
                  hasUpload={Boolean(coverFile)}
                  onPreset={(value) => {
                    setCoverFile(null);
                    setBountyForm((current) => ({ ...current, cover_art: value }));
                  }}
                  onUpload={handleCoverSelected}
                  onClearUpload={() => setCoverFile(null)}
                />
                <div>
                  <ConnectedWalletField label="Author wallet" wallet={connectedWallet} empty="Connect wallet to post bounties." />
                </div>
                <Button disabled={pendingAction === "create-bounty"} icon={<Plus className="h-4 w-4" />} type="submit">
                  Post bounty
                </Button>
              </form>
            </Panel>

            <WhySolanaPanel />
            <NarratorDirectoryPanel profiles={narratorProfiles} onOpenBounty={setSelectedBountyId} />
          </aside>

          <section className="flex min-w-0 flex-col gap-5">
            {selectedBounty ? (
              <BountyDetail
                bounty={selectedBounty}
                submissions={selectedSubmissions}
                payments={selectedPayments}
                paymentStatusBySubmission={paymentStatusBySubmission}
                pendingAction={pendingAction}
                connected={connected}
                canManageBounty={canManageSelectedBounty}
                blinkOrigin={blinkOrigin}
                reviews={reviewState}
                manualVerifyForm={manualVerifyForm}
                onSelect={handleSelectSubmission}
                onPay={handlePaySubmission}
                onCopyBlink={copyBlinkLink}
                onReviewChange={updateReview}
                onRetryVerification={handleRetryVerification}
                onManualVerifyFormChange={(patch) => setManualVerifyForm((current) => ({ ...current, ...patch }))}
                onManualVerify={handleManualVerifyReceipt}
              />
            ) : null}

            <Panel id="submit-audition" className={`scroll-mt-5 ${demoMode && demoRole === "narrator" ? "ring-2 ring-sage/25" : ""}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-serif text-2xl font-semibold">Submit an audition</h2>
                  <p className="text-sm font-medium text-ink/60">Upload a take or record one in the browser.</p>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-sage/10 px-3 py-2 text-xs font-black text-sage">
                  <Wallet className="h-4 w-4" />
                  {publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : "Wallet optional for draft"}
                </div>
              </div>

              <form className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" onSubmit={handleCreateSubmission}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextInput
                    label="Narrator name"
                    value={submissionForm.narrator_name}
                    onChange={(value) => setSubmissionForm((current) => ({ ...current, narrator_name: value }))}
                  />
                  <TextInput
                    label="Narrator wallet"
                    value={connectedWallet || "Connect wallet to submit"}
                    onChange={() => undefined}
                    disabled
                  />
                  <div className="sm:col-span-2">
                    <TextArea
                      label="Direction note"
                      value={submissionForm.note}
                      onChange={(value) => setSubmissionForm((current) => ({ ...current, note: value }))}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-ink/10 bg-paper/70 p-3">
                  <div className="grid gap-2">
                    {demoMode ? (
                      <button
                        type="button"
                        className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-vox/20 bg-vox/10 px-3 text-sm font-black text-vox transition hover:border-vox/40 hover:bg-vox/15 disabled:opacity-50"
                        disabled={pendingAction === "demo-audio"}
                        onClick={() => void handleFillSubmissionTemplate()}
                      >
                        {pendingAction === "demo-audio" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                        Use demo take
                      </button>
                    ) : null}
                    <label className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-dashed border-ink/30 bg-white px-3 text-sm font-black text-ink/70 transition hover:border-ink">
                      <Upload className="h-4 w-4" />
                      Upload audio
                      <input
                        className="sr-only"
                        type="file"
                        accept="audio/*"
                        onChange={(event) => {
                          handleAudioSelected(event.currentTarget.files?.[0] || null);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className={`flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 text-sm font-black transition ${
                        recording ? "bg-clay text-paper" : "bg-ink text-paper hover:bg-ink/90"
                      }`}
                      onClick={recording ? stopRecording : startRecording}
                    >
                      <Mic className="h-4 w-4" />
                      {recording ? "Stop recording" : "Record audition"}
                    </button>
                  </div>
                  <AudioPreviewCard
                    audioPreview={audioPreview}
                    audioMeta={audioMeta}
                    recording={recording}
                    recordingSeconds={recordingSeconds}
                    onClear={() => setAudioFile(null)}
                  />
                  <Button disabled={pendingAction === "create-submission"} icon={<Send className="h-4 w-4" />} type="submit" className="mt-3 w-full">
                    Submit audition
                  </Button>
                </div>
              </form>
            </Panel>
          </section>
        </section>
      </div>
    </main>
  );
}

function TopNav({ onNavigate }: { onNavigate: (sectionId: string, role?: DemoRole) => void }) {
  const items: Array<{ label: string; sectionId: string; role?: DemoRole }> = [
    { label: "Dashboard", sectionId: "dashboard" },
    { label: "Workspace", sectionId: "workspace" },
    { label: "Bounties", sectionId: "bounty-board", role: "fan" },
    { label: "Author", sectionId: "create-bounty", role: "author" },
    { label: "Narrator", sectionId: "submit-audition", role: "narrator" },
    { label: "Receipts", sectionId: "bounty-detail" }
  ];

  return (
    <nav className="flex flex-wrap items-center gap-1 rounded-lg border border-ink/10 bg-paper p-1" aria-label="Project Vox navigation">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className="min-h-9 rounded-md px-3 text-sm font-black text-ink/65 transition hover:bg-white hover:text-ink"
          onClick={() => onNavigate(item.sectionId, item.role)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function ProductLaunchPanel({
  stats,
  connected,
  publicKey,
  profile,
  onBrowse,
  onAuthor,
  onNarrator
}: {
  stats: { bounties: number; submissions: number; volume: number };
  connected: boolean;
  publicKey: string;
  profile: VoxProfile | null;
  onBrowse: () => void;
  onAuthor: () => void;
  onNarrator: () => void;
}) {
  return (
    <section id="dashboard" className="relative scroll-mt-5 overflow-hidden rounded-lg border border-ink/10 bg-ink text-paper shadow-line">
      <Image
        src="/studio/vox-recording-close.jpg"
        alt="Recording microphone in a dark vocal booth"
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 1280px"
        className="object-cover object-[68%_center]"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/95 via-ink/70 to-ink/5" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-transparent to-ink/15" />

      <div className="relative grid min-h-[560px] gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.35fr)_360px] lg:items-end">
        <div className="max-w-3xl py-8 sm:py-12">
          <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-paper/15 bg-paper/10 px-3 py-2 text-xs font-black text-paper/80 backdrop-blur">
            <Headphones className="h-4 w-4" />
            Project Vox
          </div>
          <h1 className="font-serif text-4xl font-semibold leading-none sm:text-6xl lg:text-7xl">
            Hire audiobook voices. Pay the selected audition on-chain.
          </h1>
          <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-paper/72 sm:text-lg">
            Authors publish a short excerpt, narrators submit real audio, and verified devnet receipts link payment to the chosen take.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-paper px-4 text-sm font-black text-ink transition hover:bg-white"
              onClick={onAuthor}
            >
              <Plus className="h-4 w-4" />
              Post bounty
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-paper/20 bg-paper/10 px-4 text-sm font-black text-paper transition hover:border-paper/40 hover:bg-paper/20"
              onClick={onNarrator}
            >
              <Mic className="h-4 w-4" />
              Submit audition
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-paper/15 bg-ink/30 px-4 text-sm font-black text-paper/80 transition hover:border-paper/40 hover:text-paper"
              onClick={onBrowse}
            >
              <Search className="h-4 w-4" />
              Browse bounties
            </button>
          </div>
          <div className="mt-8 grid gap-4 border-t border-paper/15 pt-5 sm:grid-cols-3">
            <HeroStep icon={<BookOpen className="h-4 w-4" />} title="Author posts" detail="Audition award plus full narration budget." />
            <HeroStep icon={<FileAudio2 className="h-4 w-4" />} title="Narrator auditions" detail="Audio take, note, and payout wallet." />
            <HeroStep icon={<ReceiptText className="h-4 w-4" />} title="Receipt verifies" detail="Recipient, amount, and memo checked server-side." />
          </div>
        </div>

        <div className="rounded-lg border border-paper/20 bg-paper/95 p-4 text-ink shadow-soft backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink text-paper">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-ink/45">Account</p>
              <p className="mt-1 truncate text-sm font-black">{connected ? profile?.display_name || truncateWallet(publicKey) : "No wallet connected"}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-ink/55">Wallet connection is the login layer for this MVP.</p>
            </div>
          </div>
          <div className="mt-4">
            <WalletControls />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Metric label="Bounties" value={`${stats.bounties}`} />
            <Metric label="Auditions" value={`${stats.submissions}`} />
            <Metric label="Paid" value={`${stats.volume.toFixed(2)}`} />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroStep({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-black">
        <span className="text-paper/70">{icon}</span>
        {title}
      </div>
      <p className="mt-2 text-xs font-semibold leading-5 text-paper/60">{detail}</p>
    </div>
  );
}

function StudioProofPanel() {
  return (
    <Panel className="overflow-hidden p-0">
      <div className="relative aspect-[16/10] bg-ink">
        <Image
          src="/studio/vox-recording-wide.jpg"
          alt="Wide shot of a studio microphone and ring light"
          fill
          sizes="360px"
          className="object-cover object-[70%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-paper">
          <p className="text-xs font-black uppercase text-paper/60">Studio workflow</p>
          <h2 className="mt-1 font-serif text-2xl font-semibold leading-none">Real voices, real receipts.</h2>
        </div>
      </div>
      <div className="p-4">
        <p className="text-sm font-semibold leading-6 text-ink/60">
          Bounties start with a short audition and can lead into the full narration budget after the author selects a voice.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Metric label="Network" value="Devnet" />
          <Metric label="Escrow" value="No" />
          <Metric label="Memo" value="Yes" />
        </div>
      </div>
    </Panel>
  );
}

function ConnectedWalletField({ label, wallet, empty }: { label: string; wallet: string; empty: string }) {
  return (
    <div className="block">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-ink/50">{label}</span>
      <div className="mt-1 rounded-lg border border-ink/10 bg-paper px-3 py-3 text-sm font-semibold leading-5 text-ink/65">
        {wallet ? <span className="break-all">{wallet}</span> : <span>{empty}</span>}
      </div>
    </div>
  );
}

function AccountWorkspacePanel({
  connected,
  wallet,
  workspace,
  profileForm,
  pending,
  onProfileChange,
  onSaveProfile,
  onAuthor,
  onNarrator,
  onOpenBounty
}: {
  connected: boolean;
  wallet: string;
  workspace: AccountWorkspace;
  profileForm: ProfileForm;
  pending: boolean;
  onProfileChange: (patch: Partial<ProfileForm>) => void;
  onSaveProfile: (event: FormEvent<HTMLFormElement>) => void;
  onAuthor: () => void;
  onNarrator: () => void;
  onOpenBounty: (bountyId: string) => void;
}) {
  return (
    <section id="workspace" className="scroll-mt-5 rounded-lg border border-ink/10 bg-white/80 p-5 shadow-line backdrop-blur">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="font-serif text-3xl font-semibold leading-none">My workspace</h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-ink/60">
            Wallet login turns this into an account view: profile, authored bounties, narrator auditions, and payment receipts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-ink/10 bg-paper px-3 text-sm font-black text-ink transition hover:border-ink/30 hover:bg-white"
            onClick={onAuthor}
          >
            <Plus className="h-4 w-4" />
            New bounty
          </button>
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-ink/10 bg-paper px-3 text-sm font-black text-ink transition hover:border-ink/30 hover:bg-white"
            onClick={onNarrator}
          >
            <Mic className="h-4 w-4" />
            New audition
          </button>
        </div>
      </div>

      {!connected ? (
        <div className="mt-5 grid gap-4 rounded-lg border border-dashed border-ink/20 bg-paper/70 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-ink/50">Connect to unlock account tools</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-ink/60">
              The marketplace works as a wallet-first product. Connect Phantom or Solflare to save a profile and see only your work.
            </p>
          </div>
          <WalletControls />
        </div>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <form className="rounded-lg border border-ink/10 bg-paper/70 p-4" onSubmit={onSaveProfile}>
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink text-paper">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black uppercase tracking-[0.14em] text-ink/50">Profile</h3>
                <p className="mt-1 break-all text-xs font-bold text-ink/45">{wallet}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <TextInput label="Display name" value={profileForm.display_name} onChange={(value) => onProfileChange({ display_name: value })} />
              <SelectInput
                label="Marketplace role"
                value={profileForm.role}
                onChange={(value) => onProfileChange({ role: value as ProfileRole })}
                options={[
                  { label: "Author", value: "author" },
                  { label: "Narrator", value: "narrator" },
                  { label: "Author and narrator", value: "both" }
                ]}
              />
              <TextArea label="Bio" value={profileForm.bio} onChange={(value) => onProfileChange({ bio: value })} />
              <Button disabled={pending} icon={<Check className="h-4 w-4" />} type="submit">
                Save profile
              </Button>
            </div>
          </form>

          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label="My bounties" value={`${workspace.authoredBounties.length}`} />
              <Metric label="My auditions" value={`${workspace.narratorSubmissions.length}`} />
              <Metric label="Earned" value={`${workspace.verifiedIncomingSol.toFixed(2)}`} />
              <Metric label="Paid out" value={`${workspace.verifiedOutgoingSol.toFixed(2)}`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <AccountList title="Authored bounties" empty="Create a bounty to see it here.">
                {workspace.authoredBounties.map((bounty) => (
                  <button
                    key={bounty.id}
                    type="button"
                    className="rounded-lg border border-ink/10 bg-white px-3 py-2 text-left transition hover:border-ink/30"
                    onClick={() => onOpenBounty(bounty.id)}
                  >
                    <span className="block truncate text-sm font-black">{bounty.title}</span>
                    <span className="mt-1 block text-xs font-bold text-ink/50">
                      {bounty.status} / {bounty.reward_sol.toFixed(2)} SOL award / {formatOptionalSol(bounty.full_project_budget_sol)} full
                    </span>
                  </button>
                ))}
              </AccountList>

              <AccountList title="Narrator auditions" empty="Submit an audition to see it here.">
                {workspace.narratorSubmissions.map(({ submission, bounty }) => (
                  <button
                    key={submission.id}
                    type="button"
                    className="rounded-lg border border-ink/10 bg-white px-3 py-2 text-left transition hover:border-ink/30"
                    onClick={() => bounty && onOpenBounty(bounty.id)}
                  >
                    <span className="block truncate text-sm font-black">{bounty?.title || "Unknown bounty"}</span>
                    <span className="mt-1 block text-xs font-bold text-ink/50">
                      {submission.selected ? "Selected" : "Submitted"} / {bounty ? `${bounty.reward_sol.toFixed(2)} SOL award` : "No award data"}
                    </span>
                  </button>
                ))}
              </AccountList>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <AccountList title="Incoming receipts" empty="Verified narrator payments will appear here.">
                {workspace.incomingPayments.map((payment) => (
                  <a
                    key={payment.id}
                    href={explorerTxUrl(payment.tx_signature)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-ink/10 bg-white px-3 py-2 transition hover:border-ink/30"
                  >
                    <span className="block truncate text-sm font-black">{payment.amount_sol.toFixed(2)} SOL received</span>
                    <span className="mt-1 block text-xs font-bold text-ink/50">{receiptStatusLabel(payment.status, payment.verification_error)}</span>
                  </a>
                ))}
              </AccountList>

              <AccountList title="Outgoing receipts" empty="Author payments you send will appear here.">
                {workspace.outgoingPayments.map((payment) => (
                  <a
                    key={payment.id}
                    href={explorerTxUrl(payment.tx_signature)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-ink/10 bg-white px-3 py-2 transition hover:border-ink/30"
                  >
                    <span className="block truncate text-sm font-black">{payment.amount_sol.toFixed(2)} SOL paid</span>
                    <span className="mt-1 block text-xs font-bold text-ink/50">{receiptStatusLabel(payment.status, payment.verification_error)}</span>
                  </a>
                ))}
              </AccountList>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AccountList({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const hasItems = Boolean(children) && (!Array.isArray(children) || children.length > 0);

  return (
    <div className="rounded-lg border border-ink/10 bg-paper/70 p-3">
      <h3 className="text-xs font-black uppercase tracking-[0.14em] text-ink/50">{title}</h3>
      <div className="mt-3 grid gap-2">
        {hasItems ? children : <div className="rounded-lg border border-dashed border-ink/20 bg-white/70 p-4 text-sm font-semibold text-ink/50">{empty}</div>}
      </div>
    </div>
  );
}

function BoardControls({
  filters,
  genres,
  shown,
  total,
  onChange,
  onClear
}: {
  filters: BoardFilters;
  genres: string[];
  shown: number;
  total: number;
  onChange: (patch: Partial<BoardFilters>) => void;
  onClear: () => void;
}) {
  return (
    <div className="mt-4 rounded-lg border border-ink/10 bg-paper/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-ink/50">
          <SlidersHorizontal className="h-4 w-4 text-clay" />
          Discover
        </div>
        <span className="text-xs font-black text-ink/50">
          {shown}/{total}
        </span>
      </div>
      <label className="mt-3 flex h-10 items-center gap-2 rounded-lg border border-ink/10 bg-white px-3 text-sm font-semibold focus-within:border-ink">
        <Search className="h-4 w-4 text-ink/40" />
        <input
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink/35"
          value={filters.query}
          placeholder="Search title, genre, excerpt"
          onChange={(event) => onChange({ query: event.currentTarget.value })}
        />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <SelectInput
          label="Genre"
          value={filters.genre}
          onChange={(value) => onChange({ genre: value })}
          options={[{ label: "All genres", value: "all" }, ...genres.map((genre) => ({ label: genre, value: genre }))]}
        />
        <SelectInput
          label="Status"
          value={filters.status}
          onChange={(value) => onChange({ status: value as BoardStatusFilter })}
          options={[
            { label: "All status", value: "all" },
            { label: "Open", value: "open" },
            { label: "Awarded", value: "awarded" },
            { label: "Paid", value: "paid" }
          ]}
        />
      </div>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <SelectInput
          label="Sort"
          value={filters.sort}
          onChange={(value) => onChange({ sort: value as BoardSort })}
          options={[
            { label: "Newest", value: "newest" },
            { label: "Highest award", value: "reward_desc" },
            { label: "Lowest award", value: "reward_asc" },
            { label: "Most auditions", value: "most_auditions" }
          ]}
        />
        <button
          type="button"
          className="self-end rounded-lg border border-ink/10 bg-white px-3 text-xs font-black text-ink/60 transition hover:border-ink/30 hover:text-ink"
          onClick={onClear}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function RoleSwitch({ role, onChange }: { role: DemoRole; onChange: (role: DemoRole) => void }) {
  const activeGuide = roleGuides[role];

  return (
    <section className="rounded-lg border border-ink/10 bg-white/75 p-4 shadow-line backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-ink/45">
            <Users className="h-4 w-4 text-vox" />
            Demo role
          </div>
          <h2 className="mt-2 font-serif text-2xl font-semibold">{activeGuide.headline}</h2>
          <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-ink/65">{activeGuide.description}</p>
          <p className="mt-2 text-xs font-black text-clay">{activeGuide.primaryAction}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
          {demoRoles.map((roleOption) => {
            const guide = roleGuides[roleOption];
            const active = roleOption === role;
            return (
              <button
                key={roleOption}
                type="button"
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-black transition ${
                  active ? "border-ink bg-ink text-paper shadow-line" : "border-ink/10 bg-paper text-ink hover:border-ink/30 hover:bg-white"
                }`}
                onClick={() => onChange(roleOption)}
              >
                {guide.icon}
                {guide.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-vox/15 bg-vox/5 px-3 py-2 text-xs font-semibold leading-5 text-ink/65">
        No account is required for this hackathon build. The connected wallet is the payment identity, and this switch clarifies which workflow you are demoing.
      </div>
    </section>
  );
}

function BountyCoverControl({
  selectedCover,
  preview,
  hasUpload,
  onPreset,
  onUpload,
  onClearUpload
}: {
  selectedCover: string;
  preview: string;
  hasUpload: boolean;
  onPreset: (value: string) => void;
  onUpload: (file: File | null) => void;
  onClearUpload: () => void;
}) {
  return (
    <div className="rounded-lg border border-ink/10 bg-paper/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-ink/50">
          <ImageIcon className="h-4 w-4 text-clay" />
          Book cover
        </span>
        {hasUpload ? (
          <button type="button" className="text-xs font-black text-clay transition hover:text-ink" onClick={onClearUpload}>
            Use preset
          </button>
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-[76px_minmax(0,1fr)] gap-3">
        <div
          className="h-24 rounded-lg border border-ink/10 bg-cover bg-center shadow-line"
          style={{ backgroundImage: `url("${preview || "/covers/river-manual.svg"}")` }}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <div className="grid grid-cols-3 gap-2">
            {coverPresets.map((cover) => (
              <button
                key={cover.value}
                type="button"
                className={`h-14 rounded-lg border bg-cover bg-center transition ${
                  !hasUpload && selectedCover === cover.value ? "border-ink ring-2 ring-clay/30" : "border-ink/10 hover:border-ink/30"
                }`}
                style={{ backgroundImage: `url("${cover.value}")` }}
                aria-label={`Use ${cover.label} cover`}
                onClick={() => onPreset(cover.value)}
              />
            ))}
          </div>
          <label className="mt-2 flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-ink/30 bg-white px-3 text-xs font-black text-ink/70 transition hover:border-ink">
            <Upload className="h-3.5 w-3.5" />
            Upload cover
            <input
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              onChange={(event) => {
                onUpload(event.currentTarget.files?.[0] || null);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function DemoToolkitPanel({
  pendingAction,
  onFillBountyTemplate,
  onFillSubmissionTemplate,
  onUseDemoAudition
}: {
  pendingAction: string;
  onFillBountyTemplate: () => void;
  onFillSubmissionTemplate: () => void;
  onUseDemoAudition: () => void;
}) {
  return (
    <Panel>
      <div className="flex items-center gap-2">
        <Wand2 className="h-4 w-4 text-vox" />
        <h2 className="text-sm font-black uppercase tracking-[0.16em] text-ink/50">Demo shortcuts</h2>
      </div>
      <div className="mt-4 grid gap-2">
        <IconButton type="button" icon={<Plus className="h-4 w-4" />} label="Fill bounty draft" onClick={onFillBountyTemplate} />
        <IconButton
          type="button"
          disabled={pendingAction === "demo-audio"}
          icon={pendingAction === "demo-audio" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileAudio2 className="h-4 w-4" />}
          label="Load sample audio"
          onClick={onUseDemoAudition}
        />
        <IconButton
          type="button"
          disabled={pendingAction === "demo-audio"}
          icon={pendingAction === "demo-audio" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
          label="Fill narrator draft"
          onClick={onFillSubmissionTemplate}
        />
      </div>
    </Panel>
  );
}

function BountyDetail({
  bounty,
  submissions,
  payments,
  paymentStatusBySubmission,
  pendingAction,
  connected,
  canManageBounty,
  blinkOrigin,
  reviews,
  manualVerifyForm,
  onSelect,
  onPay,
  onCopyBlink,
  onReviewChange,
  onRetryVerification,
  onManualVerifyFormChange,
  onManualVerify
}: {
  bounty: Bounty;
  submissions: Submission[];
  payments: MarketplaceState["payments"];
  paymentStatusBySubmission: Map<string, PaymentStatus>;
  pendingAction: string;
  connected: boolean;
  canManageBounty: boolean;
  blinkOrigin: string;
  reviews: ReviewState;
  manualVerifyForm: ManualVerifyForm;
  onSelect: (submission: Submission) => void;
  onPay: (submission: Submission, bounty: Bounty) => void;
  onCopyBlink: (submissionId: string) => void;
  onReviewChange: (submissionId: string, patch: Partial<SubmissionReview>) => void;
  onRetryVerification: (payment: Payment) => void;
  onManualVerifyFormChange: (patch: Partial<ManualVerifyForm>) => void;
  onManualVerify: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const orderedSubmissions = useMemo(() => {
    return [...submissions].sort((a, b) => {
      const selectedDelta = Number(b.selected) - Number(a.selected);
      if (selectedDelta) {
        return selectedDelta;
      }

      const shortlistDelta = Number(reviews[b.id]?.shortlisted) - Number(reviews[a.id]?.shortlisted);
      if (shortlistDelta) {
        return shortlistDelta;
      }

      return (reviewAverage(reviews[b.id]) || 0) - (reviewAverage(reviews[a.id]) || 0);
    });
  }, [reviews, submissions]);
  const blinkSubmission = orderedSubmissions.find((submission) => submission.selected) || orderedSubmissions[0] || null;
  const authorActionMessage = connected
    ? "Only the bounty author wallet can grade, select, verify, or pay this award."
    : "Connect the bounty author wallet to grade, select, verify, or pay this award.";

  return (
    <Panel id="bounty-detail" className="scroll-mt-5 overflow-hidden p-0">
      <div className="grid gap-0 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="relative min-h-72 bg-ink">
          <Image src={bounty.cover_art || "/covers/river-manual.svg"} alt="" fill className="object-cover" priority />
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-clay">{bounty.genre}</p>
              <h2 className="mt-2 font-serif text-4xl font-semibold leading-none">{bounty.title}</h2>
              <p className="mt-3 max-w-3xl text-base leading-7 text-ink/70">{bounty.excerpt}</p>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-ink/55">
                Stage one pays the selected sample. Stage two shows the expected full narration budget for the completed book.
              </p>
            </div>
            <div className="min-w-[190px] rounded-lg border border-ink/10 bg-paper p-4 text-right shadow-line">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/50">Audition award</p>
              <p className="mt-1 font-serif text-3xl font-semibold">{bounty.reward_sol.toFixed(2)} SOL</p>
              <div className="mt-3 border-t border-ink/10 pt-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/50">Full narration budget</p>
                <p className="mt-1 text-lg font-black text-clay">{formatOptionalSol(bounty.full_project_budget_sol)}</p>
              </div>
              <p className="mt-1 text-xs font-bold text-ink/50">{bounty.status}</p>
            </div>
          </div>

          <ReviewWorkspaceSummary submissions={submissions} reviews={reviews} canManage={canManageBounty} />
          {!canManageBounty ? (
            <div className="mt-4 rounded-lg border border-clay/20 bg-clay/10 px-4 py-3 text-sm font-semibold leading-6 text-clay">
              {authorActionMessage} Browsing, listening, and sharing tip links remain public.
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-ink/50">Auditions</h3>
              <span className="text-sm font-black text-ink/60">{submissions.length} submitted</span>
            </div>
            {submissions.length ? (
              orderedSubmissions.map((submission) => (
                <article
                  key={submission.id}
                  className={`rounded-lg border p-4 shadow-line ${submission.selected ? "border-sage/50 bg-sage/10" : "border-ink/10 bg-white/70"}`}
                >
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-serif text-2xl font-semibold">{submission.narrator_name}</h4>
                        {submission.selected ? <SmallBadge icon={<BadgeCheck className="h-3.5 w-3.5" />} label="Selected" /> : null}
                        <PaymentBadge status={paymentStatusBySubmission.get(submission.id)} />
                      </div>
                      <p className="mt-1 text-sm leading-6 text-ink/60">{submission.note || "No note added."}</p>
                      <p className="mt-1 break-all text-xs font-semibold text-ink/50">{submission.narrator_wallet}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <IconButton
                        disabled={!canManageBounty || pendingAction === `select-${submission.id}`}
                        icon={<BadgeCheck className="h-4 w-4" />}
                        label="Select"
                        onClick={() => onSelect(submission)}
                      />
                      <IconButton
                        disabled={!canManageBounty || pendingAction === `pay-${submission.id}`}
                        icon={pendingAction === `pay-${submission.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDollarSign className="h-4 w-4" />}
                        label="Pay award"
                        onClick={() => onPay(submission, bounty)}
                      />
                      <IconButton icon={<Clipboard className="h-4 w-4" />} label="Share tip link" onClick={() => onCopyBlink(submission.id)} />
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
                    <audio className="w-full" controls src={submission.audio_url} />
                    <a
                      href={`${blinkOrigin}/tip/${submission.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-ink/10 bg-paper px-3 text-sm font-black text-ink transition hover:border-ink/30 hover:bg-white"
                    >
                      View share page <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </div>
                  <SubmissionReviewPanel
                    review={reviews[submission.id] || emptyReview()}
                    disabled={!canManageBounty}
                    disabledReason={authorActionMessage}
                    onChange={(patch) => onReviewChange(submission.id, patch)}
                  />
                </article>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-ink/20 bg-white/60 p-8 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-clay" />
                <p className="mt-3 font-serif text-2xl font-semibold">No auditions yet</p>
                <p className="mt-1 text-sm font-medium text-ink/50">Record the first take for this excerpt.</p>
              </div>
            )}
          </div>

          {blinkSubmission ? (
            <TipActionPreviewPanel bounty={bounty} submission={blinkSubmission} blinkOrigin={blinkOrigin} onCopyBlink={onCopyBlink} />
          ) : null}

          <ManualReceiptVerifierPanel
            bounty={bounty}
            submissions={orderedSubmissions}
            form={manualVerifyForm}
            pending={pendingAction === "manual-verify"}
            canManage={canManageBounty}
            onChange={onManualVerifyFormChange}
            onSubmit={onManualVerify}
          />

          {payments.length ? (
            <div className="mt-6">
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-ink/50">Receipts</h3>
              <div className="mt-3 grid gap-2">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex flex-col gap-3 rounded-lg border border-ink/10 bg-white/70 px-3 py-2 text-sm font-semibold shadow-line md:flex-row md:items-center md:justify-between"
                  >
                    <a href={explorerTxUrl(payment.tx_signature)} target="_blank" rel="noreferrer" className="min-w-0 hover:text-clay">
                      <span className="block truncate">{payment.memo}</span>
                      <span className="mt-0.5 block text-xs font-bold text-ink/50">{receiptStatusLabel(payment.status, payment.verification_error)}</span>
                      <ReceiptTimeline status={payment.status} />
                    </a>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-clay">{payment.amount_sol.toFixed(2)} SOL</span>
                      {payment.status !== "verified" ? (
                        <IconButton
                          disabled={!canManageBounty || pendingAction === `verify-${payment.id}`}
                          icon={pendingAction === `verify-${payment.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                          label="Verify"
                          onClick={() => onRetryVerification(payment)}
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

function AudioPreviewCard({
  audioPreview,
  audioMeta,
  recording,
  recordingSeconds,
  onClear
}: {
  audioPreview: string;
  audioMeta: AudioMeta | null;
  recording: boolean;
  recordingSeconds: number;
  onClear: () => void;
}) {
  if (recording) {
    return (
      <div className="mt-3 rounded-lg border border-clay/30 bg-clay/10 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-black text-clay">
            <Timer className="h-4 w-4" />
            Recording {formatDuration(recordingSeconds)}
          </div>
          <span className="h-2.5 w-2.5 rounded-full bg-clay shadow-[0_0_0_5px_rgba(185,93,61,0.14)]" />
        </div>
        <WaveformBars active />
      </div>
    );
  }

  if (!audioPreview) {
    return (
      <div className="mt-3 rounded-lg bg-white px-3 py-4 text-center text-xs font-semibold text-ink/50">
        No audition selected
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-ink/10 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-black">
            <FileAudio2 className="h-4 w-4 text-vox" />
            <span className="truncate">{audioMeta?.name || "Audition audio"}</span>
          </div>
          <p className="mt-1 text-xs font-semibold text-ink/50">
            {audioMeta ? `${formatAudioSize(audioMeta.sizeMb)} / ${formatDuration(audioMeta.duration)} / ${audioMeta.type}` : "Reading audio metadata"}
          </p>
        </div>
        <button
          type="button"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-ink/10 text-ink/60 transition hover:border-ink/30 hover:text-ink"
          aria-label="Clear audition audio"
          onClick={onClear}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <WaveformBars />
      <audio className="mt-3 w-full" controls src={audioPreview} />
    </div>
  );
}

function WaveformBars({ active = false }: { active?: boolean }) {
  const bars = [26, 42, 32, 58, 46, 72, 36, 62, 44, 68, 30, 54, 38, 60, 48, 34, 66, 40];

  return (
    <div className="mt-3 flex h-12 items-center gap-1 overflow-hidden rounded-lg bg-paper px-2">
      {bars.map((height, index) => (
        <span
          key={`${height}-${index}`}
          className={`w-full rounded-full ${active ? "bg-clay" : "bg-vox/45"}`}
          style={{ height: `${height}%`, opacity: active && index % 3 === 0 ? 1 : 0.72 }}
        />
      ))}
    </div>
  );
}

function ReviewWorkspaceSummary({ submissions, reviews, canManage }: { submissions: Submission[]; reviews: ReviewState; canManage: boolean }) {
  const shortlisted = submissions.filter((submission) => reviews[submission.id]?.shortlisted).length;
  const scored = submissions
    .map((submission) => ({ submission, average: reviewAverage(reviews[submission.id]) }))
    .filter((entry): entry is { submission: Submission; average: number } => entry.average !== null)
    .sort((a, b) => b.average - a.average);
  const top = scored[0];

  return (
    <div className="mt-6 rounded-lg border border-ink/10 bg-paper/70 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-sage" />
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-ink/50">Audition review workspace</h3>
          </div>
          <p className="mt-2 text-sm font-medium leading-6 text-ink/60">
            {canManage
              ? "Local scoring helps the author choose before the devnet payment step."
              : "Review scores are locked until the bounty author wallet is connected."}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Scored" value={`${scored.length}`} />
          <Metric label="Shortlist" value={`${shortlisted}`} />
          <Metric label="Top" value={top ? `${top.average.toFixed(1)}` : "--"} />
        </div>
      </div>
      {top ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-ink/70">
          <Star className="h-4 w-4 text-clay" />
          Current lead: {top.submission.narrator_name}
        </div>
      ) : null}
    </div>
  );
}

function SubmissionReviewPanel({
  review,
  disabled,
  disabledReason,
  onChange
}: {
  review: SubmissionReview;
  disabled: boolean;
  disabledReason: string;
  onChange: (patch: Partial<SubmissionReview>) => void;
}) {
  const average = reviewAverage(review);

  return (
    <div className="mt-4 rounded-lg border border-ink/10 bg-paper/70 p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-clay" />
            <h5 className="text-xs font-black uppercase tracking-[0.14em] text-ink/50">Author review</h5>
          </div>
          <p className="mt-1 text-sm font-semibold text-ink/60">
            {disabled ? disabledReason : average === null ? "Not scored yet" : `${average.toFixed(1)} average score`}
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black transition ${
            review.shortlisted ? "bg-sage text-paper" : "border border-ink/10 bg-white text-ink/60 hover:border-ink/30 hover:text-ink"
          } disabled:opacity-50`}
          onClick={() => onChange({ shortlisted: !review.shortlisted })}
        >
          {review.shortlisted ? <Check className="h-4 w-4" /> : <Star className="h-4 w-4" />}
          {review.shortlisted ? "Shortlisted" : "Shortlist"}
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {reviewCriteria.map((criterion) => (
          <ScoreControl
            key={criterion.key}
            label={criterion.label}
            value={review[criterion.key]}
            disabled={disabled}
            onChange={(value) => onChange({ [criterion.key]: value } as Partial<SubmissionReview>)}
          />
        ))}
      </div>
      <textarea
        className="mt-3 min-h-16 w-full resize-y rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm font-semibold leading-5 outline-none transition placeholder:text-ink/30 focus:border-ink"
        aria-label="Private local review note"
        placeholder="Private local note for the author"
        value={review.note}
        disabled={disabled}
        onChange={(event) => onChange({ note: event.currentTarget.value })}
      />
    </div>
  );
}

function ScoreControl({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: number) => void }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-black uppercase tracking-[0.12em] text-ink/45">{label}</span>
        <span className="text-xs font-black text-clay">{value || "--"}</span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            className={`h-8 rounded-md text-xs font-black transition ${
              score <= value ? "bg-ink text-paper" : "border border-ink/10 bg-paper text-ink/45 hover:border-ink/30 hover:text-ink"
            }`}
            disabled={disabled}
            aria-label={`${label} ${score}`}
            onClick={() => onChange(score)}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}

function TipActionPreviewPanel({
  bounty,
  submission,
  blinkOrigin,
  onCopyBlink
}: {
  bounty: Bounty;
  submission: Submission;
  blinkOrigin: string;
  onCopyBlink: (submissionId: string) => void;
}) {
  const shareUrl = `${blinkOrigin}/tip/${submission.id}`;
  const actionUrl = `${blinkOrigin}/api/actions/submissions/${submission.id}/tip`;

  return (
    <div className="mt-6 rounded-lg border border-vox/20 bg-vox/10 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-vox" />
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-ink/50">Shareable tip link</h3>
          </div>
          <p className="mt-2 text-sm font-semibold text-ink/65">
            Share this public page for tipping {submission.narrator_name}. It includes cover art, audio playback, and the Solana Action URL for supported clients.
          </p>
          <p className="mt-2 break-all rounded-lg bg-white px-3 py-2 text-xs font-bold text-ink/55">{shareUrl}</p>
          <p className="mt-2 break-all text-xs font-bold text-ink/45">{paymentMemo(bounty.id, submission.id)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <IconButton icon={<Copy className="h-4 w-4" />} label="Copy tip link" onClick={() => onCopyBlink(submission.id)} />
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-ink px-3 text-sm font-black text-paper transition hover:bg-ink/90"
          >
            View share page <ArrowUpRight className="h-4 w-4" />
          </a>
          <a
            href={actionUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-ink/10 bg-white px-3 text-sm font-black text-ink/70 transition hover:border-ink/30 hover:text-ink"
          >
            Action JSON <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

function ManualReceiptVerifierPanel({
  bounty,
  submissions,
  form,
  pending,
  canManage,
  onChange,
  onSubmit
}: {
  bounty: Bounty;
  submissions: Submission[];
  form: ManualVerifyForm;
  pending: boolean;
  canManage: boolean;
  onChange: (patch: Partial<ManualVerifyForm>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const selectedSubmission = submissions.find((submission) => submission.id === form.submission_id) || submissions[0] || null;

  return (
    <div className="mt-6 rounded-lg border border-ink/10 bg-white/70 p-4 shadow-line">
      <div className="flex items-start gap-2">
        <ClipboardCheck className="mt-0.5 h-4 w-4 text-sage" />
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.16em] text-ink/50">Manual receipt verifier</h3>
          <p className="mt-2 text-sm font-medium leading-6 text-ink/60">
            {canManage
              ? "Paste a devnet transaction signature to check recipient, amount, and memo before marking payment status."
              : "Manual verification is locked to the bounty author wallet."}
          </p>
        </div>
      </div>
      <form className="mt-4 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-end" onSubmit={onSubmit}>
        <SelectInput
          label="Audition"
          value={form.submission_id}
          disabled={!canManage}
          onChange={(value) => onChange({ submission_id: value })}
          options={
            submissions.length
              ? submissions.map((submission) => ({ label: submission.narrator_name, value: submission.id }))
              : [{ label: "No auditions yet", value: "" }]
          }
        />
        <TextInput label="Devnet tx signature" value={form.tx_signature} disabled={!canManage} onChange={(value) => onChange({ tx_signature: value })} />
        <Button disabled={pending || !selectedSubmission} icon={<ShieldCheck className="h-4 w-4" />} type="submit">
          Verify
        </Button>
      </form>
      <div className="mt-3 grid gap-2 rounded-lg bg-paper/70 px-3 py-2 text-xs font-bold text-ink/50">
        <span>Expected audition award: {bounty.reward_sol.toFixed(2)} SOL</span>
        <span className="break-all">Expected memo: {selectedSubmission ? paymentMemo(bounty.id, selectedSubmission.id) : "Submit an audition first"}</span>
      </div>
    </div>
  );
}

function ReceiptTimeline({ status }: { status: PaymentStatus }) {
  const steps = [
    { label: "Sent", state: "done" },
    { label: "Checked", state: status === "pending_verification" ? "current" : status === "verification_failed" ? "failed" : "done" },
    { label: "Verified", state: status === "verified" ? "done" : "pending" }
  ];

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {steps.map((step) => (
        <span key={step.label} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-black ${receiptStepClass(step.state)}`}>
          {step.state === "done" ? <Check className="h-3 w-3" /> : step.state === "failed" ? <ShieldAlert className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
          {step.label}
        </span>
      ))}
    </div>
  );
}

function DemoModePanel({ enabled, onToggle, onReset }: { enabled: boolean; onToggle: () => void; onReset: () => void }) {
  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.16em] text-ink/50">Demo mode</h2>
          <p className="mt-2 text-sm font-medium leading-6 text-ink/60">
            {enabled ? "Judge helpers are visible for the walkthrough." : "Demo helpers are hidden. The marketplace is in platform mode."}
          </p>
        </div>
        <button
          className={`h-8 rounded-md px-3 text-xs font-black transition ${enabled ? "bg-ink text-paper" : "border border-ink/10 bg-paper text-ink"}`}
          onClick={onToggle}
        >
          {enabled ? "On" : "Off"}
        </button>
      </div>
      {enabled ? (
        <ol className="mt-4 grid gap-2">
          {demoSteps.map((step, index) => (
            <li key={step} className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm font-black">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-clay text-xs text-paper">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      ) : null}
      {enabled ? (
        <button
          className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-ink/10 bg-paper px-3 text-sm font-black text-ink transition hover:border-ink/30 hover:bg-white"
          onClick={onReset}
        >
          <RotateCcw className="h-4 w-4" />
          Reset local demo
        </button>
      ) : null}
    </Panel>
  );
}

function WhySolanaPanel() {
  return (
    <Panel>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-sage" />
        <h2 className="text-sm font-black uppercase tracking-[0.16em] text-ink/50">Why Solana</h2>
      </div>
      <div className="mt-4 grid gap-3 text-sm font-semibold leading-6 text-ink/60">
        <p>Authors can pay narrators directly, without marketplace custody or a slow payout cycle.</p>
        <p>Each payment carries a memo that links the transaction to one bounty and one audition.</p>
        <p>Every audition can become a shareable Solana Action link so fans can tip a voice from supported surfaces.</p>
      </div>
    </Panel>
  );
}

function NarratorDirectoryPanel({ profiles, onOpenBounty }: { profiles: NarratorProfile[]; onOpenBounty: (bountyId: string) => void }) {
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-sage" />
          <h2 className="text-sm font-black uppercase tracking-[0.16em] text-ink/50">Narrator directory</h2>
        </div>
        <span className="text-xs font-black text-ink/45">{profiles.length}</span>
      </div>
      <div className="mt-4 grid gap-2">
        {profiles.length ? (
          profiles.slice(0, 4).map((profile) => (
            <article key={profile.wallet} className="rounded-lg border border-ink/10 bg-white/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-serif text-xl font-semibold">{profile.name}</h3>
                  <p className="mt-0.5 break-all text-xs font-bold text-ink/45">{truncateWallet(profile.wallet)}</p>
                </div>
                <span className="rounded-md bg-sage/15 px-2 py-1 text-xs font-black text-sage">
                  {profile.average === null ? "--" : profile.average.toFixed(1)}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <MiniMetric label="Takes" value={`${profile.submissions}`} />
                <MiniMetric label="Picked" value={`${profile.selected}`} />
                <MiniMetric label="Paid" value={`${profile.verifiedSol.toFixed(2)}`} />
              </div>
              <p className="mt-2 truncate text-xs font-bold text-ink/50">{profile.genres.join(" / ") || "No genres yet"}</p>
              {profile.topSubmission ? (
                <button
                  type="button"
                  className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-ink/10 bg-paper px-3 text-xs font-black text-ink transition hover:border-ink/30 hover:bg-white"
                  onClick={() => onOpenBounty(profile.topSubmission?.bounty_id || "")}
                >
                  View audition <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </article>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-ink/20 bg-white/60 p-5 text-center text-sm font-semibold text-ink/50">
            Narrators appear here after auditions.
          </div>
        )}
      </div>
    </Panel>
  );
}

function Panel({ children, className = "", id }: Readonly<{ children: ReactNode; className?: string; id?: string }>) {
  return (
    <div id={id} className={`rounded-lg border border-ink/10 bg-white/75 p-4 shadow-line backdrop-blur ${className}`}>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-white px-2 py-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/40">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-paper px-2 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-ink/35">{label}</p>
      <p className="mt-0.5 text-xs font-black">{value}</p>
    </div>
  );
}

function WalletControls() {
  const { connected, connect, disconnect, walletName, publicKey } = useVoxWallet();
  const [pendingWallet, setPendingWallet] = useState<"phantom" | "solflare" | "disconnect" | null>(null);
  const [walletError, setWalletError] = useState<{ wallet: "phantom" | "solflare"; message: string } | null>(null);

  async function runWalletAction(action: "phantom" | "solflare" | "disconnect") {
    setPendingWallet(action);
    setWalletError(null);
    try {
      if (action === "disconnect") {
        await disconnect();
      } else {
        await connect(action);
      }
    } catch (error) {
      if (action !== "disconnect") {
        setWalletError({ wallet: action, message: getErrorMessage(error) });
      }
    } finally {
      setPendingWallet(null);
    }
  }

  if (connected) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex h-10 items-center gap-2 rounded-lg border border-sage/20 bg-sage/10 px-3 text-sm font-black text-sage">
          <Wallet className="h-4 w-4" />
          {walletName ? walletLabel(walletName) : "Wallet"} {publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : ""}
        </div>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-ink/10 bg-paper px-3 text-sm font-black text-ink transition hover:border-ink/30 hover:bg-white"
          onClick={() => void runWalletAction("disconnect")}
        >
          {pendingWallet === "disconnect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-3 text-sm font-black text-paper transition hover:bg-ink/90"
          onClick={() => void runWalletAction("phantom")}
        >
          {pendingWallet === "phantom" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
          Login with Phantom
        </button>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-ink/10 bg-paper px-3 text-sm font-black text-ink transition hover:border-ink/30 hover:bg-white"
          onClick={() => void runWalletAction("solflare")}
        >
          {pendingWallet === "solflare" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
          Login with Solflare
        </button>
      </div>
      {walletError ? (
        <div className="mt-2 rounded-lg border border-clay/25 bg-clay/10 px-3 py-2 text-xs font-semibold leading-5 text-clay">
          <p>{walletError.message}</p>
          <a
            href={walletError.wallet === "phantom" ? "https://phantom.com/download" : "https://solflare.com/download"}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 font-black underline decoration-clay/40 underline-offset-4"
          >
            Install {walletError.wallet === "phantom" ? "Phantom" : "Solflare"} <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
      ) : null}
    </div>
  );
}

function walletLabel(walletName: string) {
  if (walletName === "phantom") {
    return "Phantom";
  }

  if (walletName === "solflare") {
    return "Solflare";
  }

  return walletName;
}

function SmallBadge({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-ink px-2 py-1 text-xs font-black text-paper">
      {icon}
      {label}
    </span>
  );
}

function PaymentBadge({ status }: { status?: PaymentStatus }) {
  if (!status) {
    return null;
  }

  if (status === "verified") {
    return <SmallBadge icon={<ReceiptText className="h-3.5 w-3.5" />} label="Paid" />;
  }

  if (status === "pending_verification") {
    return <SmallBadge icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Pending verification" />;
  }

  return <SmallBadge icon={<ShieldAlert className="h-3.5 w-3.5" />} label="Verification failed" />;
}

function receiptStatusLabel(status: PaymentStatus, error?: string | null) {
  if (status === "verified") {
    return "Verified on devnet";
  }

  if (status === "pending_verification") {
    return error || "Pending devnet verification";
  }

  return error || "Verification failed";
}

function Button({
  children,
  icon,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: ReactNode }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-black text-paper transition hover:bg-ink/90 disabled:opacity-50 ${className}`}
    >
      {props.disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

function IconButton({
  icon,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      {...props}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-ink/10 bg-paper px-3 text-sm font-black text-ink transition hover:border-ink/30 hover:bg-white disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  min,
  step,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  min?: string;
  step?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-ink/50">{label}</span>
      <input
        className="mt-1 h-11 w-full rounded-lg border border-ink/10 bg-white px-3 text-sm font-semibold outline-none transition placeholder:text-ink/30 focus:border-ink disabled:bg-paper disabled:text-ink/45"
        type={type}
        min={min}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
  disabled = false
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-ink/50">{label}</span>
      <select
        className="mt-1 h-10 w-full rounded-lg border border-ink/10 bg-white px-2 text-xs font-black text-ink outline-none transition focus:border-ink disabled:bg-paper disabled:text-ink/45"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-ink/50">{label}</span>
      <textarea
        className="mt-1 min-h-24 w-full resize-y rounded-lg border border-ink/10 bg-white px-3 py-3 text-sm font-semibold leading-6 outline-none transition placeholder:text-ink/30 focus:border-ink disabled:bg-paper disabled:text-ink/45"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function buildAccountWorkspace(state: MarketplaceState | null, wallet: string): AccountWorkspace {
  if (!state || !wallet) {
    return {
      profile: null,
      authoredBounties: [],
      narratorSubmissions: [],
      incomingPayments: [],
      outgoingPayments: [],
      verifiedIncomingSol: 0,
      verifiedOutgoingSol: 0
    };
  }

  const bountyById = new Map(state.bounties.map((bounty) => [bounty.id, bounty]));
  const incomingPayments = state.payments.filter((payment) => payment.recipient_wallet === wallet);
  const outgoingPayments = state.payments.filter((payment) => payment.payer_wallet === wallet);

  return {
    profile: state.profiles.find((profile) => profile.wallet === wallet) || null,
    authoredBounties: state.bounties.filter((bounty) => bounty.author_wallet === wallet),
    narratorSubmissions: state.submissions
      .filter((submission) => submission.narrator_wallet === wallet)
      .map((submission) => ({ submission, bounty: bountyById.get(submission.bounty_id) || null })),
    incomingPayments,
    outgoingPayments,
    verifiedIncomingSol: incomingPayments.reduce((total, payment) => (payment.status === "verified" ? total + payment.amount_sol : total), 0),
    verifiedOutgoingSol: outgoingPayments.reduce((total, payment) => (payment.status === "verified" ? total + payment.amount_sol : total), 0)
  };
}

function isBountyAuthor(bounty: Bounty | null | undefined, wallet: string) {
  return Boolean(bounty && wallet && bounty.author_wallet === wallet);
}

function buildNarratorProfiles(state: MarketplaceState | null, reviews: ReviewState): NarratorProfile[] {
  if (!state) {
    return [];
  }

  const bountyById = new Map(state.bounties.map((bounty) => [bounty.id, bounty]));
  const profiles = new Map<
    string,
    NarratorProfile & {
      scoreTotal: number;
      scoreCount: number;
      genreSet: Set<string>;
    }
  >();

  for (const submission of state.submissions) {
    const wallet = submission.narrator_wallet;
    const existing =
      profiles.get(wallet) ||
      ({
        wallet,
        name: submission.narrator_name,
        submissions: 0,
        selected: 0,
        verifiedSol: 0,
        genres: [],
        average: null,
        topSubmission: null,
        scoreTotal: 0,
        scoreCount: 0,
        genreSet: new Set<string>()
      } satisfies NarratorProfile & { scoreTotal: number; scoreCount: number; genreSet: Set<string> });

    existing.name = submission.narrator_name || existing.name;
    existing.submissions += 1;
    existing.selected += submission.selected ? 1 : 0;
    const bounty = bountyById.get(submission.bounty_id);
    if (bounty) {
      existing.genreSet.add(bounty.genre);
    }

    const average = reviewAverage(reviews[submission.id]);
    if (average !== null) {
      existing.scoreTotal += average;
      existing.scoreCount += 1;
    }

    const topAverage = reviewAverage(existing.topSubmission ? reviews[existing.topSubmission.id] : undefined) || 0;
    if (!existing.topSubmission || submission.selected || (average || 0) > topAverage) {
      existing.topSubmission = submission;
    }

    profiles.set(wallet, existing);
  }

  for (const payment of state.payments) {
    if (payment.status !== "verified") {
      continue;
    }

    const profile = profiles.get(payment.recipient_wallet);
    if (profile) {
      profile.verifiedSol += payment.amount_sol;
    }
  }

  return Array.from(profiles.values())
    .map(({ scoreTotal, scoreCount, genreSet, ...profile }) => ({
      ...profile,
      genres: Array.from(genreSet).sort(),
      average: scoreCount ? scoreTotal / scoreCount : null
    }))
    .sort((a, b) => b.verifiedSol - a.verifiedSol || b.selected - a.selected || (b.average || 0) - (a.average || 0) || b.submissions - a.submissions);
}

function emptyReview(): SubmissionReview {
  return {
    tone: 0,
    clarity: 0,
    pacing: 0,
    fit: 0,
    shortlisted: false,
    note: ""
  };
}

function truncateWallet(wallet: string) {
  if (wallet.length <= 12) {
    return wallet || "No wallet";
  }

  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function readReviewState(): ReviewState {
  if (typeof window === "undefined") {
    return seededReviewState;
  }

  const stored = window.localStorage.getItem(REVIEW_STORAGE_KEY);
  if (!stored) {
    writeReviewState(seededReviewState);
    return seededReviewState;
  }

  try {
    return { ...seededReviewState, ...(JSON.parse(stored) as ReviewState) };
  } catch {
    writeReviewState(seededReviewState);
    return seededReviewState;
  }
}

function writeReviewState(state: ReviewState) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(state));
  }
}

function reviewAverage(review?: SubmissionReview) {
  if (!review) {
    return null;
  }

  const scores = reviewCriteria.map((criterion) => review[criterion.key]).filter((score) => score > 0);
  if (!scores.length) {
    return null;
  }

  return scores.reduce((total, score) => total + score, 0) / scores.length;
}

function isAudioFile(file: File) {
  if (file.type.startsWith("audio/")) {
    return true;
  }

  return /\.(aac|aif|aiff|flac|m4a|mp3|oga|ogg|opus|wav|webm)$/i.test(file.name);
}

function isImageFile(file: File) {
  if (file.type.startsWith("image/")) {
    return true;
  }

  return /\.(gif|jpe?g|png|svg|webp)$/i.test(file.name);
}

function formatAudioSize(sizeMb: number) {
  return `${sizeMb.toFixed(sizeMb >= 10 ? 0 : 1)} MB`;
}

function formatOptionalSol(value?: number | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "TBD";
  }

  return `${parsed.toFixed(2)} SOL`;
}

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) {
    return "duration pending";
  }

  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function receiptStepClass(state: string) {
  if (state === "done") {
    return "bg-sage/15 text-sage";
  }

  if (state === "current") {
    return "bg-vox/15 text-vox";
  }

  if (state === "failed") {
    return "bg-red-100 text-red-700";
  }

  return "bg-ink/5 text-ink/40";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
}
