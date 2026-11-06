import { COPY } from "./copy.mjs";

function button(doc, label, id, className, onClick) {
  const el = doc.createElement("button");
  el.type = "button";
  el.id = id;
  el.className = className;
  el.textContent = label;
  el.addEventListener("click", onClick);
  return el;
}

export function mountBanner(doc, controller) {
  if (!doc || !doc.body || doc.getElementById("kcrn-measure")) return;
  if (!controller.isMeasuring || !controller.isMeasuring()) return;
  const host = doc.createElement("div");
  host.id = "kcrn-measure";
  const panel = doc.createElement("div");
  panel.className = "measure-banner";
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", "Measurement");
  const body = doc.createElement("p");
  body.textContent = COPY.notice;
  panel.appendChild(body);
  const actions = doc.createElement("div");
  actions.className = "measure-actions";
  const privacy = doc.createElement("a");
  privacy.href = "/privacy";
  privacy.id = "kcrn-measure-privacy";
  privacy.textContent = COPY.privacy;
  actions.appendChild(privacy);
  actions.appendChild(button(doc, COPY.keepOff, "kcrn-measure-turn-off", "measure-decline", () => {
    controller.revoke();
  }));
  panel.appendChild(actions);
  host.appendChild(panel);
  doc.body.appendChild(host);
  doc.body.classList.add("measure-banner-open");
}
