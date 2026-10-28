export const APP = {
  name: 'INSPIRE CARD PARLOR',
  developer: 'OFFICIAL INSPIRE',
  website: 'https://www.inspireclothing.art',
  websiteLabel: 'www.inspireclothing.art',
  version: __APP_VERSION__,
  buildDate: __BUILD_DATE__,
} as const;

/**
 * Build-time edition switches. Adult-only content is compiled out of the public
 * default build: set VITE_ENABLE_MATURE_CONTENT=true only for an edition whose
 * platform permits age-restricted content.
 */
export const FEATURES = {
  matureContent: import.meta.env?.VITE_ENABLE_MATURE_CONTENT === 'true',
} as const;

/** Minimum age for adult-only artwork. */
export const MATURE_MIN_AGE = 18;
