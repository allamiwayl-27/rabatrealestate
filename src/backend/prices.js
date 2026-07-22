/**
 * getPrices — extracted from app.js
 * Factory: makeGetPrices({ pool, DB_TABLES, normalize, expandLocationTerms })
 */
const { parsePagination, computePaginationMeta } = require('./helpers.js');
const sql = require('./sql-fragments');

module.exports = function makeGetPrices({ pool, DB_TABLES, normalize, expandLocationTerms }) {

  return async function getPrices(query) {
    const transaction = String(query?.get('transaction') || '').trim();
    const location = normalize(query?.get('location'));
    const propertyType = String(query?.get('propertyType') || '').trim();
    const agency = String(query?.get('agency') || '').trim();
    const benchmarkModeRaw = String(query?.get('benchmarkMode') || 'auto').trim().toLowerCase();
    const benchmarkMode = ['auto', 'typed', 'fallback'].includes(benchmarkModeRaw) ? benchmarkModeRaw : 'auto';
    const min = Number(query?.get('priceMin'));
    const max = Number(query?.get('priceMax'));
    const { page, pageSize } = parsePagination(query);

    let statuses = ['vente'];
    if (transaction === 'Location') statuses = ['location'];
    if (transaction === 'Achat' || transaction === 'Vente') statuses = ['vente'];

    const where_clauses = [];
    const values = [statuses];
    let paramIndex = 2;

    if (location) {
      const terms = expandLocationTerms(location);
      const parts = [];
      const locationExpr = `COALESCE(NULLIF(TRIM(l.quartier),''), NULLIF(TRIM(l.ville),''))`;
      for (const term of terms) {
        parts.push(`${sql.normalizeExpr(locationExpr)} = ${sql.normalizeExpr(`CAST($${paramIndex} AS text)`)}`);
        values.push(term);
        paramIndex += 1;
      }
      if (parts.length) where_clauses.push(`(${parts.join(' OR ')})`);
    }
    if (propertyType) {
      where_clauses.push(`LOWER(COALESCE(a.type_bien,'')) = LOWER($${paramIndex})`);
      values.push(propertyType);
      paramIndex++;
    }
    if (agency) {
      where_clauses.push(`
        EXISTS (
          SELECT 1
          FROM ${DB_TABLES.contacts} ct2
          WHERE ct2.annonce_id = a.id
            AND LOWER(NULLIF(TRIM(COALESCE(ct2.agence_nom,'')), '')) = LOWER($${paramIndex})
        )
      `);
      values.push(agency);
      paramIndex++;
    }
    if (Number.isFinite(min) && min > 0) {
      where_clauses.push(`a.prix >= $${paramIndex}`);
      values.push(Number(min));
      paramIndex++;
    }
    if (Number.isFinite(max) && max > 0) {
      where_clauses.push(`a.prix <= $${paramIndex}`);
      values.push(Number(max));
      paramIndex++;
    }

    where_clauses.unshift(`a.statut = ANY($1::text[])`);
    where_clauses.push(`a.prix IS NOT NULL`);
    where_clauses.push(`a.prix > 0`);
    where_clauses.push(`a.surface IS NOT NULL`);
    where_clauses.push(`a.surface > 0`);
    where_clauses.push(`l.quartier IS NOT NULL`);
    where_clauses.push(`l.quartier != 'N/A'`);

    const where = `WHERE ${where_clauses.join(' AND ')}`;

    // Count total results before pagination
    const countValues = [...values];
    const countRes = await pool.query(
      `
      WITH base AS (
        SELECT
          ${sql.districtCase('l.quartier', 'l.ville')} AS district,
          a.statut,
          ${sql.propertyTypeCase('a.type_bien')} AS property_type_segment,
          a.prix,
          a.surface,
          (a.prix / NULLIF(a.surface, 0)) AS prix_m2,
          DATE_TRUNC('month', COALESCE(a.date_mise_a_jour, a.date_publication, a.date_scraped, NOW())) AS mois
        FROM ${DB_TABLES.annonces} a
        JOIN ${DB_TABLES.localisations} l ON l.annonce_id = a.id
        ${where}
      ),
      filtered AS (
        SELECT *
        FROM base
        WHERE ${sql.priceRangeFilter('statut', 'prix', 'surface')}
      ),
      segmented_stats AS (
        SELECT
          district,
          statut,
          property_type_segment,
          COUNT(*)::int AS nb_annonces,
          ROUND(AVG(surface)::numeric, 0) AS surface_moyenne,
          ROUND(AVG(prix)::numeric, 0) AS prix_moyen,
          ROUND(AVG(prix_m2)::numeric, 0) AS prix_m2_moyen
        FROM filtered
        GROUP BY district, statut, property_type_segment
        HAVING COUNT(*) >= 5
      ),
      district_stats AS (
        SELECT
          district,
          statut,
          COUNT(*)::int AS nb_annonces,
          ROUND(AVG(surface)::numeric, 0) AS surface_moyenne,
          ROUND(AVG(prix)::numeric, 0) AS prix_moyen,
          ROUND(AVG(prix_m2)::numeric, 0) AS prix_m2_moyen
        FROM filtered
        GROUP BY district, statut
        HAVING COUNT(*) >= 8
      ),
      minimal_stats AS (
        SELECT
          district,
          statut,
          'Tous types'::text AS property_type,
          'minimal'::text AS segment_scope
        FROM filtered
        GROUP BY district, statut
        HAVING COUNT(*) >= 1
      ),
      final_rows AS (
        SELECT
          district,
          statut,
          property_type_segment AS property_type,
          'typed'::text AS segment_scope
        FROM segmented_stats
        UNION ALL
        SELECT
          district,
          statut,
          'Tous types'::text AS property_type,
          'fallback'::text AS segment_scope
        FROM district_stats s
        WHERE NOT EXISTS (
          SELECT 1
          FROM segmented_stats ss
          WHERE ss.district = s.district
            AND ss.statut = s.statut
        )
        UNION ALL
        SELECT
          district,
          statut,
          'Tous types'::text AS property_type,
          'minimal'::text AS segment_scope
        FROM minimal_stats s
        WHERE NOT EXISTS (
          SELECT 1 FROM district_stats ds
          WHERE ds.district = s.district AND ds.statut = s.statut
        )
      )
      SELECT COUNT(*)::int AS total FROM final_rows
      `,
      countValues
    );

    const total = Number(countRes.rows[0]?.total || 0);
    const meta = computePaginationMeta(total, page, pageSize);
    const { safePage } = meta;
    const offset = (safePage - 1) * pageSize;

    // Get paginated results
    const paginationValues = [...values, pageSize, offset];
    const pageParam = paramIndex;
    const offsetParam = paramIndex + 1;

    const { rows } = await pool.query(
      `
      WITH base AS (
        SELECT
          ${sql.districtCase('l.quartier', 'l.ville')} AS district,
          a.statut,
          ${sql.propertyTypeCase('a.type_bien')} AS property_type_segment,
          a.prix,
          a.surface,
          (a.prix / NULLIF(a.surface, 0)) AS prix_m2,
          DATE_TRUNC('month', COALESCE(a.date_mise_a_jour, a.date_publication, a.date_scraped, NOW())) AS mois
        FROM ${DB_TABLES.annonces} a
        JOIN ${DB_TABLES.localisations} l ON l.annonce_id = a.id
        ${where}
      ),
      filtered AS (
        SELECT *
        FROM base
        WHERE ${sql.priceRangeFilter('statut', 'prix', 'surface')}
      ),
      segmented_stats AS (
        SELECT
          district,
          statut,
          property_type_segment,
          COUNT(*)::int AS nb_annonces,
          ROUND(AVG(surface)::numeric, 0) AS surface_moyenne,
          ROUND(AVG(prix)::numeric, 0) AS prix_moyen,
          ROUND(AVG(prix_m2)::numeric, 0) AS prix_m2_moyen,
          ROUND(MIN(prix_m2)::numeric, 0) AS prix_m2_min,
          ROUND(MAX(prix_m2)::numeric, 0) AS prix_m2_max
        FROM filtered
        GROUP BY district, statut, property_type_segment
        HAVING COUNT(*) >= 5
      ),
      segmented_monthly AS (
        SELECT
          district,
          statut,
          property_type_segment,
          mois,
          AVG(prix_m2) AS prix_m2_moyen_mois,
          COUNT(*)::int AS nb_annonces_mois
        FROM filtered
        GROUP BY district, statut, property_type_segment, mois
        HAVING COUNT(*) >= 3
      ),
      segmented_monthly_ranked AS (
        SELECT
          district,
          statut,
          property_type_segment,
          prix_m2_moyen_mois,
          nb_annonces_mois,
          ROW_NUMBER() OVER (PARTITION BY district, statut, property_type_segment ORDER BY mois DESC) AS rn
        FROM segmented_monthly
      ),
      segmented_trend AS (
        SELECT
          district,
          statut,
          property_type_segment,
          MAX(CASE WHEN rn = 1 THEN prix_m2_moyen_mois END) AS last_ppm2,
          MAX(CASE WHEN rn = 2 THEN prix_m2_moyen_mois END) AS prev_ppm2,
          MAX(CASE WHEN rn = 1 THEN nb_annonces_mois END)::int AS last_month_samples,
          MAX(CASE WHEN rn = 2 THEN nb_annonces_mois END)::int AS prev_month_samples
        FROM segmented_monthly_ranked
        WHERE rn <= 2
        GROUP BY district, statut, property_type_segment
      ),
      segmented_rows AS (
        SELECT
          s.district,
          s.statut,
          s.property_type_segment AS property_type,
          'typed'::text AS segment_scope,
          s.nb_annonces,
          s.surface_moyenne,
          s.prix_moyen,
          s.prix_m2_moyen,
          s.prix_m2_min,
          s.prix_m2_max,
          COALESCE(t.last_month_samples, 0) AS last_month_samples,
          COALESCE(t.prev_month_samples, 0) AS prev_month_samples,
          ROUND(
            COALESCE(
              ((t.last_ppm2 - t.prev_ppm2) / NULLIF(t.prev_ppm2, 0) * 100),
              0
            )::numeric,
            1
          ) AS variation_pct
        FROM segmented_stats s
        LEFT JOIN segmented_trend t
          ON t.district = s.district
         AND t.statut = s.statut
         AND t.property_type_segment = s.property_type_segment
      ),
      district_stats AS (
        SELECT
          district,
          statut,
          COUNT(*)::int AS nb_annonces,
          ROUND(AVG(surface)::numeric, 0) AS surface_moyenne,
          ROUND(AVG(prix)::numeric, 0) AS prix_moyen,
          ROUND(AVG(prix_m2)::numeric, 0) AS prix_m2_moyen,
          ROUND(MIN(prix_m2)::numeric, 0) AS prix_m2_min,
          ROUND(MAX(prix_m2)::numeric, 0) AS prix_m2_max
        FROM filtered
        GROUP BY district, statut
        HAVING COUNT(*) >= 8
      ),
      district_monthly AS (
        SELECT
          district,
          statut,
          mois,
          AVG(prix_m2) AS prix_m2_moyen_mois,
          COUNT(*)::int AS nb_annonces_mois
        FROM filtered
        GROUP BY district, statut, mois
        HAVING COUNT(*) >= 3
      ),
      district_monthly_ranked AS (
        SELECT
          district,
          statut,
          prix_m2_moyen_mois,
          nb_annonces_mois,
          ROW_NUMBER() OVER (PARTITION BY district, statut ORDER BY mois DESC) AS rn
        FROM district_monthly
      ),
      district_trend AS (
        SELECT
          district,
          statut,
          MAX(CASE WHEN rn = 1 THEN prix_m2_moyen_mois END) AS last_ppm2,
          MAX(CASE WHEN rn = 2 THEN prix_m2_moyen_mois END) AS prev_ppm2,
          MAX(CASE WHEN rn = 1 THEN nb_annonces_mois END)::int AS last_month_samples,
          MAX(CASE WHEN rn = 2 THEN nb_annonces_mois END)::int AS prev_month_samples
        FROM district_monthly_ranked
        WHERE rn <= 2
        GROUP BY district, statut
      ),
      fallback_rows AS (
        SELECT
          s.district,
          s.statut,
          'Tous types'::text AS property_type,
          'fallback'::text AS segment_scope,
          s.nb_annonces,
          s.surface_moyenne,
          s.prix_moyen,
          s.prix_m2_moyen,
          s.prix_m2_min,
          s.prix_m2_max,
          COALESCE(t.last_month_samples, 0) AS last_month_samples,
          COALESCE(t.prev_month_samples, 0) AS prev_month_samples,
          ROUND(
            COALESCE(
              ((t.last_ppm2 - t.prev_ppm2) / NULLIF(t.prev_ppm2, 0) * 100),
              0
            )::numeric,
            1
          ) AS variation_pct
        FROM district_stats s
        LEFT JOIN district_trend t ON t.district = s.district AND t.statut = s.statut
        WHERE NOT EXISTS (
          SELECT 1
          FROM segmented_stats ss
          WHERE ss.district = s.district
            AND ss.statut = s.statut
        )
      ),
      minimal_stats AS (
        SELECT
          district,
          statut,
          'Tous types'::text AS property_type,
          'minimal'::text AS segment_scope,
          COUNT(*)::int AS nb_annonces,
          ROUND(AVG(surface)::numeric, 0) AS surface_moyenne,
          ROUND(AVG(prix)::numeric, 0) AS prix_moyen,
          ROUND(AVG(prix_m2)::numeric, 0) AS prix_m2_moyen,
          ROUND(MIN(prix_m2)::numeric, 0) AS prix_m2_min,
          ROUND(MAX(prix_m2)::numeric, 0) AS prix_m2_max,
          0::int AS last_month_samples,
          0::int AS prev_month_samples,
          0::numeric AS variation_pct
        FROM filtered
        GROUP BY district, statut
        HAVING COUNT(*) >= 1
      ),
      minimal_rows AS (
        SELECT
          s.district,
          s.statut,
          s.property_type,
          s.segment_scope,
          s.nb_annonces,
          s.surface_moyenne,
          s.prix_moyen,
          s.prix_m2_moyen,
          s.prix_m2_min,
          s.prix_m2_max,
          s.last_month_samples,
          s.prev_month_samples,
          s.variation_pct
        FROM minimal_stats s
        WHERE NOT EXISTS (
          SELECT 1 FROM district_stats ds
          WHERE ds.district = s.district AND ds.statut = s.statut
        )
      ),
      final_rows AS (
        SELECT * FROM segmented_rows
        UNION ALL
        SELECT * FROM fallback_rows
        UNION ALL
        SELECT * FROM minimal_rows
      )
      SELECT
        f.district,
        f.statut,
        f.property_type,
        f.segment_scope,
        f.nb_annonces,
        f.surface_moyenne,
        f.prix_moyen,
        f.prix_m2_moyen,
        f.prix_m2_min,
        f.prix_m2_max,
        f.last_month_samples,
        f.prev_month_samples,
        f.variation_pct
      FROM final_rows f
      ORDER BY f.prix_m2_moyen DESC
      LIMIT $${pageParam} OFFSET $${offsetParam}
      `,
      paginationValues
    );

    const filteredRows = benchmarkMode === 'typed'
      ? rows.filter((r) => String(r.segment_scope) === 'typed')
      : benchmarkMode === 'fallback'
        ? rows.filter((r) => String(r.segment_scope) === 'fallback')
        : rows;

    const data = filteredRows.map((r) => ({
      district: r.district,
      status: r.statut,
      propertyType: r.property_type,
      scope: r.segment_scope,
      listingsCount: Number(r.nb_annonces || 0),
      averageSurface: Number(r.surface_moyenne || 0),
      averagePrice: Number(r.prix_moyen || 0),
      average: Number(r.prix_m2_moyen || 0),
      min: Number(r.prix_m2_min || 0),
      max: Number(r.prix_m2_max || 0),
      trendSampleSize: Math.min(Number(r.last_month_samples || 0), Number(r.prev_month_samples || 0)),
      trend: `${Number(r.variation_pct || 0) >= 0 ? '+' : ''}${Number(r.variation_pct || 0).toFixed(1)}%`
    }));

    return { data, meta };
  };

};
