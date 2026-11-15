// App identity & feature flags. Keep branding configurable here.
export const APP = {
  id: 'stora',
  name: 'STORA',
  version: '3.0.6',
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

/**
 * ENG-MD-HUB control center. Owns STORA companies + join codes and receives the usage heartbeat.
 * The publishable key is public by design (it can only call the public RPCs).
 * `appKey` (ck_...) comes from the control center's STORA page; empty = heartbeat off.
 */
export const CONTROL = {
  url: 'https://lfdngkibdnkwhqeasmuw.supabase.co',
  publishableKey: 'sb_publishable_B738d43Eg2U1A9jkqymAwQ_QF11RD9s',
  sdkUrl: 'https://eng-md-hub.github.io/control/sdk/control.js',
  dashboard: 'https://eng-md-hub.github.io/control/#/app/stora',
  appKey: 'ck_stora_urhq3ojhf92ErpLwZbp866FAOG5xkAFL',
} as const;
