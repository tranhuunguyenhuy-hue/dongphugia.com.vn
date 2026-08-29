-- LEO-540 restored-runtime semantic report.
-- This emits aggregate counts and booleans only. Mutable table cardinality is
-- verified separately against restoreCounts from the exact backup manifest.
WITH required_tables(identity) AS (
  VALUES
    ('dpg_app.products'),
    ('dpg_app.product_images'),
    ('dpg_app.product_families'),
    ('dpg_app.product_family_memberships'),
    ('dpg_app.product_family_configuration_groups'),
    ('dpg_app.product_family_catalogue_gaps'),
    ('dpg_app.blog_posts'),
    ('dpg_app.blog_categories'),
    ('dpg_app.blog_tags'),
    ('dpg_app.blog_post_tags'),
    ('dpg_app.publishing_blog_post_media'),
    ('dpg_app.publishing_managed_media')
), expected_ms885(member_key, group_key, is_gap) AS (
  VALUES
    ('MS885DE2#XW', 'ecowasher', false), ('MS885DE4#XW', 'ecowasher', false),
    ('MS885DT2#XW', 'soft-close', false), ('MS885DT3#XW', 'soft-close', false),
    ('MS885DT8#XW', 'soft-close', false), ('MS885DW4#XW', 'electronic-washlet', true),
    ('MS885DW6#XW', 'electronic-washlet', false), ('MS885DW7#XW', 'electronic-washlet', false),
    ('MS885DW11#XW', 'electronic-washlet', false), ('MS885DW14#XW', 'electronic-washlet', false),
    ('MS885DW16#XW', 'electronic-washlet', false), ('MS885DW18#XW', 'electronic-washlet', true),
    ('MS885CDW12#XW', 'electronic-washlet', false), ('MS885CDW15#XW', 'electronic-washlet', false),
    ('MS885CDW17#XW', 'electronic-washlet', false), ('MS885CDW23#XW', 'electronic-washlet', false),
    ('MS885CDW24#XW', 'electronic-washlet', false), ('MS885CDW25#XW', 'electronic-washlet', false),
    ('MS885DW24#XW', 'electronic-washlet', false), ('MS885DW25#XW', 'electronic-washlet', false)
), actual_ms885 AS (
  SELECT product.sku, configuration_group.group_key
  FROM dpg_app.product_family_memberships membership
  JOIN dpg_app.product_families family ON family.id = membership.family_id
  JOIN dpg_app.product_family_configuration_groups configuration_group
    ON configuration_group.id = membership.configuration_group_id
  JOIN dpg_app.products product ON product.id = membership.product_id
  WHERE family.family_key = 'toto:ms885'
), bad_ms885_memberships AS (
  SELECT count(*)::integer AS value
  FROM (
    SELECT expected.member_key, expected.group_key
    FROM expected_ms885 expected
    LEFT JOIN actual_ms885 actual
      ON actual.sku = expected.member_key AND actual.group_key = expected.group_key
    WHERE NOT expected.is_gap AND actual.sku IS NULL
    UNION ALL
    SELECT actual.sku, actual.group_key
    FROM actual_ms885 actual
    LEFT JOIN expected_ms885 expected
      ON expected.member_key = actual.sku AND expected.group_key = actual.group_key
    WHERE expected.member_key IS NULL
  ) differences
), broken_blog_links AS (
  SELECT count(*)::integer AS value
  FROM (
    SELECT post.id
    FROM dpg_app.blog_posts post
    LEFT JOIN dpg_app.blog_categories category ON category.id = post.category_id
    WHERE category.id IS NULL
    UNION ALL
    SELECT tag_link.post_id
    FROM dpg_app.blog_post_tags tag_link
    LEFT JOIN dpg_app.blog_posts post ON post.id = tag_link.post_id
    LEFT JOIN dpg_app.blog_tags tag ON tag.id = tag_link.tag_id
    WHERE post.id IS NULL OR tag.id IS NULL
    UNION ALL
    SELECT media_link.post_id
    FROM dpg_app.publishing_blog_post_media media_link
    LEFT JOIN dpg_app.blog_posts post ON post.id = media_link.post_id
    LEFT JOIN dpg_app.publishing_managed_media media ON media.id = media_link.media_id
    WHERE post.id IS NULL OR media.id IS NULL
  ) broken
)
SELECT jsonb_build_object(
  'requiredTablesPresent', (
    SELECT bool_and(to_regclass(identity) IS NOT NULL) FROM required_tables
  ),
  'duplicateSkuCount', (
    SELECT count(*)::integer
    FROM (
      SELECT sku FROM dpg_app.products
      WHERE sku IS NOT NULL GROUP BY sku HAVING count(*) > 1
    ) duplicates
  ),
  'brokenBlogLinkCount', (SELECT value FROM broken_blog_links),
  'ms885FamilyCount', (
    SELECT count(*)::integer FROM dpg_app.product_families
    WHERE family_key = 'toto:ms885'
  ),
  'ms885MembershipCount', (SELECT count(*)::integer FROM actual_ms885),
  'ms885OpenGapCount', (
    SELECT count(*)::integer
    FROM dpg_app.product_family_catalogue_gaps gap
    JOIN dpg_app.product_families family ON family.id = gap.family_id
    WHERE family.family_key = 'toto:ms885' AND gap.status = 'open'
  ),
  'ms885AcceptedGapMatchCount', (
    SELECT count(*)::integer
    FROM dpg_app.product_family_catalogue_gaps gap
    JOIN dpg_app.product_families family ON family.id = gap.family_id
    WHERE family.family_key = 'toto:ms885' AND gap.status = 'open'
      AND gap.member_key IN ('MS885DW4#XW', 'MS885DW18#XW')
  ),
  'ms885UnexpectedOpenGapCount', (
    SELECT count(*)::integer
    FROM dpg_app.product_family_catalogue_gaps gap
    JOIN dpg_app.product_families family ON family.id = gap.family_id
    WHERE family.family_key = 'toto:ms885' AND gap.status = 'open'
      AND gap.member_key NOT IN ('MS885DW4#XW', 'MS885DW18#XW')
  ),
  'ms885BadMembershipCount', (SELECT value FROM bad_ms885_memberships),
  'ms885ExcludedMembershipCount', (
    SELECT count(*)::integer
    FROM dpg_app.product_family_memberships membership
    JOIN dpg_app.products product ON product.id = membership.product_id
    WHERE product.sku = 'MS885DE6#XW'
  )
)::text;
