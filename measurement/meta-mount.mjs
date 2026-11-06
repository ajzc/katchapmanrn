import { META_FRAME_PATH } from "./config.mjs";

/** Sandboxed frame. No allow-same-origin, so the pixel cannot read the parent page. */
export function createMetaFrame(window, document, handlers) {
  const iframe = document.createElement("iframe");
  iframe.title = "Measurement";
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("tabindex", "-1");
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.referrerPolicy = "no-referrer";
  iframe.src = META_FRAME_PATH;
  iframe.style.cssText = "position:absolute;width:1px;height:1px;border:0;opacity:0;pointer-events:none";
  function onMessage(event) {
    if (!iframe.contentWindow || event.source !== iframe.contentWindow) return;
    if (event.origin !== "null") return;
    if (handlers && handlers.onFrameMessage) handlers.onFrameMessage(event.data);
  }
  window.addEventListener("message", onMessage);
  document.body.appendChild(iframe);
  return {
    post(data) {
      if (!iframe.contentWindow) return;
      iframe.contentWindow.postMessage(Object.assign({ source: "kcrn-measure" }, data), "*");
    },
    destroy() {
      window.removeEventListener("message", onMessage);
      if (iframe.remove) iframe.remove();
    },
  };
}
