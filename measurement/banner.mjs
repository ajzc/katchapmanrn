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
      host.appendChild(button(doc, COPY.reopen, "kcrn-measure-reopen", "measure-reopen", () => {
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
    if (view.mode === "granted" || view.mode === "denied") {
      const status = doc.createElement("p");
      status.textContent = view.mode === "granted" ? COPY.statusOn : COPY.statusOff;
      panel.appendChild(status);
    } else {
      const body = doc.createElement("p");
      body.textContent = COPY.body;
      panel.appendChild(body);
    }
    const privacy = doc.createElement("a");
    privacy.href = "/privacy";
    privacy.textContent = COPY.privacy;
    panel.appendChild(privacy);
    const actions = doc.createElement("div");
    actions.className = "measure-actions";
    if (view.primary === "allow") {
      actions.appendChild(button(doc, COPY.allow, "kcrn-measure-allow", "measure-allow", () => {
        controller.grant();
        render();
      }));
    }
    if (view.secondary === "decline") {
      actions.appendChild(button(doc, COPY.decline, "kcrn-measure-decline", "measure-decline", () => {
        controller.deny();
        render();
      }));
    } else if (view.secondary === "turnOff") {
      actions.appendChild(button(doc, COPY.turnOff, "kcrn-measure-turn-off", "measure-decline", () => {
        controller.revoke();
        render();
      }));
    } else if (view.secondary === "close") {
      actions.appendChild(button(doc, COPY.close, "kcrn-measure-close", "measure-decline", () => {
        controller.closeBanner();
        render();
      }));
    }
    panel.appendChild(actions);
    host.appendChild(panel);
  }

  render();
  return render;
}
