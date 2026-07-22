const ACCENT_MAP = 'àâäáãåéèêëíìîïóòôöõúùûüçñ';
const ACCENT_REPL = 'aaaaaaeeeeiiiiooooouuuucn';

const normalizeExpr = (expr) =>
  `regexp_replace(translate(lower(coalesce(${expr},'')),'${ACCENT_MAP}','${ACCENT_REPL}'),'[^a-z0-9]+',' ','g')`;

const normalizeCol = (col) => normalizeExpr(col);

const cityFallback = (col, villeCol, defaultCity = "NULL") =>
  `NULLIF(COALESCE(NULLIF(${col},''), ${defaultCity}), '')`;

const districtCase = (col, villeCol) =>
  `CASE` +
  ` WHEN LOWER(COALESCE(${col},'')) LIKE '%riyad%' OR LOWER(COALESCE(${col},'')) LIKE '%hay riad%' THEN 'Hay Riad'` +
  ` WHEN LOWER(COALESCE(${col},'')) LIKE '%hassan%' THEN 'Hassan'` +
  ` WHEN LOWER(COALESCE(${col},'')) LIKE '%souissi%' THEN 'Souissi'` +
  ` WHEN LOWER(COALESCE(${col},'')) LIKE '%agdal%' THEN 'Agdal'` +
  ` ELSE ${cityFallback(col, villeCol)} END`;

const propertyTypeCase = (col) =>
  `CASE` +
  ` WHEN LOWER(COALESCE(${col},'')) LIKE '%appart%' THEN 'Appartement'` +
  ` WHEN LOWER(COALESCE(${col},'')) LIKE '%villa%' THEN 'Villa'` +
  ` WHEN LOWER(COALESCE(${col},'')) LIKE '%maison%' THEN 'Maison'` +
  ` WHEN LOWER(COALESCE(${col},'')) LIKE '%terrain%' THEN 'Terrain'` +
  ` WHEN LOWER(COALESCE(${col},'')) LIKE '%bureau%' THEN 'Bureau'` +
  ` WHEN LOWER(COALESCE(${col},'')) LIKE '%local%' OR LOWER(COALESCE(${col},'')) LIKE '%commerce%' THEN 'Local commercial'` +
  ` WHEN LOWER(COALESCE(${col},'')) LIKE '%riad%' THEN 'Riad'` +
  ` ELSE 'Autre' END`;

const PRICE_RANGE_VENTE_MIN = 100000;
const PRICE_RANGE_VENTE_MAX = 30000000;
const PRICE_M2_VENTE_MIN = 3000;
const PRICE_M2_VENTE_MAX = 80000;
const PRICE_RANGE_LOCATION_MIN = 500;
const PRICE_RANGE_LOCATION_MAX = 200000;
const PRICE_M2_LOCATION_MIN = 20;
const PRICE_M2_LOCATION_MAX = 3000;

const priceRangeFilter = (statusCol, priceCol, surfaceCol) =>
  `((${statusCol} = 'vente' AND ${priceCol} BETWEEN ${PRICE_RANGE_VENTE_MIN} AND ${PRICE_RANGE_VENTE_MAX} AND (${priceCol} / NULLIF(${surfaceCol}, 0)) BETWEEN ${PRICE_M2_VENTE_MIN} AND ${PRICE_M2_VENTE_MAX})` +
  ` OR (${statusCol} = 'location' AND ${priceCol} BETWEEN ${PRICE_RANGE_LOCATION_MIN} AND ${PRICE_RANGE_LOCATION_MAX} AND (${priceCol} / NULLIF(${surfaceCol}, 0)) BETWEEN ${PRICE_M2_LOCATION_MIN} AND ${PRICE_M2_LOCATION_MAX}))`;

const priceRangeSimple = (statusCol, priceCol) =>
  `((${statusCol} = 'vente' AND ${priceCol} BETWEEN ${PRICE_RANGE_VENTE_MIN} AND ${PRICE_RANGE_VENTE_MAX})` +
  ` OR (${statusCol} = 'location' AND ${priceCol} BETWEEN ${PRICE_RANGE_LOCATION_MIN} AND ${PRICE_RANGE_LOCATION_MAX}))`;

const phoneSubquery = (alias) => `COALESCE(
  (SELECT NULLIF(c4.telephone_principal, '') FROM contacts c4 WHERE c4.annonce_id = ${alias}.id ORDER BY c4.id DESC LIMIT 1),
  (SELECT NULLIF(c5.telephone, '') FROM contacts c5 WHERE c5.annonce_id = ${alias}.id ORDER BY c5.id DESC LIMIT 1),
  '212600000000'
)`;

const priceM2Expr = (priceCol, surfaceCol) => `(${priceCol} / NULLIF(${surfaceCol}, 0))`;

module.exports = {
  normalizeCol, normalizeExpr,
  cityFallback,
  districtCase,
  propertyTypeCase,
  priceRangeFilter,
  priceRangeSimple,
  phoneSubquery,
  priceM2Expr,
  PRICE_RANGE_VENTE_MIN,
  PRICE_RANGE_VENTE_MAX,
  PRICE_M2_VENTE_MIN,
  PRICE_M2_VENTE_MAX,
  PRICE_RANGE_LOCATION_MIN,
  PRICE_RANGE_LOCATION_MAX,
  PRICE_M2_LOCATION_MIN,
  PRICE_M2_LOCATION_MAX
};
