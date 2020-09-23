import { WebClient } from "./components/WebClient";
import * as owl from "@odoo/owl";

const { whenReady, loadFile } = owl.utils;

(async () => {
  // Setup code
  function setup() {
    const root = new WebClient();
    root.mount(document.body);
  }

  const templates = await loadFile("/wowl/templates/abc");
  const qweb = new owl.QWeb();
  qweb.addTemplates(templates);
  owl.Component.env = { qweb };

  return whenReady(setup);
})();
