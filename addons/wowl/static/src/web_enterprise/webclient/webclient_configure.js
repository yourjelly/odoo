/** @odoo-module alias=wowl.WebClientConfigure **/
// keep this alias, it is needed to override the configuration for booting the webclient
import { WebClientEnterprise } from "./webclient";
import { homeMenuService } from './home_menu/home_menu_service';
import { enterpriseService } from './home_menu/enterprise_service';
import { supportItem } from './burger_menu/user_menu/user_menu_items.';

// LPE FIXME: this is only because the module is aliased
export default function configure(odooConfig) {
  odooConfig.serviceRegistry.add(homeMenuService.name, homeMenuService);
  odooConfig.serviceRegistry.add(enterpriseService.name, enterpriseService);
  odooConfig.userMenuRegistry.add('support', supportItem, true);
  return WebClientEnterprise;
}
