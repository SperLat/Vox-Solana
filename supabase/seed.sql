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
  ),
  (
    'bounty-orchid',
    'The Orchid Clock',
    'Every morning the clock bloomed at seven, and every evening it folded away one hour of someone else''s life. Ana was the first to notice the missing minutes.',
    'Literary mystery',
    0.32,
    3.20,
    '7p1RKdQbJnW2A4dzJns7cLGtYGbTRTuv7RRv9pZV4nEP',
    'awarded',
    '/covers/orchid-clock.svg'
  )
on conflict (id) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  genre = excluded.genre,
  reward_sol = excluded.reward_sol,
  full_project_budget_sol = excluded.full_project_budget_sol,
  author_wallet = excluded.author_wallet,
  status = excluded.status,
  cover_art = excluded.cover_art;

insert into public.project_vox_submissions (id, bounty_id, narrator_name, narrator_wallet, audio_url, note, selected)
values
  (
    'submission-luz',
    'bounty-mars',
    'Luz Vega',
    'CqsSNVZHeHYsFteyhfBA47w34HL8pZ27Z5bMViK7hg9Z',
    '/audio/demo-audition.wav',
    'Warm documentary tone with a slightly haunted cadence for the discovery scene.',
    false
  ),
  (
    'submission-ari',
    'bounty-river',
    'Ari Sol',
    '8ndNRpnMS5a8mCwo6iSK8hGrm82FYqMQELc743CfAQS2',
    '/audio/demo-audition.wav',
    'Fast, intimate pacing for a serialized adventure opener.',
    false
  ),
  (
    'submission-mika',
    'bounty-orchid',
    'Mika Rowan',
    '8i3z8GZpzz1NmfgcmYpouJ1vGfL6i1cbaopYMRK9DJtj',
    '/audio/demo-audition.wav',
    'Quiet literary read with crisp consonants and restrained suspense.',
    true
  )
on conflict (id) do update set
  bounty_id = excluded.bounty_id,
  narrator_name = excluded.narrator_name,
  narrator_wallet = excluded.narrator_wallet,
  audio_url = excluded.audio_url,
  note = excluded.note,
  selected = excluded.selected;

insert into public.project_vox_profiles (wallet, display_name, role, bio)
values
  (
    '7p1RKdQbJnW2A4dzJns7cLGtYGbTRTuv7RRv9pZV4nEP',
    'Demo Author',
    'author',
    'Independent author posting paid audiobook audition awards.'
  ),
  (
    'CqsSNVZHeHYsFteyhfBA47w34HL8pZ27Z5bMViK7hg9Z',
    'Luz Vega',
    'narrator',
    'Warm documentary narrator for speculative fiction and discovery scenes.'
  ),
  (
    '8ndNRpnMS5a8mCwo6iSK8hGrm82FYqMQELc743CfAQS2',
    'Ari Sol',
    'narrator',
    'Fast-paced serial adventure narrator with intimate scene delivery.'
  ),
  (
    '8i3z8GZpzz1NmfgcmYpouJ1vGfL6i1cbaopYMRK9DJtj',
    'Mika Rowan',
    'narrator',
    'Literary mystery narrator with restrained suspense and crisp diction.'
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
  'bounty-orchid',
  'submission-mika',
  '7p1RKdQbJnW2A4dzJns7cLGtYGbTRTuv7RRv9pZV4nEP',
  '8i3z8GZpzz1NmfgcmYpouJ1vGfL6i1cbaopYMRK9DJtj',
  0.32,
  'demo-pending-signature',
  'project-vox:bounty=bounty-orchid:submission=submission-mika',
  'pending_verification',
  null,
  'Demo receipt awaiting devnet verification.'
)
on conflict (id) do update set
  bounty_id = excluded.bounty_id,
  submission_id = excluded.submission_id,
  payer_wallet = excluded.payer_wallet,
  recipient_wallet = excluded.recipient_wallet,
  amount_sol = excluded.amount_sol,
  tx_signature = excluded.tx_signature,
  memo = excluded.memo,
  status = excluded.status,
  verified_at = excluded.verified_at,
  verification_error = excluded.verification_error;
