-- Supabase Auth is the sole password authority. Keeping a second password hash
-- increases breach impact and serves no authentication purpose in this app.
alter table public.directors
  drop column if exists password_hash;
