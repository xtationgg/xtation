# XTATION Operator Setup V1

This is the recommended path for real cloud operator access in XTATION.

## Goal

Give specific signed-in accounts an `xtation_role` claim in their JWT so the Admin Console can safely use:

- cloud station lookup
- cloud rollout updates
- cloud operator audit feed

## Apply SQL

Preferred:

1. run [xtation_cloud_stack.sql](/Users/sarynass/dyad-apps/CLient-D82pm/supabase/xtation_cloud_stack.sql)

Reference order if you prefer separate files:

1. [platform_profiles.sql](/Users/sarynass/dyad-apps/CLient-D82pm/supabase/platform_profiles.sql)
2. [operator_claim_bootstrap.sql](/Users/sarynass/dyad-apps/CLient-D82pm/supabase/operator_claim_bootstrap.sql)
3. [operator_lookup.sql](/Users/sarynass/dyad-apps/CLient-D82pm/supabase/operator_lookup.sql)
4. [operator_diagnostics.sql](/Users/sarynass/dyad-apps/CLient-D82pm/supabase/operator_diagnostics.sql)
5. [operator_rollout.sql](/Users/sarynass/dyad-apps/CLient-D82pm/supabase/operator_rollout.sql)
6. [operator_audit_feed.sql](/Users/sarynass/dyad-apps/CLient-D82pm/supabase/operator_audit_feed.sql)

## Enable the JWT claim hook

Recommended:

1. Open Supabase Dashboard
2. Go to `Authentication -> Hooks`
3. Set the `Custom Access Token Hook` to:
   - `public.xtation_custom_access_token_hook`

If you already use another custom access token hook, do not replace it blindly. Merge XTATION by calling:

```sql
public.xtation_apply_operator_claim(event->'claims', (event->>'user_id')::uuid)
```

and then writing the returned JSON back into `event.claims`.

## Seed your first operator

Example:

```sql
select public.xtation_seed_operator_role('you@example.com', 'super_admin');
```

Allowed roles:

- `super_admin`
- `ops_admin`
- `support_admin`
- `beta_manager`

## Refresh the session

After seeding the role:

1. sign out
2. sign back in

The new JWT should now include `xtation_role`.

## What Admin will show

Once setup is correct, the Admin Console should move from:

- `no xtation_role`
- `lookup blocked`

to:

- your operator role
- `lookup ready`

## Notes

- `env allowlist` local/dev access is still useful, but it does not replace JWT operator claims for cloud actions.
- Cloud lookup, rollout, and audit stay blocked until the signed-in token carries `xtation_role`.
- This path is safer than depending on manual edits to `raw_app_meta_data` for each operator.
