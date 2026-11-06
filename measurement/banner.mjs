import { COPY, bannerModel } from "./copy.mjs";

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
  const host = doc.createElement("div");
  host.id = "kcrn-measure";
  doc.body.appendChild(host);

  function render() {
    while (host.firstChild) host.removeChild(host.firstChild);
    const view = bannerModel(controller.getConsent(), controller.isBannerOpen());
    doc.body.classList.toggle("measure-banner-open", view.mode !== "reopen");
    if (view.mode === "reopen") {
      host.appendChild(button(doc, COPY.privacySettings, "kcrn-measure-reopen", "measure-reopen", () => {
        controller.openBanner();
        render();
      }));
      return;
    }
    const panel = doc.createElement("div");
    panel.className = "measure-banner";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-labelledby", "kcrn-measure-title");
    const title = doc.createElement("p");
    title.id = "kcrn-measure-title";
    title.className = "measure-title";
    title.textContent = COPY.heading;
    panel.appendChild(title);
    const body = doc.createElement("p");
    body.textContent = COPY.body;
    panel.appendChild(body);
    const actions = doc.createElement("div");
    actions.className = "measure-actions";
    if (view.primary === "allow") {
      actions.appendChild(button(doc, COPY.allow, "kcrn-measure-allow", "measure-allow", () => {
        controller.grant();
        render();
      }));
    }
    if (view.secondary === "keepOff") {
      const turnOff = controller.getConsent() === "granted";
      actions.appendChild(button(doc, COPY.keepOff, turnOff ? "kcrn-measure-turn-off" : "kcrn-measure-decline", "measure-decline", () => {
        if (turnOff) controller.revoke();
        else controller.deny();
        render();
      }));
    }
    panel.appendChild(actions);
    host.appendChild(panel);
  }

  render();
  return render;
}
