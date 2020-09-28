import * as owl from "@odoo/owl";
import { setTemplates } from "./helpers";

// import here every test suite files
import "./components/action_tests";
import "./components/navbar_tests";
import "./services_tests";
import "./services/router_tests";
import "./components/webclient_tests";

const { whenReady, loadFile } = owl.utils;

QUnit.config.autostart = false;

(async () => {
  const templatesUrl = `/wowl/templates/${new Date().getTime()}`;
  const templates = await loadFile(templatesUrl);
  setTemplates(templates);
  await whenReady();
  QUnit.start();
})();
