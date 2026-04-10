-- Coffers v1 initial schema (no RLS, no triggers)
-- profiles: display_name is sufficient for v1 public/profile display until richer profile fields are needed.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_display_name_len CHECK (
    display_name IS NULL OR char_length(display_name) <= 200
  )
);

-- ---------------------------------------------------------------------------
-- clubs
-- ---------------------------------------------------------------------------
CREATE TABLE public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  name text NOT NULL,
  slug text NOT NULL,
  invite_token uuid NOT NULL DEFAULT gen_random_uuid (),
  monthly_fee_pence bigint NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clubs_name_len CHECK (char_length(name) >= 1 AND char_length(name) <= 200),
  CONSTRAINT clubs_slug_format CHECK (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(slug) <= 100
  ),
  CONSTRAINT clubs_monthly_fee_positive CHECK (monthly_fee_pence > 0)
);

CREATE UNIQUE INDEX clubs_slug_key ON public.clubs (slug);
CREATE UNIQUE INDEX clubs_invite_token_key ON public.clubs (invite_token);

-- ---------------------------------------------------------------------------
-- memberships: club-scoped roles
-- ---------------------------------------------------------------------------
CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memberships_role_check CHECK (role IN ('member', 'admin', 'owner')),
  CONSTRAINT memberships_status_check CHECK (
    status IN ('pending', 'active', 'suspended', 'cancelled')
  ),
  CONSTRAINT memberships_unique_user_per_club UNIQUE (club_id, user_id)
);

CREATE INDEX memberships_user_id_idx ON public.memberships (user_id);

-- ---------------------------------------------------------------------------
-- billing_subscriptions: one active subscription record per membership
-- ---------------------------------------------------------------------------
CREATE TABLE public.billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  membership_id uuid NOT NULL REFERENCES public.memberships (id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'stripe',
  external_customer_id text,
  external_subscription_id text,
  status text NOT NULL,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_subscriptions_provider_len CHECK (
    char_length(provider) >= 1 AND char_length(provider) <= 50
  ),
  CONSTRAINT billing_subscriptions_status_check CHECK (
    status IN (
      'active',
      'past_due',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'trialing',
      'unpaid'
    )
  ),
  CONSTRAINT billing_subscriptions_period_order CHECK (
    current_period_start IS NULL
    OR current_period_end IS NULL
    OR current_period_end > current_period_start
  ),
  CONSTRAINT billing_subscriptions_one_per_membership UNIQUE (membership_id)
);

CREATE UNIQUE INDEX billing_subscriptions_external_subscription_id_key
  ON public.billing_subscriptions (external_subscription_id)
  WHERE external_subscription_id IS NOT NULL;

CREATE INDEX billing_subscriptions_membership_id_idx ON public.billing_subscriptions (membership_id);

-- ---------------------------------------------------------------------------
-- draw_cycles
-- ---------------------------------------------------------------------------
CREATE TABLE public.draw_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  cycle_number integer NOT NULL,
  name text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open',
  total_pot_pence bigint NOT NULL DEFAULT 0,
  club_share_pence bigint NOT NULL DEFAULT 0,
  winner_share_pence bigint NOT NULL DEFAULT 0,
  platform_fee_pence bigint NOT NULL DEFAULT 0,
  eligible_entries_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT draw_cycles_period_order CHECK (period_end > period_start),
  CONSTRAINT draw_cycles_name_len CHECK (
    char_length(name) >= 1 AND char_length(name) <= 200
  ),
  CONSTRAINT draw_cycles_cycle_number_positive CHECK (cycle_number > 0),
  CONSTRAINT draw_cycles_status_check CHECK (
    status IN ('open', 'closed', 'drawn', 'settled', 'cancelled')
  ),
  CONSTRAINT draw_cycles_total_pot_non_negative CHECK (total_pot_pence >= 0),
  CONSTRAINT draw_cycles_club_share_non_negative CHECK (club_share_pence >= 0),
  CONSTRAINT draw_cycles_winner_share_non_negative CHECK (winner_share_pence >= 0),
  CONSTRAINT draw_cycles_platform_fee_non_negative CHECK (platform_fee_pence >= 0),
  CONSTRAINT draw_cycles_unique_club_cycle UNIQUE (club_id, cycle_number)
);

CREATE INDEX draw_cycles_club_id_idx ON public.draw_cycles (club_id);

-- ---------------------------------------------------------------------------
-- payments: tied to a draw cycle and membership (idempotent webhook field)
-- ---------------------------------------------------------------------------
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  draw_cycle_id uuid REFERENCES public.draw_cycles (id) ON DELETE RESTRICT,
  membership_id uuid NOT NULL REFERENCES public.memberships (id) ON DELETE RESTRICT,
  amount_pence bigint NOT NULL,
  currency text NOT NULL DEFAULT 'GBP',
  status text NOT NULL DEFAULT 'pending',
  provider text,
  provider_event_id text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_amount_pence_positive CHECK (amount_pence > 0),
  CONSTRAINT payments_currency_check CHECK (
    currency ~ '^[A-Z]{3}$'
  ),
  CONSTRAINT payments_status_check CHECK (
    status IN ('pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded')
  ),
  CONSTRAINT payments_paid_at_when_succeeded CHECK (
    status <> 'succeeded' OR paid_at IS NOT NULL
  )
);

CREATE INDEX payments_draw_cycle_id_idx ON public.payments (draw_cycle_id);
CREATE INDEX payments_membership_id_idx ON public.payments (membership_id);

CREATE UNIQUE INDEX payments_provider_event_id_key
  ON public.payments (provider_event_id)
  WHERE provider_event_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- draw_entries: one entry per member per cycle, linked to the qualifying payment
-- ---------------------------------------------------------------------------
CREATE TABLE public.draw_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  draw_cycle_id uuid NOT NULL REFERENCES public.draw_cycles (id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES public.memberships (id) ON DELETE RESTRICT,
  payment_id uuid NOT NULL REFERENCES public.payments (id) ON DELETE RESTRICT,
  is_winner boolean NOT NULL DEFAULT false,
  winner_rank integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT draw_entries_winner_rank_positive CHECK (
    winner_rank IS NULL OR winner_rank > 0
  ),
  CONSTRAINT draw_entries_unique_membership_per_cycle UNIQUE (draw_cycle_id, membership_id)
);

CREATE INDEX draw_entries_draw_cycle_id_idx ON public.draw_entries (draw_cycle_id);
CREATE INDEX draw_entries_payment_id_idx ON public.draw_entries (payment_id);

-- ---------------------------------------------------------------------------
-- settlements: manual payout tracking with explicit recipient routing
-- ---------------------------------------------------------------------------
CREATE TABLE public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  draw_cycle_id uuid REFERENCES public.draw_cycles (id) ON DELETE SET NULL,
  membership_id uuid REFERENCES public.memberships (id) ON DELETE SET NULL,
  recipient_type text NOT NULL,
  amount_pence bigint NOT NULL,
  currency text NOT NULL DEFAULT 'GBP',
  status text NOT NULL DEFAULT 'pending',
  recipient_label text,
  payment_reference text,
  confirmed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settlements_recipient_type_check CHECK (
    recipient_type IN ('club', 'winner', 'platform')
  ),
  CONSTRAINT settlements_membership_when_winner CHECK (
    recipient_type <> 'winner' OR membership_id IS NOT NULL
  ),
  CONSTRAINT settlements_amount_pence_positive CHECK (amount_pence > 0),
  CONSTRAINT settlements_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT settlements_status_check CHECK (
    status IN ('pending', 'processing', 'confirmed', 'paid', 'failed', 'canceled')
  ),
  CONSTRAINT settlements_paid_at_when_paid CHECK (
    status <> 'paid' OR paid_at IS NOT NULL
  ),
  CONSTRAINT settlements_notes_len CHECK (
    notes IS NULL OR char_length(notes) <= 4000
  )
);

CREATE INDEX settlements_club_id_idx ON public.settlements (club_id);
CREATE INDEX settlements_draw_cycle_id_idx ON public.settlements (draw_cycle_id);
CREATE INDEX settlements_membership_id_idx ON public.settlements (membership_id);

-- ---------------------------------------------------------------------------
-- audit_events: append-only by convention (no updated_at)
-- ---------------------------------------------------------------------------
CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  club_id uuid REFERENCES public.clubs (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT audit_events_action_len CHECK (
    char_length(action) >= 1 AND char_length(action) <= 120
  ),
  CONSTRAINT audit_events_entity_type_len CHECK (
    char_length(entity_type) >= 1 AND char_length(entity_type) <= 120
  )
);

CREATE INDEX audit_events_club_id_created_at_idx ON public.audit_events (club_id, created_at DESC);
CREATE INDEX audit_events_entity_idx ON public.audit_events (entity_type, entity_id);
