const { parsePagination, computePaginationMeta } = require('./helpers.js');
const sql = require('./sql-fragments');

const normalizeStatusFilter = (raw) => {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'vente' || v === 'location') return v;
  return 'all';
};

module.exports = function makeMarket({ pool, DB_TABLES }) {

  const getPriceTrendsByQuarter = async (searchParams) => {
    const status = normalizeStatusFilter(searchParams?.get('status'));
    const months = Math.min(36, Math.max(3, Number(searchParams?.get('months')) || 12));
    const { page, pageSize } = parsePagination(searchParams);

    const values = [months];
    let statusSql = '';
    if (status !== 'all') {
      values.push(status);
      statusSql = `AND a.statut = $2`;
    }

    const countSql = `
      WITH monthly AS (
        SELECT DISTINCT
          district,
          ville,
          statut
        FROM (
          SELECT
            ${sql.districtCase('l.quartier', 'l.ville')} AS district,
            CASE
              WHEN LOWER(COALESCE(NULLIF(TRIM(l.ville),''), 'Rabat')) IN ('salé','sale') THEN 'Salé'
              WHEN LOWER(COALESCE(NULLIF(TRIM(l.ville),''), 'Rabat')) IN ('témara','temara') THEN 'Témara'
              ELSE 'Rabat'
            END AS ville,
            a.statut
        FROM ${DB_TABLES.historiquePrix} h
        JOIN ${DB_TABLES.annonces} a ON a.id = h.annonce_id
        JOIN ${DB_TABLES.localisations} l ON l.annonce_id = a.id
        WHERE a.prix IS NOT NULL
          AND a.surface IS NOT NULL
          AND a.surface > 0
          AND a.est_active = true
          AND l.quartier IS NOT NULL
          AND l.quartier != 'N/A'
          AND DATE_TRUNC('month', h.date_releve) >= DATE_TRUNC('month', NOW()) - ($1::int || ' months')::interval
          ${statusSql}
        GROUP BY district, ville, a.statut
        HAVING COUNT(DISTINCT a.id) >= 3
      ) t
    )
    SELECT COUNT(*)::int AS total FROM monthly
  `;
    const countRes = await pool.query(countSql, values);
    const total = Number(countRes.rows[0]?.total || 0);
    const { totalPages, safePage, offset } = computePaginationMeta(total, page, pageSize);

    const { rows } = await pool.query(
      `
      WITH monthly AS (
        SELECT
          DATE_TRUNC('month', h.date_releve) AS mois,
          ${sql.districtCase('l.quartier', 'l.ville')} AS district,
          CASE
            WHEN LOWER(COALESCE(NULLIF(TRIM(l.ville),''), 'Rabat')) IN ('salé','sale') THEN 'Salé'
            WHEN LOWER(COALESCE(NULLIF(TRIM(l.ville),''), 'Rabat')) IN ('témara','temara') THEN 'Témara'
            ELSE 'Rabat'
          END AS ville,
          a.statut,
          AVG(h.prix / NULLIF(a.surface, 0)) AS prix_m2_moyen,
          COUNT(DISTINCT a.id)::int AS nb_annonces
        FROM ${DB_TABLES.historiquePrix} h
        JOIN ${DB_TABLES.annonces} a ON a.id = h.annonce_id
        JOIN ${DB_TABLES.localisations} l ON l.annonce_id = a.id
        WHERE a.prix IS NOT NULL
          AND a.surface IS NOT NULL
          AND a.surface > 0
          AND a.est_active = true
          AND l.quartier IS NOT NULL
          AND l.quartier != 'N/A'
          ${statusSql}
        GROUP BY DATE_TRUNC('month', h.date_releve), district, ville, a.statut
        HAVING COUNT(DISTINCT a.id) >= 3
      ),
      scoped AS (
        SELECT *
        FROM monthly
        WHERE mois >= DATE_TRUNC('month', NOW()) - ($1::int || ' months')::interval
      ),
      ranked AS (
        SELECT
          district,
          ville,
          statut,
          mois,
          prix_m2_moyen,
          nb_annonces,
          ROW_NUMBER() OVER (PARTITION BY district, statut ORDER BY mois DESC) AS rn
        FROM scoped
      ),
      aggregated AS (
        SELECT
          district,
          ville,
          statut AS status,
          MAX(CASE WHEN rn = 1 THEN mois END) AS latest_month,
          ROUND(MAX(CASE WHEN rn = 1 THEN prix_m2_moyen END)::numeric, 0) AS latest_price_m2,
          ROUND(MAX(CASE WHEN rn = 2 THEN prix_m2_moyen END)::numeric, 0) AS previous_price_m2,
          MAX(CASE WHEN rn = 1 THEN nb_annonces END)::int AS latest_samples,
          MAX(CASE WHEN rn = 2 THEN nb_annonces END)::int AS previous_samples,
          ROUND(
            (
              (MAX(CASE WHEN rn = 1 THEN prix_m2_moyen END) - MAX(CASE WHEN rn = 2 THEN prix_m2_moyen END))
              / NULLIF(MAX(CASE WHEN rn = 2 THEN prix_m2_moyen END), 0)
            )::numeric * 100,
            1
          ) AS variation_pct
        FROM ranked
        WHERE rn <= 2
        GROUP BY district, ville, statut
        HAVING MAX(CASE WHEN rn = 2 THEN prix_m2_moyen END) IS NOT NULL
           AND MAX(CASE WHEN rn = 1 THEN nb_annonces END) >= 3
           AND MAX(CASE WHEN rn = 2 THEN nb_annonces END) >= 3
        ORDER BY ABS(
          (
            (MAX(CASE WHEN rn = 1 THEN prix_m2_moyen END) - MAX(CASE WHEN rn = 2 THEN prix_m2_moyen END))
            / NULLIF(MAX(CASE WHEN rn = 2 THEN prix_m2_moyen END), 0)
          ) * 100
        ) DESC NULLS LAST
      )
      SELECT * FROM aggregated
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
      `,
      [...values, pageSize, offset]
    );

    return {
      data: rows.map((r) => ({
        district: r.district,
        ville: r.ville,
        status: r.status,
        latestMonth: r.latest_month,
        latestPriceM2: Number(r.latest_price_m2 || 0),
        previousPriceM2: Number(r.previous_price_m2 || 0),
        latestSamples: Number(r.latest_samples || 0),
        previousSamples: Number(r.previous_samples || 0),
        variationPct: Number(r.variation_pct || 0)
      })),
      meta: { page: safePage, pageSize, total, totalPages }
    };
  };

  const getSuspiciousListings = async (searchParams) => {
    const status = normalizeStatusFilter(searchParams?.get('status'));
    const minSample = Math.min(300, Math.max(12, Number(searchParams?.get('minSample')) || 20));
    const iqrMultiplier = Math.min(3, Math.max(1.5, Number(searchParams?.get('iqrMultiplier')) || 2.0));
    const minDeviationPct = Math.min(90, Math.max(10, Number(searchParams?.get('minDeviationPct')) || 30));
    const { page, pageSize } = parsePagination(searchParams);

    const values = [minSample, iqrMultiplier, minDeviationPct];
    let statusSql = '';
    if (status !== 'all') {
      values.push(status);
      statusSql = `AND b.statut = $4`;
    }

    const countValues = [minSample, iqrMultiplier, minDeviationPct];
    let countStatusSql = '';
    if (status !== 'all') {
      countValues.push(status);
      countStatusSql = `AND b.statut = $4`;
    }

    const countRes = await pool.query(
      `
      WITH locations AS (
        SELECT DISTINCT ON (annonce_id) annonce_id, quartier, ville
        FROM ${DB_TABLES.localisations}
        ORDER BY annonce_id, CASE WHEN quartier IS NULL OR quartier = '' OR quartier = 'N/A' THEN 1 ELSE 0 END,
                 CASE WHEN ville IS NULL OR ville = '' OR ville = 'N/A' THEN 1 ELSE 0 END,
                 quartier ASC NULLS LAST, ville ASC NULLS LAST
      ),
      base AS (
        SELECT
          a.id, a.statut,
          LOWER(COALESCE(a.type_bien,'')) AS type_bien_raw,
          ${sql.districtCase('l.quartier', 'l.ville')} AS district,
          a.prix::numeric AS price, a.surface::numeric AS surface,
          (a.prix::numeric / NULLIF(a.surface, 0)::numeric) AS price_m2
        FROM ${DB_TABLES.annonces} a
        JOIN locations l ON l.annonce_id = a.id
        WHERE a.prix IS NOT NULL AND a.prix > 0 AND a.est_active = true
          AND a.surface IS NOT NULL AND a.surface > 0
          AND l.quartier IS NOT NULL AND l.quartier != 'N/A'
          AND ${sql.priceRangeFilter('a.statut', 'a.prix', 'a.surface')}
      ),
      typed AS (
        SELECT b.* FROM base b WHERE 1=1 ${countStatusSql}
      ),
      stats AS (
        SELECT district, statut, property_type,
          COUNT(*)::int AS sample_size,
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price_m2) AS q1,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY price_m2) AS mediane,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price_m2) AS q3
        FROM (
          SELECT district, statut, price_m2,
            ${sql.propertyTypeCase('type_bien_raw')} AS property_type
          FROM typed
        ) typed_with_category
        GROUP BY district, statut, property_type
        HAVING COUNT(*) >= CASE
          WHEN property_type = 'Autre' THEN GREATEST($1::int, 30)
          ELSE $1::int
        END
      ),
      flagged AS (
        SELECT t.id, t.price_m2, t.district, t.statut,
          ${sql.propertyTypeCase('t.type_bien_raw')} AS property_type,
          t.price, t.surface
        FROM typed t
        JOIN stats s
          ON s.district = t.district AND s.statut = t.statut
         AND s.property_type = ${sql.propertyTypeCase('t.type_bien_raw')}
        WHERE (
          t.price_m2 < (s.q1 - $2 * (s.q3 - s.q1))
          OR t.price_m2 > (s.q3 + $2 * (s.q3 - s.q1))
        )
        AND ABS(((t.price_m2 - s.mediane) / NULLIF(s.mediane, 0) * 100)) >= $3
      )
      SELECT COUNT(DISTINCT id)::int AS total FROM flagged
      `,
      countValues.slice(0, countStatusSql ? 4 : 3)
    );
    const total = Number(countRes.rows[0]?.total || 0);
    const { totalPages, safePage, offset } = computePaginationMeta(total, page, pageSize);

    const { rows } = await pool.query(
      `
      WITH locations AS (
        SELECT DISTINCT ON (annonce_id) annonce_id, quartier, ville
        FROM ${DB_TABLES.localisations}
        ORDER BY annonce_id,
          CASE WHEN quartier IS NULL OR quartier = '' OR quartier = 'N/A' THEN 1 ELSE 0 END,
          CASE WHEN ville IS NULL OR ville = '' OR ville = 'N/A' THEN 1 ELSE 0 END,
          quartier ASC NULLS LAST, ville ASC NULLS LAST
      ),
      base AS (
        SELECT
          a.id,
          COALESCE(NULLIF(a.titre,''), CONCAT('Annonce #', a.id)) AS title,
          a.statut,
          LOWER(COALESCE(a.type_bien,'')) AS type_bien_raw,
          ${sql.districtCase('l.quartier', 'l.ville')} AS district,
          a.prix::numeric AS price, a.surface::numeric AS surface,
          (a.prix::numeric / NULLIF(a.surface, 0)::numeric) AS price_m2,
          a.url, a.date_publication
        FROM ${DB_TABLES.annonces} a
        JOIN locations l ON l.annonce_id = a.id
        WHERE a.prix IS NOT NULL AND a.prix > 0 AND a.est_active = true
          AND a.surface IS NOT NULL AND a.surface > 0
          AND l.quartier IS NOT NULL AND l.quartier != 'N/A'
          AND ${sql.priceRangeFilter('a.statut', 'a.prix', 'a.surface')}
      ),
      typed AS (
        SELECT b.*,
          ${sql.propertyTypeCase('b.type_bien_raw')} AS property_type
        FROM base b
        WHERE 1=1 ${statusSql}
      ),
      stats AS (
        SELECT district, statut, property_type,
          COUNT(*)::int AS sample_size,
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price_m2) AS q1,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY price_m2) AS mediane,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price_m2) AS q3
        FROM typed
        GROUP BY district, statut, property_type
        HAVING COUNT(*) >= CASE
          WHEN property_type = 'Autre' THEN GREATEST($1::int, 30::int)
          ELSE $1::int
        END
      ),
      flagged AS (
        SELECT t.id, t.title, t.statut AS status, t.district, t.property_type,
          ROUND(t.price::numeric, 0) AS price,
          ROUND(t.surface::numeric, 0) AS surface,
          ROUND(t.price_m2::numeric, 0) AS price_m2,
          ROUND(s.mediane::numeric, 0) AS median_price_m2,
          ROUND((s.q1 - 1.5 * (s.q3 - s.q1))::numeric, 0) AS lower_fence_price_m2,
          ROUND((s.q3 + 1.5 * (s.q3 - s.q1))::numeric, 0) AS upper_fence_price_m2,
          ROUND((s.q1 - $2::numeric * (s.q3 - s.q1))::numeric, 0) AS lower_fence_tuned_price_m2,
          ROUND((s.q3 + $2::numeric * (s.q3 - s.q1))::numeric, 0) AS upper_fence_tuned_price_m2,
          ROUND(((t.price_m2 - s.mediane) / NULLIF(s.mediane, 0) * 100)::numeric, 1) AS deviation_pct,
          s.sample_size, t.url, t.date_publication
        FROM typed t
        JOIN stats s
          ON s.district = t.district AND s.statut = t.statut AND s.property_type = t.property_type
        WHERE (
          t.price_m2 < (s.q1 - $2::numeric * (s.q3 - s.q1))
          OR t.price_m2 > (s.q3 + $2::numeric * (s.q3 - s.q1))
        )
        AND ABS(((t.price_m2 - s.mediane) / NULLIF(s.mediane, 0) * 100)) >= $3::int
      ),
      deduped AS (
        SELECT f.*,
          ROW_NUMBER() OVER (PARTITION BY f.id ORDER BY ABS(f.deviation_pct) DESC NULLS LAST, f.sample_size DESC) AS row_rank
        FROM flagged f
      ),
      final_results AS (
        SELECT *,
          CASE WHEN deviation_pct < 0 THEN 'Prix anormalement bas' ELSE 'Prix anormalement haut' END AS suspicion_type,
          CASE
            WHEN ABS(deviation_pct) >= 60 THEN 'Critique'
            WHEN ABS(deviation_pct) >= 40 THEN 'Elevee'
            ELSE 'Moyenne'
          END AS severity
        FROM deduped WHERE row_rank = 1
        ORDER BY ABS(deviation_pct) DESC NULLS LAST, sample_size DESC
      )
      SELECT * FROM final_results
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
      `,
      [...values, pageSize, offset]
    );

    return {
      data: rows.map((r) => ({
        id: Number(r.id), title: r.title, status: r.status, district: r.district,
        propertyType: r.property_type, price: Number(r.price || 0), surface: Number(r.surface || 0),
        priceM2: Number(r.price_m2 || 0), medianPriceM2: Number(r.median_price_m2 || 0),
        lowerFencePriceM2: Number(r.lower_fence_price_m2 || 0),
        upperFencePriceM2: Number(r.upper_fence_price_m2 || 0),
        lowerFenceTunedPriceM2: Number(r.lower_fence_tuned_price_m2 || 0),
        upperFenceTunedPriceM2: Number(r.upper_fence_tuned_price_m2 || 0),
        deviationPct: Number(r.deviation_pct || 0), sampleSize: Number(r.sample_size || 0),
        suspicionType: r.suspicion_type, severity: r.severity, url: r.url || '', postedAt: r.date_publication || null
      })),
      meta: { page: safePage, pageSize, total, totalPages }
    };
  };

  const getMarketHeatmap = async (searchParams) => {
    const status = normalizeStatusFilter(searchParams?.get('status'));
    const { page, pageSize } = parsePagination(searchParams);

    const { rows } = await pool.query('SELECT sp_heatmap_score($1) AS result', [status]);
    const raw = rows?.[0]?.result;
    const data = (typeof raw === 'string' ? JSON.parse(raw) : raw) || [];
    const total = data.length;
    const { totalPages, safePage } = computePaginationMeta(total, page, pageSize);
    const offset = (safePage - 1) * pageSize;

    return { data: data.slice(offset, offset + pageSize), meta: { page: safePage, pageSize, total, totalPages } };
  };

  const getComparables = async (searchParams) => {
    const listingId = Number(searchParams?.get('listingId'));
    if (!Number.isFinite(listingId) || listingId <= 0) {
      const err = new Error('listingId est requis');
      err.statusCode = 400;
      throw err;
    }

    const { rows: targetRows } = await pool.query(
      `
      SELECT a.id, a.statut, LOWER(COALESCE(a.type_bien,'')) AS type_bien_raw,
        a.prix::numeric AS price, a.surface::numeric AS surface,
        (a.prix::numeric / NULLIF(a.surface, 0)::numeric) AS price_m2,
        ${sql.districtCase('l.quartier', 'l.ville')} AS district
      FROM ${DB_TABLES.annonces} a
      LEFT JOIN ${DB_TABLES.localisations} l ON l.annonce_id = a.id
      WHERE a.id = $1 AND a.prix IS NOT NULL AND a.prix > 0 AND a.est_active = true
        AND a.surface IS NOT NULL AND a.surface > 0
      LIMIT 1
      `,
      [listingId]
    );
    const target = targetRows[0];
    if (!target) {
      const err = new Error('Annonce cible introuvable pour comparables');
      err.statusCode = 404;
      throw err;
    }

    const { rows } = await pool.query(
      `
      WITH typed AS (
        SELECT a.id,
          COALESCE(NULLIF(a.titre,''), CONCAT('Annonce #', a.id)) AS title,
          a.statut, LOWER(COALESCE(a.type_bien,'')) AS type_bien_raw,
          a.prix::numeric AS price, a.surface::numeric AS surface,
          (a.prix::numeric / NULLIF(a.surface, 0)::numeric) AS price_m2,
          ${sql.districtCase('l.quartier', 'l.ville')} AS district
        FROM ${DB_TABLES.annonces} a
        JOIN ${DB_TABLES.localisations} l ON l.annonce_id = a.id
        WHERE a.id <> $1 AND a.prix IS NOT NULL AND a.prix > 0 AND a.est_active = true
          AND a.surface IS NOT NULL AND a.surface > 0 AND a.statut = $2
      )
      SELECT id, title, statut AS status, district,
        ROUND(price::numeric, 0) AS price, ROUND(surface::numeric, 0) AS surface,
        ROUND(price_m2::numeric, 0) AS price_m2,
        ROUND(ABS((surface - $3::numeric) / NULLIF($3::numeric, 0))::numeric, 4) AS surface_diff_ratio,
        ROUND(ABS((price_m2 - $4::numeric) / NULLIF($4::numeric, 0))::numeric, 4) AS price_m2_diff_ratio,
        ROUND((0.55 * ABS((surface - $3::numeric) / NULLIF($3::numeric, 0)) + 0.45 * ABS((price_m2 - $4::numeric) / NULLIF($4::numeric, 0)))::numeric, 5) AS similarity_score
      FROM typed
      WHERE district = $5
        AND (
          CASE
            WHEN $6 LIKE '%appart%' THEN type_bien_raw LIKE '%appart%'
            WHEN $6 LIKE '%villa%' THEN type_bien_raw LIKE '%villa%'
            WHEN $6 LIKE '%riad%' THEN type_bien_raw LIKE '%riad%'
            WHEN $6 LIKE '%maison%' THEN type_bien_raw LIKE '%maison%'
            ELSE TRUE
          END
        )
        AND price_m2 IS NOT NULL
        AND (
          ($2 = 'vente' AND price BETWEEN 100000 AND 30000000 AND price_m2 BETWEEN 3000 AND 80000)
          OR ($2 = 'location' AND price BETWEEN 500 AND 200000 AND price_m2 BETWEEN 20 AND 3000)
        )
      ORDER BY similarity_score ASC, id DESC
      LIMIT 20
      `,
      [listingId, target.statut, target.surface, target.price_m2, target.district, target.type_bien_raw]
    );

    return {
      target: {
        id: Number(target.id), status: target.statut, district: target.district,
        price: Number(target.price || 0), surface: Number(target.surface || 0),
        priceM2: Number(target.price_m2 || 0)
      },
      comparables: rows.map((r) => ({
        id: Number(r.id), title: r.title, status: r.status, district: r.district,
        price: Number(r.price || 0), surface: Number(r.surface || 0),
        priceM2: Number(r.price_m2 || 0),
        surfaceDiffRatio: Number(r.surface_diff_ratio || 0),
        priceM2DiffRatio: Number(r.price_m2_diff_ratio || 0),
        similarityScore: Number(r.similarity_score || 0)
      }))
    };
  };

  const getInvestorAlerts = async (searchParams) => {
    const status = normalizeStatusFilter(searchParams?.get('status'));
    const minSample = Math.min(300, Math.max(12, Number(searchParams?.get('minSample')) || 20));
    const minDiscountPct = Math.min(70, Math.max(10, Number(searchParams?.get('minDiscountPct')) || 15));
    const { page, pageSize } = parsePagination(searchParams);

    let statusSql = '';
    const countValues = [minSample, minDiscountPct];
    const mainValues = [minSample, minDiscountPct];
    let paramOffset = 2;

    if (status !== 'all') {
      countValues.push(status);
      mainValues.push(status);
      statusSql = `AND b.statut = $${++paramOffset}`;
    }

    const countRes = await pool.query(
      `
      WITH base AS (
        SELECT a.id, a.statut, LOWER(COALESCE(a.type_bien,'')) AS type_bien_raw,
            ${sql.districtCase('l.quartier', 'l.ville')} AS district,
            a.prix::numeric AS price, a.surface::numeric AS surface,
            (a.prix::numeric / NULLIF(a.surface, 0)::numeric) AS price_m2
          FROM ${DB_TABLES.annonces} a
          JOIN ${DB_TABLES.localisations} l ON l.annonce_id = a.id
          WHERE a.prix IS NOT NULL AND a.prix > 0 AND a.est_active = true
            AND a.surface IS NOT NULL AND a.surface > 0
            AND ${sql.priceRangeFilter('a.statut', 'a.prix', 'a.surface')}
      ),
      typed AS (
        SELECT b.*,
          ${sql.propertyTypeCase('b.type_bien_raw')} AS property_type
        FROM base b WHERE 1=1 ${statusSql}
      ),
      stats AS (
        SELECT district, statut, property_type,
          COUNT(*)::int AS sample_size,
          AVG(price_m2) AS avg_price_m2,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY price_m2) AS median_price_m2
        FROM typed
        GROUP BY district, statut, property_type
        HAVING COUNT(*) >= $1
      ),
      ranked AS (
        SELECT t.id FROM typed t
        JOIN stats s
          ON s.district = t.district AND s.statut = t.statut AND s.property_type = t.property_type
        WHERE ((t.price_m2 - s.avg_price_m2) / NULLIF(s.avg_price_m2, 0) * 100) <= (-1 * $2)
      )
      SELECT COUNT(*)::int AS total FROM ranked
      `,
      countValues
    );

    const total = Number(countRes.rows[0]?.total || 0);
    const { totalPages, safePage, offset } = computePaginationMeta(total, page, pageSize);

    mainValues.push(pageSize, offset);

    const { rows } = await pool.query(
      `
      WITH base AS (
        SELECT a.id,
          COALESCE(NULLIF(a.titre,''), CONCAT('Annonce #', a.id)) AS title,
          a.statut, LOWER(COALESCE(a.type_bien,'')) AS type_bien_raw,
            ${sql.districtCase('l.quartier', 'l.ville')} AS district,
            a.prix::numeric AS price, a.surface::numeric AS surface,
            (a.prix::numeric / NULLIF(a.surface, 0)::numeric) AS price_m2,
            a.url, a.date_publication
          FROM ${DB_TABLES.annonces} a
        JOIN ${DB_TABLES.localisations} l ON l.annonce_id = a.id
        WHERE a.prix IS NOT NULL AND a.prix > 0 AND a.est_active = true
          AND a.surface IS NOT NULL AND a.surface > 0
          AND ${sql.priceRangeFilter('a.statut', 'a.prix', 'a.surface')}
      ),
      typed AS (
        SELECT b.*,
          ${sql.propertyTypeCase('b.type_bien_raw')} AS property_type
        FROM base b WHERE 1=1 ${statusSql}
      ),
      stats AS (
        SELECT district, statut, property_type,
          COUNT(*)::int AS sample_size,
          AVG(price_m2) AS avg_price_m2,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY price_m2) AS median_price_m2
        FROM typed
        GROUP BY district, statut, property_type
        HAVING COUNT(*) >= $1
      ),
      ranked AS (
        SELECT t.id, t.title, t.statut AS status, t.district, t.property_type,
          ROUND(t.price::numeric, 0) AS price, ROUND(t.surface::numeric, 0) AS surface,
          ROUND(t.price_m2::numeric, 0) AS price_m2,
          ROUND(s.avg_price_m2::numeric, 0) AS segment_avg_price_m2,
          ROUND(s.median_price_m2::numeric, 0) AS segment_median_price_m2,
          s.sample_size,
          ROUND(((t.price_m2 - s.avg_price_m2) / NULLIF(s.avg_price_m2, 0) * 100)::numeric, 1) AS delta_vs_avg_pct,
          ROUND(((t.price_m2 - s.median_price_m2) / NULLIF(s.median_price_m2, 0) * 100)::numeric, 1) AS delta_vs_median_pct,
          t.url, t.date_publication
        FROM typed t
        JOIN stats s
          ON s.district = t.district AND s.statut = t.statut AND s.property_type = t.property_type
        WHERE ((t.price_m2 - s.avg_price_m2) / NULLIF(s.avg_price_m2, 0) * 100) <= (-1 * $2)
      )
      SELECT *,
        CASE
          WHEN delta_vs_avg_pct <= -30 THEN 'Opportunite forte'
          WHEN delta_vs_avg_pct <= -20 THEN 'Opportunite confirmee'
          ELSE 'Opportunite'
        END AS alert_level
      FROM ranked
      ORDER BY delta_vs_avg_pct ASC, sample_size DESC
      LIMIT $${paramOffset + 1} OFFSET $${paramOffset + 2}
      `,
      mainValues
    );

    const data = rows.map((r) => ({
      id: Number(r.id), title: r.title, status: r.status, district: r.district,
      propertyType: r.property_type, price: Number(r.price || 0), surface: Number(r.surface || 0),
      priceM2: Number(r.price_m2 || 0), segmentAvgPriceM2: Number(r.segment_avg_price_m2 || 0),
      segmentMedianPriceM2: Number(r.segment_median_price_m2 || 0),
      sampleSize: Number(r.sample_size || 0),
      deltaVsAvgPct: Number(r.delta_vs_avg_pct || 0),
      deltaVsMedianPct: Number(r.delta_vs_median_pct || 0),
      alertLevel: r.alert_level, url: r.url || '', postedAt: r.date_publication || null
    }));

    return { data, meta: { page: safePage, pageSize, total, totalPages } };
  };

  const getQuartierComparison = async (searchParams) => {
    const q1 = String(searchParams?.get('q1') || '').trim();
    const q2 = String(searchParams?.get('q2') || '').trim();
    const status = normalizeStatusFilter(searchParams?.get('status'));
    if (!q1 || !q2) {
      const err = new Error('q1 et q2 sont requis');
      err.statusCode = 400;
      throw err;
    }
    const { rows } = await pool.query(`
      SELECT * FROM mv_quartier_stats
      WHERE (district = $1 OR district = $2)
        AND ($3 = 'all' OR statut = $3)
      ORDER BY district, statut
    `, [q1, q2, status]);
    return { data: rows.map((r) => ({
      district: r.district, ville: r.ville, status: r.statut,
      listingsCount: r.listings_count, avgPriceM2: Number(r.avg_price_m2 || 0),
      medianPriceM2: Number(r.median_price_m2 || 0), p25PriceM2: Number(r.p25_price_m2 || 0),
      p75PriceM2: Number(r.p75_price_m2 || 0), avgSurface: Number(r.avg_surface || 0),
      volatilityPct: Number(r.volatility_pct || 0), computedAt: r.computed_at
    })) };
  };

  const getRentalYield = async (searchParams) => {
    const quartier = String(searchParams?.get('quartier') || '').trim();
    const { rows } = await pool.query(
      quartier
        ? `SELECT * FROM mv_rental_yield WHERE district = $1 ORDER BY gross_yield_pct DESC`
        : `SELECT * FROM mv_rental_yield ORDER BY gross_yield_pct DESC`,
      quartier ? [quartier] : []
    );
    return { data: rows.map((r) => ({
      district: r.district, ville: r.ville,
      salePriceM2: Number(r.sale_price_m2 || 0), rentPriceM2: Number(r.rent_price_m2 || 0),
      saleCount: r.sale_count, rentCount: r.rent_count,
      grossYieldPct: r.gross_yield_pct == null ? null : Number(r.gross_yield_pct),
      computedAt: r.computed_at
    })) };
  };

  const getLiquidity = async (searchParams) => {
    const quartier = String(searchParams?.get('quartier') || '').trim();
    const status = normalizeStatusFilter(searchParams?.get('status'));
    if (quartier) {
      const { rows } = await pool.query(
        'SELECT * FROM mv_liquidity_index WHERE district = $1 AND ($2 = \'all\' OR statut = $2) ORDER BY turnover_rate_pct DESC',
        [quartier, status]
      );
      return { data: rows.map((r) => ({
        district: r.district, status: r.statut,
        activeListings: r.active_listings, exited30d: r.exited_30d,
        turnoverRatePct: Number(r.turnover_rate_pct || 0),
        monthsOfInventory: r.months_of_inventory == null ? null : Number(r.months_of_inventory),
        liquidityLabel: r.liquidity_label, computedAt: r.computed_at
      })) };
    }
    const { rows } = await pool.query(
      'SELECT * FROM mv_liquidity_index WHERE ($1 = \'all\' OR statut = $1) ORDER BY turnover_rate_pct DESC',
      [status]
    );
    return { data: rows.map((r) => ({
      district: r.district, status: r.statut,
      activeListings: r.active_listings, exited30d: r.exited_30d,
      turnoverRatePct: Number(r.turnover_rate_pct || 0),
      monthsOfInventory: r.months_of_inventory == null ? null : Number(r.months_of_inventory),
      liquidityLabel: r.liquidity_label, computedAt: r.computed_at
    })) };
  };

  const getFirstTimeBuyer = async (searchParams) => {
    const ville = String(searchParams?.get('ville') || '').trim();
    const { rows } = await pool.query(
      ville ? `SELECT * FROM mv_first_time_buyer WHERE ville = $1 ORDER BY district, category`
            : `SELECT * FROM mv_first_time_buyer ORDER BY district, category`,
      ville ? [ville] : []
    );
    return { data: rows.map((r) => ({
      district: r.district, ville: r.ville, category: r.category,
      listingsCount: r.listings_count, minPrice: Number(r.min_price || 0),
      p25Price: Number(r.p25_price || 0), medianPrice: Number(r.median_price || 0),
      avgSurface: Number(r.avg_surface || 0)
    })) };
  };

  const getAgencyLeaderboard = async (searchParams) => {
    const limit = Math.min(100, Math.max(5, Number(searchParams?.get('limit')) || 20));
    const { rows } = await pool.query(`
      SELECT
        MIN(INITCAP(COALESCE(NULLIF(ct.agence_nom,''), 'Agence'))) AS agency_name,
        COUNT(DISTINCT a.id)::int AS total_listings,
        COUNT(DISTINCT a.id) FILTER (WHERE a.statut = 'vente')::int AS sales_listings,
        COUNT(DISTINCT a.id) FILTER (WHERE a.statut = 'location')::int AS rentals_listings,
        ROUND(AVG(a.prix / NULLIF(a.surface, 0))::numeric, 0) AS avg_price_m2,
        ROUND(AVG(a.prix)::numeric, 0) AS avg_price,
        COUNT(DISTINCT CASE WHEN a.prix IS NOT NULL AND a.est_active = false THEN a.id END)::int AS sold_30d,
        NOW() AS computed_at
      FROM contacts ct
      JOIN annonces a ON a.id = ct.annonce_id
      WHERE ct.agence_nom IS NOT NULL AND ct.agence_nom != ''
        AND a.prix IS NOT NULL AND a.prix > 0
      GROUP BY LOWER(ct.agence_nom)
      HAVING COUNT(DISTINCT a.id) >= 3
      ORDER BY total_listings DESC
      LIMIT $1
    `, [limit]);
    return { data: rows.map((r) => ({
      agencyName: r.agency_name, totalListings: r.total_listings,
      salesListings: r.sales_listings, rentalsListings: r.rentals_listings,
      avgPriceM2: Number(r.avg_price_m2 || 0), avgPrice: Number(r.avg_price || 0),
      sold30d: r.sold_30d, computedAt: r.computed_at
    })) };
  };

  const getNegotiationMargin = async (searchParams) => {
    const quartier = String(searchParams?.get('quartier') || '').trim();
    const status = normalizeStatusFilter(searchParams?.get('status'));
    let where = 'WHERE a.est_active = true AND a.prix IS NOT NULL AND a.prix > 0 AND a.surface IS NOT NULL AND a.surface > 0';
    const params = [];
    if (quartier) {
      where += ` AND ${sql.districtCase('l.quartier', 'l.ville')} = $1`;
      params.push(quartier);
    }
    if (status !== 'all') {
      where += ` AND a.statut = $${params.length + 1}`;
      params.push(status);
    }
    const { rows } = await pool.query(`
      WITH base AS (
        SELECT a.id, a.prix::numeric AS price, a.surface::numeric AS surface,
          ${sql.districtCase('l.quartier', 'l.ville')} AS district,
          a.statut,
          (a.prix::numeric / NULLIF(a.surface, 0)::numeric) AS price_m2
        FROM annonces a
        JOIN localisations l ON l.annonce_id = a.id
        ${where}
      ),
      segment_stats AS (
        SELECT district, statut,
          AVG(price_m2) AS avg_price_m2,
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price_m2) AS p25_price_m2,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY price_m2) AS median_price_m2
        FROM base
        GROUP BY district, statut
        HAVING COUNT(*) >= 5
      )
      SELECT b.district, b.statut,
        COUNT(*)::int AS listings_count,
        ROUND(AVG(b.price)::numeric, 0) AS avg_listing_price,
        ROUND(AVG(s.median_price_m2 * b.surface)::numeric, 0) AS avg_estimated_price,
        ROUND(AVG((b.price - s.median_price_m2 * b.surface) / NULLIF(b.price, 0) * 100)::numeric, 1) AS avg_margin_pct,
        ROUND(MIN((b.price - s.median_price_m2 * b.surface) / NULLIF(b.price, 0) * 100)::numeric, 1) AS min_margin_pct,
        ROUND(MAX((b.price - s.median_price_m2 * b.surface) / NULLIF(b.price, 0) * 100)::numeric, 1) AS max_margin_pct
      FROM base b
      JOIN segment_stats s ON s.district = b.district AND s.statut = b.statut
      GROUP BY b.district, b.statut
      ORDER BY avg_margin_pct DESC
    `, params);
    return { data: rows.map((r) => ({
      district: r.district, status: r.statut,
      listingsCount: r.listings_count,
      avgListingPrice: Number(r.avg_listing_price || 0),
      avgEstimatedPrice: Number(r.avg_estimated_price || 0),
      avgMarginPct: Number(r.avg_margin_pct || 0),
      minMarginPct: Number(r.min_margin_pct || 0),
      maxMarginPct: Number(r.max_margin_pct || 0)
    })) };
  };

  const getPredictions = async (searchParams) => {
    const quartier = String(searchParams?.get('quartier') || '').trim();
    const status = normalizeStatusFilter(searchParams?.get('status'));
    const months = Math.min(36, Math.max(3, Number(searchParams?.get('months')) || 12));
    let where = 'WHERE h.date_releve >= DATE_TRUNC(\'month\', NOW()) - ($1::int || \' months\')::interval';
    const params = [months];
    if (quartier) {
      where += ` AND ${sql.districtCase('l.quartier', 'l.ville')} = $${params.length + 1}`;
      params.push(quartier);
    }
    if (status !== 'all') {
      where += ` AND a.statut = $${params.length + 1}`;
      params.push(status);
    }
    const { rows } = await pool.query(`
      WITH monthly AS (
        SELECT
          ${sql.districtCase('l.quartier', 'l.ville')} AS district,
          a.statut,
          DATE_TRUNC('month', h.date_releve) AS mois,
          AVG(h.prix / NULLIF(a.surface, 0)) AS avg_ppm2,
          COUNT(DISTINCT a.id)::int AS nb_annonces
        FROM historique_prix h
        JOIN annonces a ON a.id = h.annonce_id
        JOIN localisations l ON l.annonce_id = a.id
        ${where}
        GROUP BY district, a.statut, mois
        HAVING COUNT(DISTINCT a.id) >= 3
      ),
      ranked AS (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY district, statut ORDER BY mois DESC) AS rn_desc,
          ROW_NUMBER() OVER (PARTITION BY district, statut ORDER BY mois ASC) AS rn_asc
        FROM monthly
      ),
      regression AS (
        SELECT district, statut,
          REGR_SLOPE(avg_ppm2, EXTRACT(epoch FROM mois)) AS slope,
          REGR_INTERCEPT(avg_ppm2, EXTRACT(epoch FROM mois)) AS intercept,
          REGR_R2(avg_ppm2, EXTRACT(epoch FROM mois)) AS r_squared,
          COUNT(*)::int AS months_count,
          MAX(CASE WHEN rn_desc = 1 THEN avg_ppm2 END) AS latest_ppm2,
          MAX(CASE WHEN rn_asc = 1 THEN avg_ppm2 END) AS first_ppm2
        FROM ranked
        GROUP BY district, statut
        HAVING COUNT(*) >= 3
      )
      SELECT district, statut,
        ROUND(latest_ppm2::numeric, 0) AS current_price_m2,
        ROUND(slope::numeric, 6) AS slope,
        ROUND(intercept::numeric, 2) AS intercept,
        ROUND(r_squared::numeric, 3) AS r_squared,
        months_count,
        ROUND((latest_ppm2 + slope * (EXTRACT(epoch FROM NOW() + INTERVAL '90 days') - EXTRACT(epoch FROM NOW())))::numeric, 0) AS predicted_90d_price_m2,
        CASE
          WHEN slope > 0 AND r_squared >= 0.5 THEN 'Hausse probable'
          WHEN slope < 0 AND r_squared >= 0.5 THEN 'Baisse probable'
          WHEN r_squared >= 0.3 THEN 'Tendance legere'
          ELSE 'Tendance incertaine'
        END AS prediction_label
      FROM regression
      ORDER BY district, statut
    `, params);
    return { data: rows.map((r) => ({
      district: r.district, status: r.statut,
      currentPriceM2: Number(r.current_price_m2 || 0),
      predicted90dPriceM2: Number(r.predicted_90d_price_m2 || 0),
      change90dPct: Number(r.current_price_m2) > 0
        ? Number((((r.predicted_90d_price_m2 - r.current_price_m2) / r.current_price_m2) * 100).toFixed(1))
        : null,
      slope: Number(r.slope || 0), rSquared: Number(r.r_squared || 0),
      monthsCount: r.months_count,
      predictionLabel: r.prediction_label
    })) };
  };

  return {
    getPriceTrendsByQuarter,
    getSuspiciousListings,
    getMarketHeatmap,
    getComparables,
    getInvestorAlerts,
    getQuartierComparison,
    getRentalYield,
    getLiquidity,
    getFirstTimeBuyer,
    getAgencyLeaderboard,
    getNegotiationMargin,
    getPredictions
  };
};
