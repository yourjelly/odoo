/** @odoo-module **/
import { WebClient } from '../webclient/webclient';
import { WebClientEnterprise } from './webclient/webclient';
import { homeMenuService } from './webclient/home_menu/home_menu_service';
import { EnterpriseDebugManager } from './debug_manager/debug_manager';
import { serviceRegistry } from '../services/service_registry';
import { debugManager } from '../debug_manager/debug_manager';

if (document.location.pathname.includes("wowlent")) {
  WebClient.getClass = () => WebClientEnterprise;
  serviceRegistry.add(homeMenuService.name, homeMenuService);
  debugManager.Component = EnterpriseDebugManager;
}
