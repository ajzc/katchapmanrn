/** Confirmed IDs only. Do not invent a Meta dataset. */

export const GA4_MEASUREMENT_ID = "G-0BX0PK6GZP";
export const HS_PORTAL_ID = "22023986";
export const HS_FORMS = {
  join: "2b288535-f430-41df-aea1-2c15d800d311",
  contact: "520f79d5-f010-4465-8a88-56b22f41ab0d",
};
export const MEETINGS_ORIGIN = "https://meetings.hubspot.com";
export const MEETINGS_PATH = "/ajchapman20/book-a-visit-kat-chapman-rn";

/**
 * Confirmed Meta Pixel / dataset ID.
 * Leave this empty until the parent pastes the ID from Events Manager.
 * 15 or 16 digits only. Never paste HubSpot portal 22023986 or GA4 G-0BX0PK6GZP.
 */
export const META_PIXEL_ID = "";

export const LINKER_DOMAINS = ["katchapmanrn.com", "blog.katchapmanrn.com"];
export const ADS_PAGE_TITLE = "Kat Chapman RN";
export const ADS_HOST = "katchapmanrn.com";
export const CONSENT_STORAGE_KEY = "kcrn_measure_consent";
export const UTM_STORAGE_KEY = "kcrn_utm_v1";
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
export const META_SCRIPT_URL = "https://connect.facebook.net/en_US/fbevents.js";
export const META_FRAME_PATH = "/measurement/meta-frame.html?v=1";
export const REJECTED_IDS = new Set(["22023986"]);
