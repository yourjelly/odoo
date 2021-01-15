if (document.location.pathname.includes("wowlent")) {
  odoo.define('wowl.WebClientConfigure', require => {
    const { WebClientEnterprise } = require("@wowl/web_enterprise/webclient/webclient");
    const { homeMenuService } = require("@wowl/web_enterprise/webclient/home_menu/home_menu_service");
    const { enterpriseService } = require('@wowl/web_enterprise/webclient/home_menu/enterprise_service');
    const { serviceRegistry } = require('@wowl/services/service_registry');
    const configure = (odooConfig) => {
      odooConfig.serviceRegistry.add(homeMenuService.name, homeMenuService);
      serviceRegistry.add(enterpriseService.name, enterpriseService);
      return WebClientEnterprise;
    };
    return { configure };
  });
}
