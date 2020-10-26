import * as owl from "@odoo/owl";
import { WebClient } from "./components/webclient/webclient";
import { fetchLocalization } from "./core/localization";
import { makeEnv } from "./env";
import * as registries from "./registries";
import { Odoo, RuntimeOdoo, OdooBrowser } from "./types";

// remove some day
import "./demo_data";
// import { BatchStrategy, RPCBatchManager } from "./utils/rpc/rpc_batcher";
// import { useService } from "./core/hooks";

const { whenReady, loadFile } = owl.utils;

declare const odoo: Odoo;

(async () => {
  // prepare browser object
  const c = new owl.Component();
  const baseEnv = c.env;
  const browser: OdooBrowser = Object.assign({}, baseEnv.browser, {
    console: window.console,
    location: window.location,
    open: window.open.bind(window),
    XMLHttpRequest: window.XMLHttpRequest,
  });

  // load templates and localization
  let [templates, { localization, _t }] = await Promise.all([
    loadTemplates(),
    fetchLocalization(browser, odoo),
  ]);

  // setup environment
  const env = await makeEnv({
    browser,
    localization,
    odoo,
    views: registries.viewRegistry,
    Components: registries.mainComponentRegistry,
    services: registries.serviceRegistry,
    actions: registries.actionRegistry,
    systray: registries.systrayRegistry,
    errorDialogs: registries.errorDialogRegistry,
    templates,
    _t,
  });
  owl.Component.env = env;

  // start web client
  const root = new WebClient();
  await whenReady();
  await root.mount(document.body, { position: "self" });

  // prepare runtime Odoo object
  const sessionInfo = odoo.session_info;
  delete (odoo as any).session_info;
  ((odoo as any) as RuntimeOdoo).__DEBUG__ = { root };
  ((odoo as any) as RuntimeOdoo).info = {
    db: sessionInfo.db,
    server_version: sessionInfo.server_version,
    server_version_info: sessionInfo.server_version_info,
  };

  /*
  const params1 = {"model":"hr.employee","method":"search_read","args":[],"kwargs":{"context":{"lang":"en_US","tz":"Europe/Brussels","uid":2,"allowed_company_ids":[1]},"domain":[],"fields":["display_name"],"limit":80}}
  const params2 = {"model":"hr.employee","method":"search_read","args":[],"kwargs":{"context":{"lang":"en_US","tz":"Europe/Brussels","uid":2,"allowed_company_ids":[1]},"domain":[],"fields":["marital"],"limit":80}}
  const params3 = {"model":"hr.employee","method":"search_read","args":[],"kwargs":{"context":{"lang":"en_US","tz":"Europe/Brussels","uid":2,"allowed_company_ids":[1]},"domain":[],"fields":["user_id"],"limit":80}}


  // /web/dataset/call_kw/hr.employee/search_read


  const batch = new RPCBatchManager({
    strategy: BatchStrategy.Tick,
    strategyValue: 1,
  }, "/wowl/batch-models");


  const p1 = batch.rpc('/web/dataset/call_kw/hr.employee/search_read', params1);
  const p2 = batch.rpc('/web/dataset/call_kw/hr.employee/search_read', params2);
  const p3 = batch.rpc('/web/dataset/call_kw/hr.employee/search_read', params3);

  console.log(p1);
  console.log(p2);
  console.log(p3);


  console.log(await p3);
  console.log(p1);
  console.log(p2);
  console.log(p3);
   */
})();

async function loadTemplates(): Promise<string> {
  const templatesUrl = `/wowl/templates/${odoo.session_info.qweb}`;
  const templates = await loadFile(templatesUrl);

  // as we currently have two qweb engines (owl and legacy), owl templates are
  // flagged with attribute `owl="1"`. The following lines removes the 'owl'
  // attribute from the templates, so that it doesn't appear in the DOM. For now,
  // we make the assumption that 'templates' only contains owl templates. We
  // might need at some point to handle the case where we have both owl and
  // legacy templates. At the end, we'll get rid of all this.
  const doc = new DOMParser().parseFromString(templates, "text/xml");
  for (let child of doc.querySelectorAll("templates > [owl]")) {
    child.removeAttribute("owl");
  }
  return new XMLSerializer().serializeToString(doc);
}
