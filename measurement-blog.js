/* Journal boot. Not referenced by the apex pages.
   Add it to the HubSpot blog template only after removing that template's
   existing Google tag. See docs/measurement.md. */
(function () {
  if (typeof window === "undefined" || !window.KCRNMeasurement) return;
  var host = String(window.location.hostname || "").toLowerCase().replace(/^www\./, "");
  if (host !== "blog.katchapmanrn.com") return;
  window.KCRNMeasurement.start({ surface: "blog" });
})();
