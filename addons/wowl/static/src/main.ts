import { WebClient } from "./components/WebClient/WebClient";
import { makeEnv } from "./env";
import * as owl from "@odoo/owl";

const { whenReady, loadFile } = owl.utils;

interface SessionInfo {
  qweb: string;
}

interface Odoo {
  session_info: SessionInfo;
}

declare const odoo: Odoo;

(async () => {
  // Setup code
  function setup() {
    const root = new WebClient();
    root.mount(document.body);
  }

  const templatesUrl = `/wowl/templates/${odoo.session_info.qweb}`;
  const templates = await loadFile(templatesUrl);
  owl.Component.env = makeEnv(templates);

  return whenReady(setup);
})();
