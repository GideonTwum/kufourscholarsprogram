-- =============================================
-- Kufuor Scholars — News Articles
-- Run this in your Supabase SQL Editor
-- =============================================

create table if not exists public.news_articles (
  id uuid default gen_random_uuid() primary key,
  slug text not null unique,
  category text not null default 'Program',
  title text not null,
  excerpt text,
  body text,
  image text,
  featured boolean default false,
  read_time text default '3 min read',
  published_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_news_articles_slug on public.news_articles(slug);
create index if not exists idx_news_articles_published on public.news_articles(published_at desc);
create index if not exists idx_news_articles_featured on public.news_articles(featured) where featured = true;

alter table public.news_articles enable row level security;

create policy "Anyone can read news_articles" on public.news_articles
  for select using (true);

create policy "Directors can manage news_articles" on public.news_articles
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'director'
    )
  );

-- Seed with existing articles from lib/news-data
insert into public.news_articles (slug, category, title, excerpt, body, image, featured, read_time, published_at)
values
  ('applications-open-cohort-2026', 'Admissions', 'Applications Now Open for Cohort 2026',
   'The Kufuor Scholars Program is accepting applications for the 2026 cohort. Eligible candidates are encouraged to apply before the March 31 deadline.',
   'The John Agyekum Kufuor Foundation is pleased to announce that applications for the Kufuor Scholars Program Cohort 2026 are now open. This year, we are looking for outstanding young Ghanaians who demonstrate exceptional leadership potential, academic excellence, and a commitment to community service.

Eligible candidates must be enrolled in or recently graduated from a recognized university in Ghana. The application process includes submission of academic transcripts, a personal essay, a curriculum vitae, and two recommendation letters.

The deadline for applications is March 31, 2026. Shortlisted candidates will be invited for interviews in April, with final selections announced in May. The program commences in September 2026.

We encourage all eligible candidates to apply and join our growing community of future leaders dedicated to Africa''s development.',
   '/scholars14.jpg', true, '3 min read', '2026-02-10'),
  ('leadership-summit-record-attendance', 'Events', 'Annual Leadership Summit Draws Record Attendance',
   'Over 300 scholars, alumni, and mentors gathered for the Foundation''s flagship leadership summit in Accra.',
   'The 2026 Annual Leadership Summit, held at the Accra International Conference Centre, welcomed a record-breaking 300+ attendees, including current scholars, alumni, mentors, and distinguished guests from across Africa.

The two-day summit featured keynote addresses from prominent African leaders, panel discussions on governance and innovation, and interactive workshops on public speaking, negotiation, and strategic planning.

Highlights included a fireside chat with H.E. John Agyekum Kufuor, a networking dinner with industry leaders, and the launch of the Scholars Alumni Network mentorship matching platform.

Attendees praised the event for its depth of content and the quality of networking opportunities, with many describing it as the most impactful summit to date.',
   '/scholars12.jpg', false, '2 min read', '2026-01-25'),
  ('alumni-youth-tech-initiative', 'Alumni', 'Scholar Alumni Launches Youth Tech Initiative',
   'Cohort 2020 graduate Kwame Asante has launched a technology incubator aimed at empowering young entrepreneurs across West Africa.',
   'Kwame Asante, a proud graduate of the Kufuor Scholars Program Cohort 2020, has launched TechBridge Africa — a technology incubator focused on nurturing young entrepreneurs across West Africa.

The initiative, based in Accra with plans to expand to Lagos and Nairobi, provides aspiring tech founders with mentorship, seed funding, co-working space, and access to a network of investors and industry experts.

Kwame credits the Kufuor Scholars Program for shaping his vision. "The program taught me that true leadership is about creating opportunities for others. TechBridge is my way of giving back," he said.

The incubator has already onboarded its first cohort of 15 startups, spanning fintech, healthtech, and edtech sectors. The Foundation congratulates Kwame and looks forward to supporting TechBridge''s growth.',
   '/scholars13.jpg', false, '4 min read', '2026-01-12'),
  ('afdb-mentorship-partnership', 'Program', 'New Mentorship Partnership with African Development Bank',
   'The Foundation has signed an MOU with the AfDB to provide scholars with mentorship and internship opportunities.',
   'The John Agyekum Kufuor Foundation has signed a Memorandum of Understanding with the African Development Bank (AfDB) to create a structured mentorship and internship pathway for Kufuor Scholars.

Under the agreement, selected scholars will have the opportunity to undertake internships at AfDB offices across the continent, gaining hands-on experience in international development, economic policy, and project management.

Senior AfDB officials will also serve as mentors, providing guidance on careers in multilateral institutions and development finance.

This partnership represents a significant expansion of the program''s professional development offerings and reinforces the Foundation''s commitment to preparing scholars for leadership roles on the global stage.',
   '/scholars11.jpg', false, '2 min read', '2025-12-18'),
  ('community-service-week-2025', 'Events', 'Scholars Complete Annual Community Service Week',
   'Over 150 scholars participated in community service projects across five regions of Ghana, impacting thousands of lives.',
   'The Kufuor Scholars Program''s Annual Community Service Week saw over 150 scholars deploy to five regions of Ghana to carry out impactful community projects.

Projects ranged from health screening outreaches in rural communities to educational workshops in underserved schools, environmental clean-up campaigns, and technology literacy programs for women and youth.

The initiative, now in its eighth year, is a cornerstone of the program''s mission to cultivate socially responsible leaders. Scholars work in teams to plan, fundraise, and execute their projects, developing practical leadership and project management skills.

Communities in the Volta, Northern, Ashanti, Western, and Greater Accra regions benefited from this year''s activities, with an estimated 5,000 direct beneficiaries.',
   '/scholars10.jpg', false, '3 min read', '2025-11-30'),
  ('cohort-2025-graduation', 'Program', 'Cohort 2022 Celebrates Graduation from the Program',
   'Forty-five scholars graduated from the three-year program in a ceremony attended by dignitaries and alumni.',
   'The Foundation celebrated the graduation of Cohort 2022, with 45 scholars completing the rigorous three-year Kufuor Scholars Program.

The graduation ceremony, held at the Kufuor Foundation headquarters in Cantonments, Accra, was graced by H.E. John Agyekum Kufuor, government officials, corporate partners, and alumni from previous cohorts.

Graduating scholars received certificates of completion and were inducted into the Scholars Alumni Network. Several outstanding scholars were recognized with awards for academic excellence, leadership, and community service.

In his address, President Kufuor urged the graduates to remain committed to the values of integrity, patriotism, transparency, and accountability that the program instills.',
   '/scholars9.jpg', false, '3 min read', '2025-10-15')
on conflict (slug) do nothing;
