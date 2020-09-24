import { WebClient } from "./components/WebClient/WebClient";
import * as owl from "@odoo/owl";

const { whenReady, loadFile } = owl.utils;

interface Odoo {
  session_info: any;
  templates_checksum: string;
}

declare const odoo: Odoo;

(async () => {
  // Setup code
  function setup() {
    const root = new WebClient();
    root.mount(document.body);
  }

  const templatesUrl = `/wowl/templates/${odoo.templates_checksum}`;
  const templates = await loadFile(templatesUrl);
  const qweb = new owl.QWeb();
  qweb.addTemplates(templates);
  owl.Component.env = { qweb };

  return whenReady(setup);
})();
