/** @odoo-module **/
import { WebClientEnterprise } from "./webclient";
import { homeMenuService } from "./home_menu/home_menu_service";
import { serviceRegistry } from "../services/service_registry";
import { WebClient } from "../webclient/webclient";
import { debugManager } from "../debug_manager/debug_manager";
import { EnterpriseDebugManager } from "./debug_manager/debug_manager";
if (document.location.pathname.includes("wowlent")) {
  WebClient.getClass = () => WebClientEnterprise;
  serviceRegistry.add(homeMenuService.name, homeMenuService);
  debugManager.Component = EnterpriseDebugManager;
}
