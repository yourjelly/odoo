import "./Action/Action_tests";
import "./NavBar/NavBar_tests";
import "./WebClient/WebClient_tests";
import * as owl from "@odoo/owl";
import { setTemplates } from "./helpers";

const { whenReady, loadFile } = owl.utils;

QUnit.config.autostart = false;

(async () => {
  const templatesUrl = `/wowl/templates/${new Date().getTime()}`;
  const templates = await loadFile(templatesUrl);
  setTemplates(templates);
  await whenReady();
  QUnit.start();
})();
