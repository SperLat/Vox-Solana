insert into public.project_vox_bounties (id, title, excerpt, genre, reward_sol, full_project_budget_sol, author_wallet, status, cover_art)
values
  (
    'bounty-mars',
    'The Red Library',
    'At the rim of the old crater, Mara found a library sealed in glass. The books inside were not written for human hands, but every page hummed when she spoke.',
    'Speculative fiction',
    0.24,
    2.40,
    '7p1RKdQbJnW2A4dzJns7cLGtYGbTRTuv7RRv9pZV4nEP',
    'open',
    '/covers/red-library.svg'
  ),
  (
    'bounty-river',
    'River Manual for Lost Cities',
    'Rule one: never trust a city that refuses to appear on maps. Rule two: if the river knows your name, answer softly and keep walking.',
    'Adventure',
    0.18,
    1.80,
    '7p1RKdQbJnW2A4dzJns7cLGtYGbTRTuv7RRv9pZV4nEP',
    'open',
    '/covers/river-manual.svg'
  )
on conflict (id) do update set full_project_budget_sol = excluded.full_project_budget_sol;

insert into public.project_vox_submissions (id, bounty_id, narrator_name, narrator_wallet, audio_url, note, selected)
values
  (
    'submission-luz',
    'bounty-mars',
    'Luz Vega',
    '9xQeWvG816bUx9EPa3gKB8Z3fLkWjGNxuz9bSWrH4MM',
    '/audio/demo-audition.wav',
    'Warm documentary tone with a slightly haunted cadence for the discovery scene.',
    false
  )
on conflict (id) do nothing;

insert into public.project_vox_profiles (wallet, display_name, role, bio)
values
  (
    '7p1RKdQbJnW2A4dzJns7cLGtYGbTRTuv7RRv9pZV4nEP',
    'Demo Author',
    'author',
    'Independent author posting paid audiobook audition awards.'
  ),
  (
    '9xQeWvG816bUx9EPa3gKB8Z3fLkWjGNxuz9bSWrH4MM',
    'Demo Narrator',
    'narrator',
    'Voice performer accepting audition awards and full narration work.'
  )
on conflict (wallet) do update set
  display_name = excluded.display_name,
  role = excluded.role,
  bio = excluded.bio,
  updated_at = now();

insert into public.project_vox_payments (
  id,
  bounty_id,
  submission_id,
  payer_wallet,
  recipient_wallet,
  amount_sol,
  tx_signature,
  memo,
  status,
  verified_at,
  verification_error
)
values (
  'payment-demo-pending',
  'bounty-mars',
  'submission-luz',
  '7p1RKdQbJnW2A4dzJns7cLGtYGbTRTuv7RRv9pZV4nEP',
  '9xQeWvG816bUx9EPa3gKB8Z3fLkWjGNxuz9bSWrH4MM',
  0.24,
  'demo-pending-signature',
  'project-vox:bounty=bounty-mars:submission=submission-luz',
  'pending_verification',
  null,
  'Demo receipt awaiting devnet verification.'
)
on conflict (id) do nothing;
