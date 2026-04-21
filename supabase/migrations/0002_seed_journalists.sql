-- Power10 Journalist Desk — seed journalists + sources

-- Deterministic UUIDs via md5() so re-running seeds is idempotent
-- (cast the first 32 hex chars of md5 to uuid).

with j as (
  insert into journalists (id, slug, first_name, last_name, display_name, outlets, display_outlet, sort_order)
  values
    (('00000000-0000-0000-0000-' || substr(md5('megan-morrone'), 1, 12))::uuid,
      'megan-morrone', 'Megan', 'Morrone', 'Megan Morrone',
      array['Axios'], 'Axios', 10),

    (('00000000-0000-0000-0000-' || substr(md5('micah-ward'), 1, 12))::uuid,
      'micah-ward', 'Micah', 'Ward', 'Micah Ward',
      array['District Administration','University Business'],
      'District Administration · University Business', 20),

    (('00000000-0000-0000-0000-' || substr(md5('alyson-klein'), 1, 12))::uuid,
      'alyson-klein', 'Alyson', 'Klein', 'Alyson Klein',
      array['Education Week'], 'Education Week', 30),

    (('00000000-0000-0000-0000-' || substr(md5('alex-sarlin'), 1, 12))::uuid,
      'alex-sarlin', 'Alex', 'Sarlin', 'Alex Sarlin',
      array['Edtech Insiders'], 'Edtech Insiders (Substack)', 40),

    (('00000000-0000-0000-0000-' || substr(md5('laura-ascione'), 1, 12))::uuid,
      'laura-ascione', 'Laura', 'Ascione', 'Laura Ascione',
      array['eSchool News','eSchool Media'],
      'eSchool News · eSchool Media', 50),

    (('00000000-0000-0000-0000-' || substr(md5('kavitha-cardoza'), 1, 12))::uuid,
      'kavitha-cardoza', 'Kavitha', 'Cardoza', 'Kavitha Cardoza',
      array['The Hechinger Report'], 'The Hechinger Report', 60),

    (('00000000-0000-0000-0000-' || substr(md5('sabrina-ortiz'), 1, 12))::uuid,
      'sabrina-ortiz', 'Sabrina', 'Ortiz', 'Sabrina Ortiz',
      array['The Deep View'], 'The Deep View', 70),

    (('00000000-0000-0000-0000-' || substr(md5('ray-ravaglia'), 1, 12))::uuid,
      'ray-ravaglia', 'Ray', 'Ravaglia', 'Ray Ravaglia',
      array['Forbes'], 'Forbes', 80),

    (('00000000-0000-0000-0000-' || substr(md5('lauren-coffey'), 1, 12))::uuid,
      'lauren-coffey', 'Lauren', 'Coffey', 'Lauren Coffey',
      array['EdSurge'], 'EdSurge', 90),

    (('00000000-0000-0000-0000-' || substr(md5('anna-merod'), 1, 12))::uuid,
      'anna-merod', 'Anna', 'Merod', 'Anna Merod',
      array['K-12 Dive'], 'K-12 Dive', 100),

    (('00000000-0000-0000-0000-' || substr(md5('daniel-mollenkamp'), 1, 12))::uuid,
      'daniel-mollenkamp', 'Daniel', 'Mollenkamp', 'Daniel Mollenkamp',
      array['EdSurge'], 'EdSurge', 110)
  on conflict (slug) do update set
    first_name     = excluded.first_name,
    last_name      = excluded.last_name,
    display_name   = excluded.display_name,
    outlets        = excluded.outlets,
    display_outlet = excluded.display_outlet,
    sort_order     = excluded.sort_order
  returning id, slug
)
select 1 from j;

-- Sources per journalist. RSS where available; otherwise scrape with
-- per-site cheerio selectors stored in `selector`.
with j as (select id, slug from journalists)
insert into sources (journalist_id, outlet, kind, url, selector)
select j.id, s.outlet, s.kind, s.url, s.selector::jsonb
from j
join (values
  ('megan-morrone', 'Axios', 'scrape',
    'https://www.axios.com/authors/mmorrone',
    '{"item":"article, li[data-testid=\"story\"], div[data-cy=\"story-list\"] article","title":"h2 a, h3 a","link":"h2 a@href, h3 a@href","date":"time@datetime","summary":"p"}'),

  ('micah-ward', 'District Administration', 'rss',
    'https://districtadministration.com/author/mward/feed/', null),
  ('micah-ward', 'University Business', 'rss',
    'https://universitybusiness.com/author/micah/feed/', null),

  ('alyson-klein', 'Education Week', 'scrape',
    'https://www.edweek.org/by/alyson-klein',
    '{"item":"article, li.story-listing-item","title":"h2 a, h3 a, a.story-listing-item__title","link":"h2 a@href, h3 a@href, a.story-listing-item__title@href","date":"time@datetime","summary":"p.story-listing-item__summary, p"}'),

  ('alex-sarlin', 'Edtech Insiders', 'rss',
    'https://edtechinsiders.substack.com/feed', null),

  ('laura-ascione', 'eSchool News', 'rss',
    'https://www.eschoolnews.com/author/ldevaney/feed/', null),
  ('laura-ascione', 'eSchool Media', 'rss',
    'https://eschoolmedia.com/author/ldevaney/feed/', null),

  ('kavitha-cardoza', 'The Hechinger Report', 'rss',
    'https://hechingerreport.org/author/kavitha-cardoza/feed/', null),

  ('sabrina-ortiz', 'The Deep View', 'scrape',
    'https://www.thedeepview.com/author/sabrina-ortiz',
    '{"item":"article, a[href*=\"/p/\"]","title":"h1, h2, h3","link":"self@href","date":"time@datetime","summary":"p"}'),

  ('ray-ravaglia', 'Forbes', 'rss',
    'https://www.forbes.com/sites/rayravaglia/feed/', null),

  ('lauren-coffey', 'EdSurge', 'scrape',
    'https://www.edsurge.com/writers/lauren-coffey',
    '{"item":"article, li.article-teaser, div.article-card","title":"h2 a, h3 a, a.article-teaser__title","link":"h2 a@href, h3 a@href, a.article-teaser__title@href","date":"time@datetime","summary":"p.article-teaser__snippet, p"}'),

  ('anna-merod', 'K-12 Dive', 'scrape',
    'https://www.k12dive.com/users/amerod/',
    '{"item":"article, li.feed__item","title":"h2 a, h3 a","link":"h2 a@href, h3 a@href","date":"time@datetime, .feed__meta@datetime","summary":"p.feed__description, p"}'),

  ('daniel-mollenkamp', 'EdSurge', 'scrape',
    'https://www.edsurge.com/writers/daniel-mollenkamp',
    '{"item":"article, li.article-teaser, div.article-card","title":"h2 a, h3 a, a.article-teaser__title","link":"h2 a@href, h3 a@href, a.article-teaser__title@href","date":"time@datetime","summary":"p.article-teaser__snippet, p"}')
) as s(slug, outlet, kind, url, selector) on j.slug = s.slug
on conflict (journalist_id, url) do update set
  outlet   = excluded.outlet,
  kind     = excluded.kind,
  selector = excluded.selector,
  enabled  = true;
