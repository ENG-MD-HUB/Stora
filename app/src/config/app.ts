// App identity & feature flags. Keep branding configurable here.
export const APP = {
  id: 'stora',
  name: 'STORA',
  version: '3.0.0-beta.3',
  build: '2026-11',
  developer: 'Mohammad M. Alamoudi',
  superAdminEmail: 'md.aisystems@gmail.com',
} as const;

/**
 * Feature flags — extension point for future Free / Pro editions.
 * A feature that is `false` is hidden from the UI; nothing here is a payment system.
 */
export const FEATURES = {
  barcodeScanner: true,
  excelExport: true,
  companiesAdmin: true,
  offline: true,
  telemetry: false, // optional monitoring platform; off until an endpoint exists
} as const;

export type FeatureKey = keyof typeof FEATURES;
export const hasFeature = (k: FeatureKey) => FEATURES[k];

/** Optional central monitoring endpoint (empty = disabled). Never required for the app to work. */
export const TELEMETRY_ENDPOINT = '';
