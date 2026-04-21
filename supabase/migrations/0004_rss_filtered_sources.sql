-- Introduce a new source kind `rss_filtered`: fetch a site-wide RSS feed
-- and keep only items whose author/title/summary matches a byline regex.
-- Replaces brittle per-author scrapes for sites that block bots (Axios,
-- K-12 Dive) or that are client-rendered React apps (EdSurge, Education
-- Week, The Deep View).

alter table sources
  drop constraint if exists sources_kind_check;

alter table sources
  add constraint sources_kind_check
    check (kind in ('rss', 'scrape', 'rss_filtered'));

-- Rewire the broken sources. Using last name in the regex keeps the
-- match short and unambiguous (e.g. "Morrone" can't collide with other
-- bylines at Axios).
update sources s
set kind = 'rss_filtered',
    url  = v.new_url,
    selector = v.new_selector::jsonb
from (values
  -- Megan Morrone @ Axios
  ('https://www.axios.com/authors/mmorrone',
   'https://api.axios.com/api/rss/feed/',
   '{"byline_regex":"Morrone"}'),

  -- Alyson Klein @ Education Week
  ('https://www.edweek.org/by/alyson-klein',
   'https://feeds.feedburner.com/EducationWeekNews',
   '{"byline_regex":"Klein"}'),

  -- Sabrina Ortiz @ The Deep View
  ('https://www.thedeepview.com/author/sabrina-ortiz',
   'https://www.thedeepview.com/feed',
   '{"byline_regex":"Ortiz"}'),

  -- Lauren Coffey @ EdSurge
  ('https://www.edsurge.com/writers/lauren-coffey',
   'https://www.edsurge.com/articles_rss',
   '{"byline_regex":"Coffey"}'),

  -- Anna Merod @ K-12 Dive
  ('https://www.k12dive.com/users/amerod/',
   'https://www.k12dive.com/feeds/news/',
   '{"byline_regex":"Merod"}'),

  -- Daniel Mollenkamp @ EdSurge
  ('https://www.edsurge.com/writers/daniel-mollenkamp',
   'https://www.edsurge.com/articles_rss',
   '{"byline_regex":"Mollenkamp"}')
) as v(old_url, new_url, new_selector)
where s.url = v.old_url;
