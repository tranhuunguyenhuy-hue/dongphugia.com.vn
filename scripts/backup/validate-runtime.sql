-- LEO-540 restore acceptance. It emits only PASS or a generic failure class.
-- Do not add SELECTs that return row values, titles, URLs, or credentials.
DO $leo540_validate$
DECLARE
  failures integer := 0;
  duplicate_skus integer;
  product_count integer;
  product_image_count integer;
  blog_category_count integer;
  blog_post_count integer;
  blog_tag_count integer;
  blog_post_tag_count integer;
  blog_media_count integer;
  family_count integer;
  membership_count integer;
  gap_count integer;
  bad_memberships integer;
  bad_blog_links integer;
BEGIN
  IF to_regclass('dpg_app.products') IS NULL
    OR to_regclass('dpg_app.product_families') IS NULL
    OR to_regclass('dpg_app.product_family_memberships') IS NULL
    OR to_regclass('dpg_app.product_family_configuration_groups') IS NULL
    OR to_regclass('dpg_app.product_family_catalogue_gaps') IS NULL
  THEN failures := failures + 1; END IF;

  SELECT count(*) INTO duplicate_skus
  FROM (SELECT sku FROM dpg_app.products WHERE sku IS NOT NULL GROUP BY sku HAVING count(*) > 1) duplicates;
  IF duplicate_skus <> 0 THEN failures := failures + 1; END IF;
  SELECT count(*) INTO product_count FROM dpg_app.products;
  SELECT count(*) INTO product_image_count FROM dpg_app.product_images;
  IF product_count <> 17752 OR product_image_count <> 110321 THEN failures := failures + 1; END IF;

  SELECT count(*) INTO family_count
  FROM dpg_app.product_families WHERE family_key = 'toto:ms885';
  IF family_count <> 1 THEN failures := failures + 1; END IF;

  SELECT count(*) INTO membership_count
  FROM dpg_app.product_family_memberships membership
  JOIN dpg_app.product_families family ON family.id = membership.family_id
  WHERE family.family_key = 'toto:ms885';
  IF membership_count <> 18 THEN failures := failures + 1; END IF;

  SELECT count(*) INTO gap_count
  FROM dpg_app.product_family_catalogue_gaps gap
  JOIN dpg_app.product_families family ON family.id = gap.family_id
  WHERE family.family_key = 'toto:ms885'
    AND gap.status = 'open';
  IF gap_count <> 2 THEN failures := failures + 1; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM dpg_app.product_family_catalogue_gaps gap
    JOIN dpg_app.product_families family ON family.id = gap.family_id
    WHERE family.family_key = 'toto:ms885' AND gap.status = 'open'
      AND gap.member_key = 'MS885DW4#XW'
  ) OR NOT EXISTS (
    SELECT 1 FROM dpg_app.product_family_catalogue_gaps gap
    JOIN dpg_app.product_families family ON family.id = gap.family_id
    WHERE family.family_key = 'toto:ms885' AND gap.status = 'open'
      AND gap.member_key = 'MS885DW18#XW'
  ) THEN failures := failures + 1; END IF;

  WITH expected(member_key, group_key, is_gap) AS (
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
  ), actual AS (
    SELECT product.sku, configuration_group.group_key
    FROM dpg_app.product_family_memberships membership
    JOIN dpg_app.product_families family ON family.id = membership.family_id
    JOIN dpg_app.product_family_configuration_groups configuration_group
      ON configuration_group.id = membership.configuration_group_id
    JOIN dpg_app.products product ON product.id = membership.product_id
    WHERE family.family_key = 'toto:ms885'
  )
  SELECT count(*) INTO bad_memberships
  FROM (
    SELECT expected.member_key, expected.group_key
    FROM expected LEFT JOIN actual ON actual.sku = expected.member_key AND actual.group_key = expected.group_key
    WHERE NOT expected.is_gap AND actual.sku IS NULL
    UNION ALL
    SELECT actual.sku, actual.group_key
    FROM actual LEFT JOIN expected ON expected.member_key = actual.sku AND expected.group_key = actual.group_key
    WHERE expected.member_key IS NULL
  ) differences;
  IF bad_memberships <> 0 THEN failures := failures + 1; END IF;
  IF EXISTS (
    SELECT 1
    FROM dpg_app.product_family_memberships membership
    JOIN dpg_app.products product ON product.id = membership.product_id
    WHERE product.sku = 'MS885DE6#XW'
  ) THEN failures := failures + 1; END IF;

  IF to_regclass('dpg_app.blog_posts') IS NULL
    OR to_regclass('dpg_app.blog_categories') IS NULL
    OR to_regclass('dpg_app.blog_tags') IS NULL
    OR to_regclass('dpg_app.blog_post_tags') IS NULL
    OR to_regclass('dpg_app.publishing_blog_post_media') IS NULL
  THEN failures := failures + 1; END IF;

  SELECT count(*) INTO bad_blog_links
  FROM (
    SELECT post.id FROM dpg_app.blog_posts post
    LEFT JOIN dpg_app.blog_categories category ON category.id = post.category_id
    WHERE category.id IS NULL
    UNION ALL
    SELECT tag_link.post_id FROM dpg_app.blog_post_tags tag_link
    LEFT JOIN dpg_app.blog_posts post ON post.id = tag_link.post_id
    LEFT JOIN dpg_app.blog_tags tag ON tag.id = tag_link.tag_id
    WHERE post.id IS NULL OR tag.id IS NULL
    UNION ALL
    SELECT media_link.post_id FROM dpg_app.publishing_blog_post_media media_link
    LEFT JOIN dpg_app.blog_posts post ON post.id = media_link.post_id
    LEFT JOIN dpg_app.publishing_managed_media media ON media.id = media_link.media_id
    WHERE post.id IS NULL OR media.id IS NULL
  ) broken_links;
  IF bad_blog_links <> 0 THEN failures := failures + 1; END IF;
  SELECT count(*) INTO blog_category_count FROM dpg_app.blog_categories;
  SELECT count(*) INTO blog_post_count FROM dpg_app.blog_posts;
  SELECT count(*) INTO blog_tag_count FROM dpg_app.blog_tags;
  SELECT count(*) INTO blog_post_tag_count FROM dpg_app.blog_post_tags;
  SELECT count(*) INTO blog_media_count FROM dpg_app.publishing_blog_post_media;
  IF blog_category_count <> 6 OR blog_post_count <> 17 OR blog_tag_count <> 0
    OR blog_post_tag_count <> 0 OR blog_media_count <> 92
  THEN failures := failures + 1; END IF;

  IF failures <> 0 THEN RAISE EXCEPTION 'LEO540_RUNTIME_VALIDATION_FAILED'; END IF;
END
$leo540_validate$;

SELECT 'LEO540_RUNTIME_VALIDATION status=PASS';
