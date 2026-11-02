/**
 * Which campaign a save's story progress belongs to. Kept in a module of its
 * own so the save defaults and migration can use it without loading the
 * campaign data.
 */
export const CAMPAIGN_ID = 'thirteenth-hand';
/** Bump when the meaning of existing level ids changes; saves record the version they were made with. */
export const CAMPAIGN_VERSION = 2;
