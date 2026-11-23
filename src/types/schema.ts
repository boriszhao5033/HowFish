/**
 * Canonical frontend data contracts for HowFish.
 *
 * These types mirror `pipeline/models.py` and the JSON produced under
 * `public/data/` (species, taxonomy, traps, regions, id_redirects, meta).
 * Keep this file in lock-step with the pipeline schema.
 */

export type CategoryCode = 'FI' | 'CR' | 'CE' | 'BI' | 'GA' | 'OT';

export const CATEGORY_CODES = ['FI', 'CR', 'CE', 'BI', 'GA', 'OT'] as const;

export type Availability =
  | 'common'
  | 'occasional'
  | 'rare_import'
  | 'none'
  | 'unknown';

export type Salinity = 'saltwater' | 'freshwater' | 'brackish' | 'diadromous';

export type SashimiLevel =
  | 'recommended'
  | 'conditional'
  | 'traditional_not_recommended'
  | 'not_recommended'
  | 'forbidden';

export const COOKING_TAGS = [
  // 1. 生食与冷制
  '刺身/生食',
  '火炙/炙烤',
  '腌渍生食',
  // 2. 清鲜本味
  '清蒸',
  '白灼/水煮',
  '炖汤/煲粥',
  '火锅/打边炉',
  // 3. 香煎与油烤
  '干煎/香煎',
  '盐烤/炭烤',
  '照烧/酱烤',
  '重口烤鱼',
  '油炸/酥炸',
  // 4. 焖烧与快炒
  '红烧/酱焖',
  '酱油水/豆酱焖',
  '爆炒/小炒',
  '咖喱/南洋风味',
  '酸菜/水煮辣味',
  // 5. 制品与加工
  '烟熏',
  '风干/一夜干/咸鱼',
  '鱼丸/鱼馅/滑类',
  '罐头/油浸/熟食',
  '高汤/调味基底',
] as const;

export type CookingTag = (typeof COOKING_TAGS)[number];

export type CookingTier = 'signature' | 'suitable';

export const TEXTURE_TAGS = [
  '蒜瓣紧实',
  '细嫩滑口',
  '脆弹爽口',
  '丝状耐嚼',
  '绵软偏粉',
  '丰腴肥糯',
  '胶质黏口',
] as const;

export type TextureTag = (typeof TEXTURE_TAGS)[number];

export const ODOR_PROFILES = [
  '清甜无腥',
  '海鲜鲜香',
  '青皮鱼香腥',
  '偶带土腥',
  '易生氨味须极鲜',
  '浓重特殊风味',
] as const;

export type OdorProfile = (typeof ODOR_PROFILES)[number];

export const MARKET_FORMS = [
  '活鲜',
  '冰鲜整鱼/整只',
  '鱼柳/去骨排',
  '鱼块/鱼翼/切段',
  '冷冻/熟冻',
  '干货/腌制品',
] as const;

export type MarketForm = (typeof MARKET_FORMS)[number];

export type PriceTier = '$' | '$$' | '$$$' | '$$$$';

export const FLESH_COLOR_TAGS = [
  '雪白/纯白',
  '粉白/浅粉',
  '青皮红肉',
  '橘红/橙红',
  '深红/赤身',
  '半透明/玉白',
  '黄白/灰白',
] as const;

export type FleshColorTag = (typeof FLESH_COLOR_TAGS)[number];

export type HistamineRisk =
  | 'low'
  | 'medium'
  | 'medium_high'
  | 'high'
  | 'very_high';

export type PinBoneLevel = 'none' | 'few' | 'moderate' | 'many';

export type AcidityLevel = 'none' | 'mild' | 'moderate' | 'high';

export type SafetySeverity = 'critical' | 'high' | 'medium' | 'low';

export type TaxonomyLevel =
  | 'superorder'
  | 'order'
  | 'family'
  | 'subfamily'
  | 'genus';

export type Hemisphere = 'north' | 'south';

/* -------------------------------------------------------------------------- */
/* Category specific attribute models                                         */
/* -------------------------------------------------------------------------- */

export interface FishCategoryAttrs {
  flesh_color_tag?: FleshColorTag | null;
  flesh_color_raw?: string | null;
  histamine_risk?: HistamineRisk | null;
  pin_bone_level?: PinBoneLevel | null;
  fat_level?: number | null;
  acidity_level?: AcidityLevel | null;
  fat_acidity_raw?: string | null;
  [key: string]: unknown;
}

export interface CrustaceanCategoryAttrs {
  roe_season?: string | null;
  shell_hardness?: string | null;
  oxidation_risk?: string | null;
  [key: string]: unknown;
}

export interface CephalopodCategoryAttrs {
  blanch_seconds?: number | null;
  water_shrinkage?: string | null;
  ink_sac_edible?: boolean | null;
  [key: string]: unknown;
}

export interface BivalveCategoryAttrs {
  shell_type?: string | null;
  sand_purge_difficulty?: string | null;
  biotoxin_risk?: string | null;
  [key: string]: unknown;
}

export interface GastropodCategoryAttrs {
  viscera_edible?: boolean | null;
  slime_cleaning?: string | null;
  [key: string]: unknown;
}

export interface OtherCategoryAttrs {
  [key: string]: unknown;
}

export type CategoryAttrs =
  | FishCategoryAttrs
  | CrustaceanCategoryAttrs
  | CephalopodCategoryAttrs
  | BivalveCategoryAttrs
  | GastropodCategoryAttrs
  | OtherCategoryAttrs;

/* -------------------------------------------------------------------------- */
/* Species record                                                             */
/* -------------------------------------------------------------------------- */

export interface TaxonCodes {
  superorder: string;
  order: string;
  family: string;
  subfamily: string;
  genus: string;
}

export interface Names {
  zh_formal: string;
  latin: string;
  en_standard: string;
  aliases: Record<string, string[]>;
}

export interface Habitat {
  salinity: Salinity;
  detail: string;
  distribution: string;
}

export interface Sashimi {
  level: SashimiLevel | null;
  note: string;
  /** Region/jurisdiction specific sashimi standards and legal caveats. */
  regional_policies?: Record<string, string>;
}

export interface SeasonGroup {
  months: number[];
  fresh_year_round?: boolean;
  preserved_year_round?: boolean;
  note: string;
}

/** Alias for a single ``seasonality.by_group`` entry. */
export type SeasonGroupEntry = SeasonGroup;

export interface Seasonality {
  year_round: boolean;
  by_group: Record<string, SeasonGroup>;
}

export interface SafetyItem {
  type: string;
  severity: SafetySeverity | null;
  title: string;
  detail: string;
}

export interface CulinaryMethod {
  tag: CookingTag;
  tier: CookingTier;
}

export interface Culinary {
  methods: CulinaryMethod[];
  signature_dishes: string[];
  cooking_guide: string;
}

export interface Sensory {
  texture_tags: TextureTag[];
  odor_profile: OdorProfile | null;
  summary: string;
}

export interface BuyingGuide {
  market_forms: MarketForm[];
  price_tier: Record<string, PriceTier>;
  identification_tips: string;
}

export interface Media {
  cover: string | null;
  fillet: string | null;
  diagram: string | null;
  credit: string | null;
}

export interface SourceRef {
  title: string | null;
  url: string | null;
}

export interface Provenance {
  /** Audit-only fields are omitted from the slim `public/data` bundle. */
  row_hash?: string;
  confidence: 'high' | 'medium' | 'low';
  sources?: SourceRef[];
  ai_enriched_fields?: string[];
  updated_at: string | null;
}

export interface SearchHints {
  pinyin_full: string[];
  pinyin_initials: string[];
  /** Raw Chinese terms are pipeline-only; the front end uses pinyin arrays. */
  terms?: string[];
}

export interface SpeciesRecord {
  schema_version: number;
  id: string;
  legacy_id: string | null;
  category: CategoryCode;
  taxon_codes: TaxonCodes | null;
  taxonomy_path?: string;
  names: Names;
  availability: Record<string, Availability>;
  habitat: Habitat;
  sashimi: Sashimi;
  seasonality: Seasonality;
  safety_and_legal: SafetyItem[];
  culinary: Culinary;
  sensory: Sensory;
  buying_guide: BuyingGuide;
  prep_tips: string[];
  special_notes: string;
  media: Media;
  category_attrs: CategoryAttrs;
  extra_attrs: Record<string, unknown>;
  provenance: Provenance;
  _search?: SearchHints;
}

/* -------------------------------------------------------------------------- */
/* Taxonomy                                                                   */
/* -------------------------------------------------------------------------- */

export interface TaxonomyNode {
  code: string;
  parent_code: string | null;
  level: TaxonomyLevel;
  name_zh: string;
  name_latin: string | null;
  anatomy_notes: string | null;
  ecology_notes: string | null;
  species_names?: string[];
  [key: string]: unknown;
}

export interface TaxonomyPayload {
  schema_version: number;
  nodes: TaxonomyNode[];
}

/* -------------------------------------------------------------------------- */
/* Traps                                                                      */
/* -------------------------------------------------------------------------- */

export interface AbPairTrap {
  module: string;
  pair_index: number | null;
  legacy_ids: string[];
  species_ids: string[];
  species_id_a: string | null;
  species_id_b: string | null;
  name_zh: string;
  family: string;
  difference: string;
  usage_tips: string;
  source_row: number | null;
  [key: string]: unknown;
}

export interface CrossFamilyTrap {
  module: string;
  trap_index: number | null;
  legacy_ids: string[];
  species_ids: string[];
  title: string;
  families: string[];
  families_raw: string;
  truth: string;
  tips: string;
  aliases_trigger: string[];
  source_row: number | null;
  [key: string]: unknown;
}

export interface TrapsPayload {
  ab_pairs: AbPairTrap[];
  cross_family_traps: CrossFamilyTrap[];
}

/* -------------------------------------------------------------------------- */
/* Regions / redirects / meta                                                 */
/* -------------------------------------------------------------------------- */

export interface RegionConfig {
  label: string;
  hemisphere: Hemisphere;
  season_group: string;
  price_group: string;
  enabled: boolean;
}

export interface SeasonGroupConfig {
  label: string;
  hemisphere: Hemisphere;
}

export interface RegionsPayload {
  regions: Record<string, RegionConfig>;
  season_groups: Record<string, SeasonGroupConfig>;
}

export type IdRedirects = Record<string, string>;

export interface MetaPayload {
  schema_version: number;
  build_timestamp: string;
  total_species: number;
  counts_by_category: Record<CategoryCode, number>;
  taxonomy_count: number;
  traps_count: number;
  redirects_count: number;
  enabled_regions: string[];
  warnings: string[];
}

export interface LoadedAppData {
  species: SpeciesRecord[];
  speciesById: Record<string, SpeciesRecord>;
  taxonomyNodes: TaxonomyNode[];
  taxonomyByCode: Record<string, TaxonomyNode>;
  traps: TrapsPayload;
  regions: RegionsPayload;
  redirects: IdRedirects;
  meta: MetaPayload;
  categoriesPresent: CategoryCode[];
}

/* -------------------------------------------------------------------------- */
/* Canonical display metadata                                                 */
/* -------------------------------------------------------------------------- */

export interface CookingTagGroup {
  id: string;
  label: string;
  tags: readonly CookingTag[];
}

export const COOKING_TAG_GROUPS = [
  {
    id: 'raw',
    label: '生食与冷制',
    tags: ['刺身/生食', '火炙/炙烤', '腌渍生食'],
  },
  {
    id: 'clean',
    label: '清鲜本味',
    tags: ['清蒸', '白灼/水煮', '炖汤/煲粥', '火锅/打边炉'],
  },
  {
    id: 'grill',
    label: '香煎与油烤',
    tags: ['干煎/香煎', '盐烤/炭烤', '照烧/酱烤', '重口烤鱼', '油炸/酥炸'],
  },
  {
    id: 'braise',
    label: '焖烧与快炒',
    tags: [
      '红烧/酱焖',
      '酱油水/豆酱焖',
      '爆炒/小炒',
      '咖喱/南洋风味',
      '酸菜/水煮辣味',
    ],
  },
  {
    id: 'processed',
    label: '制品与加工',
    tags: [
      '烟熏',
      '风干/一夜干/咸鱼',
      '鱼丸/鱼馅/滑类',
      '罐头/油浸/熟食',
      '高汤/调味基底',
    ],
  },
] as const satisfies readonly CookingTagGroup[];

export const CATEGORY_LABELS: Record<CategoryCode, string> = {
  FI: '鱼类',
  CR: '甲壳类',
  CE: '头足类',
  BI: '双壳贝类',
  GA: '腹足螺类',
  OT: '其他海产',
};

export const SALINITY_LABELS: Record<Salinity, string> = {
  saltwater: '咸水',
  freshwater: '淡水',
  brackish: '咸淡水',
  diadromous: '洄游',
};

export const SASHIMI_LABELS: Record<SashimiLevel, string> = {
  recommended: '推荐生食',
  conditional: '有条件生食',
  traditional_not_recommended: '有生食传统，不推荐生食',
  not_recommended: '不建议生食',
  forbidden: '严禁生食',
};

/** Compact labels for cards and dense badges. */
export const SASHIMI_SHORT_LABELS: Record<SashimiLevel, string> = {
  recommended: '推荐生食',
  conditional: '有条件生食',
  traditional_not_recommended: '有传统·不推荐',
  not_recommended: '不建议生食',
  forbidden: '严禁生食',
};

/** Canonical semantic ordering: best to worst. */
export const SASHIMI_ORDER = [
  'recommended',
  'conditional',
  'traditional_not_recommended',
  'not_recommended',
  'forbidden',
] as const satisfies readonly SashimiLevel[];

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  common: '常见',
  occasional: '偶见',
  rare_import: '极少进口',
  none: '无自然分布',
  unknown: '未知',
};

export const AVAILABILITY_SHORT_LABELS: Record<Availability, string> = {
  common: '常见',
  occasional: '偶见',
  rare_import: '进口',
  none: '无',
  unknown: '未知',
};

export const PIN_BONE_LABELS: Record<PinBoneLevel, string> = {
  none: '无肌间刺',
  few: '少刺',
  moderate: '中等刺',
  many: '多刺',
};

export const PIN_BONE_BADGE_LABELS: Record<PinBoneLevel, string> = {
  none: '无刺',
  few: '少刺',
  moderate: '刺中等',
  many: '刺多',
};

export const HISTAMINE_LABELS: Record<HistamineRisk, string> = {
  low: '低',
  medium: '中',
  medium_high: '中高',
  high: '高',
  very_high: '极高',
};

export const ACIDITY_LABELS: Record<AcidityLevel, string> = {
  none: '无酸味',
  mild: '微酸',
  moderate: '中酸',
  high: '高酸',
};

export interface FleshColorMeta {
  value: FleshColorTag;
  label: string;
  pastel: string;
  pastelDark: string;
}

export const FLESH_COLOR_LIST: readonly FleshColorMeta[] = [
  {
    value: '雪白/纯白',
    label: '雪白/纯白',
    pastel: '#E7F2F8',
    pastelDark: '#122B3A',
  },
  {
    value: '粉白/浅粉',
    label: '粉白/浅粉',
    pastel: '#FBEFF1',
    pastelDark: '#33232A',
  },
  {
    value: '青皮红肉',
    label: '青皮红肉',
    pastel: '#E3EAEF',
    pastelDark: '#1B2A36',
  },
  {
    value: '橘红/橙红',
    label: '橘红/橙红',
    pastel: '#FBEADF',
    pastelDark: '#3A271B',
  },
  {
    value: '深红/赤身',
    label: '深红/赤身',
    pastel: '#F6E4E4',
    pastelDark: '#351F24',
  },
  {
    value: '半透明/玉白',
    label: '半透明/玉白',
    pastel: '#EAF7F3',
    pastelDark: '#143029',
  },
  {
    value: '黄白/灰白',
    label: '黄白/灰白',
    pastel: '#F2F0E6',
    pastelDark: '#2C2A22',
  },
];

export const FLESH_COLOR_MAP: Record<FleshColorTag, FleshColorMeta> =
  Object.fromEntries(FLESH_COLOR_LIST.map((item) => [item.value, item])) as Record<
    FleshColorTag,
    FleshColorMeta
  >;

/** Alias keys used inside `names.aliases` and the market they represent. */
export const ALIAS_REGION_LABELS: Record<string, string> = {
  au: '澳洲',
  cn: '中国',
  cn_north: '中国北方',
  cn_east: '江浙沪',
  cn_south: '闽粤港台',
  eu: '欧洲',
  nz: '新西兰',
};

const REGION_FLAGS: Record<string, string> = {
  global: '🌐',
  au: '🇦🇺',
  cn: '🇨🇳',
  cn_north: '🇨🇳',
  cn_east: '🇨🇳',
  cn_south: '🇨🇳',
  hk: '🇭🇰',
  eu: '🇪🇺',
  nz: '🇳🇿',
  jp: '🇯🇵',
  kr: '🇰🇷',
  uk: '🇬🇧',
  us: '🇺🇸',
};

export function getRegionFlag(regionKey: string): string {
  if (regionKey === 'global') {
    return '🌐';
  }
  if (REGION_FLAGS[regionKey]) {
    return REGION_FLAGS[regionKey];
  }
  if (regionKey.startsWith('cn_')) {
    return '🇨🇳';
  }
  if (regionKey.startsWith('au')) {
    return '🇦🇺';
  }
  return '📍';
}

export function getAliasRegionLabel(aliasKey: string): string {
  return ALIAS_REGION_LABELS[aliasKey] ?? aliasKey;
}

/** Human labels for `sashimi.regional_policies` jurisdiction keys. */
export const REGIONAL_POLICY_LABELS: Record<string, string> = {
  cn_south: '华南/两广',
  hk: '香港',
  cn: '中国大陆',
  au: '澳洲',
};

export function getRegionalPolicyLabel(regionKey: string): string {
  return (
    REGIONAL_POLICY_LABELS[regionKey] ??
    ALIAS_REGION_LABELS[regionKey] ??
    regionKey
  );
}

export type GlobalFilterCategory = CategoryCode | 'ALL';