import { redactForAds } from "./redact.mjs";

const KINDS = new Set(["call", "text", "book"]);

export function classifyClick(href, hasBookAttr) {
  const h = String(href || "").trim().toLowerCase();
  if (h.startsWith("tel:")) return "call";
  if (h.startsWith("sms:")) return "text";
  if (hasBookAttr || h.includes("meetings.hubspot.com")) return "book";
  return null;
}

export function pageViewEvent(page) {
  return {
    name: "page_view",
    once: "page_view",
    conversion: false,
    ga: true,
    meta: true,
    params: redactForAds(page),
  };
}

export function clickEvent(kind) {
  if (!KINDS.has(kind)) return null;
  return {
    name: "outbound_click",
    once: null,
    conversion: false,
    ga: true,
    meta: true,
    params: { link_kind: kind },
    hubspotPath: "/track/" + kind,
  };
}

export function formEvent(formId, ok, reason) {
  const id = formId === "join" || formId === "contact" ? formId : "form";
  if (ok) {
    return {
      name: "generate_lead",
      once: "lead:" + id,
      conversion: true,
      ga: true,
      meta: true,
      params: { form_id: id, lead_source: "hubspot_form" },
    };
  }
  return {
    name: "form_submit_failed",
    once: null,
    conversion: false,
    ga: true,
    meta: false,
    params: { form_id: id, reason: reason === "network" ? "network" : "rejected" },
  };
}

export function bookingEvent() {
  return {
    name: "booking_completed",
    once: "booking_completed",
    conversion: true,
    ga: true,
    meta: true,
    params: { method: "hubspot_meetings_embed" },
  };
}
