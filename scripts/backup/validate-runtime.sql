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
    ('dpg_app.publishing_managed_media'),
    ('dpg_v1.staff_users'),
    ('dpg_v1.staff_user_roles'),
    ('dpg_v1.role_capabilities'),
    ('dpg_v1.media_assets'),
    ('dpg_v1.media_variants'),
    ('dpg_v1.brands'),
    ('dpg_v1.categories'),
    ('dpg_v1.product_families'),
    ('dpg_v1.product_family_configuration_groups'),
    ('dpg_v1.products'),
    ('dpg_v1.product_family_memberships'),
    ('dpg_v1.product_source_provenance'),
    ('dpg_v1.collections'),
    ('dpg_v1.collection_products'),
    ('dpg_v1.attribute_definitions'),
    ('dpg_v1.attribute_options'),
    ('dpg_v1.category_attribute_policies'),
    ('dpg_v1.product_attribute_values'),
    ('dpg_v1.product_attribute_multi_options'),
    ('dpg_v1.product_media'),
    ('dpg_v1.product_documents'),
    ('dpg_v1.content_entries'),
    ('dpg_v1.content_blocks'),
    ('dpg_v1.content_product_references'),
    ('dpg_v1.content_category_references'),
    ('dpg_v1.content_brand_references'),
    ('dpg_v1.quote_requests'),
    ('dpg_v1.quote_request_lines'),
    ('dpg_v1.quotes'),
    ('dpg_v1.quote_lines'),
    ('dpg_v1.quote_shares'),
    ('dpg_v1.orders'),
    ('dpg_v1.order_lines'),
    ('dpg_v1.payment_transactions'),
    ('dpg_v1.commerce_idempotency_records'),
    ('dpg_v1.service_idempotency_records')
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
), v1_media_key_violations AS (
  SELECT count(*)::integer AS value
  FROM dpg_v1.media_assets asset
  WHERE not coalesce((
    (
      asset.kind = 'IMAGE'
      AND asset.profile_version = 'product-v1'
      AND asset.original_object_key = 'private/originals/v1/'
        || left(btrim(asset.sha256), 2) || '/' || btrim(asset.sha256)
        || '/source.' || case asset.mime_type
          when 'image/jpeg' then 'jpg'
          when 'image/png' then 'png'
          when 'image/webp' then 'webp'
        end
      AND asset.delivery_object_key ~ (
        '^public/images/product-v1/' || btrim(asset.sha256)
        || '/w(320|640|1280)-[0-9a-f]{64}\.webp$'
      )
    )
    OR (
      asset.kind = 'DOCUMENT'
      AND asset.profile_version is null
      AND asset.mime_type = 'application/pdf'
      AND asset.original_object_key = 'private/originals/v1/'
        || left(btrim(asset.sha256), 2) || '/' || btrim(asset.sha256)
        || '/source.pdf'
      AND asset.delivery_object_key = 'public/documents/v1/'
        || btrim(asset.sha256) || '/document.pdf'
    )
  ), false)
), v1_orphan_media_references AS (
  SELECT count(*)::integer AS value
  FROM (
    SELECT pm.id
    FROM dpg_v1.product_media pm
    LEFT JOIN dpg_v1.media_assets ma ON ma.id = pm.media_asset_id
    WHERE ma.id is null OR ma.kind <> 'IMAGE' OR ma.state <> 'READY'
    UNION ALL
    SELECT pd.id
    FROM dpg_v1.product_documents pd
    LEFT JOIN dpg_v1.media_assets ma ON ma.id = pd.media_asset_id
    WHERE ma.id is null OR ma.kind <> 'DOCUMENT' OR ma.state <> 'READY'
  ) broken
), v1_primary_media_violations AS (
  SELECT count(*)::integer AS value
  FROM dpg_v1.products product
  WHERE product.status = 'PUBLISHED'
    AND not exists (
      SELECT 1
      FROM dpg_v1.product_media pm
      JOIN dpg_v1.media_assets ma ON ma.id = pm.media_asset_id
      WHERE pm.product_id = product.id
        AND pm.role = 'PRIMARY'
        AND ma.kind = 'IMAGE'
        AND ma.state = 'READY'
    )
), v1_ready_image_variant_violations AS (
  SELECT count(*)::integer AS value
  FROM dpg_v1.media_assets asset
  WHERE asset.kind = 'IMAGE' AND asset.state = 'READY'
    AND (
      (SELECT count(*) FROM dpg_v1.media_variants variant
       WHERE variant.media_asset_id = asset.id) not between 1 and 3
      OR not exists (
        SELECT 1 FROM dpg_v1.media_variants variant
        WHERE variant.media_asset_id = asset.id
          AND variant.delivery_object_key = asset.delivery_object_key
      )
      OR exists (
        SELECT 1 FROM dpg_v1.media_variants variant
        WHERE variant.media_asset_id = asset.id
          AND (variant.profile_version <> 'product-v1'
            OR variant.mime_type <> 'image/webp'
            OR variant.width_px > variant.target_width_px
            OR variant.delivery_object_key <> 'public/images/product-v1/'
              || btrim(asset.sha256) || '/w' || variant.target_width_px
              || '-' || btrim(variant.sha256) || '.webp')
      )
    )
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
  ),
  'v1MediaAssetCount', (SELECT count(*)::integer FROM dpg_v1.media_assets),
  'v1MediaVariantCount', (SELECT count(*)::integer FROM dpg_v1.media_variants),
  'v1PendingMediaCount', (
    SELECT count(*)::integer FROM dpg_v1.media_assets WHERE state = 'PENDING'
  ),
  'v1ReadyMediaCount', (
    SELECT count(*)::integer FROM dpg_v1.media_assets WHERE state = 'READY'
  ),
  'v1TombstonedMediaCount', (
    SELECT count(*)::integer FROM dpg_v1.media_assets WHERE state = 'TOMBSTONED'
  ),
  'v1ProductCount', (SELECT count(*)::integer FROM dpg_v1.products),
  'v1ProductFamilyCount', (SELECT count(*)::integer FROM dpg_v1.product_families),
  'v1FamilyMembershipCount', (
    SELECT count(*)::integer FROM dpg_v1.product_family_memberships
  ),
  'v1StaffUserCount', (SELECT count(*)::integer FROM dpg_v1.staff_users),
  'v1StaffRoleCount', (SELECT count(*)::integer FROM dpg_v1.staff_user_roles),
  'v1QuoteCount', (SELECT count(*)::integer FROM dpg_v1.quotes),
  'v1OrderCount', (SELECT count(*)::integer FROM dpg_v1.orders),
  'v1PaymentTransactionCount', (
    SELECT count(*)::integer FROM dpg_v1.payment_transactions
  ),
  'v1OrphanMediaReferenceCount', (SELECT value FROM v1_orphan_media_references),
  'v1MediaKeyViolationCount', (SELECT value FROM v1_media_key_violations),
  'v1PrimaryMediaViolationCount', (SELECT value FROM v1_primary_media_violations),
  'v1ReadyWithoutProviderVerificationCount', (
    SELECT count(*)::integer
    FROM dpg_v1.media_assets
    WHERE state = 'READY'
      AND (provider_name <> 'bunny' OR provider_verified_at is null)
  ),
  'v1ReadyImageVariantViolationCount', (
    SELECT value FROM v1_ready_image_variant_violations
  )
)::text;
