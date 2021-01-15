if (document.location.pathname.includes("wowlent")) {
  odoo.define('wowl.WebClientConfigure', require => {
    const { WebClientEnterprise } = require("@wowl/web_enterprise/webclient/webclient");
    const { homeMenuService } = require("@wowl/web_enterprise/webclient/home_menu/home_menu_service");
    const configure = (odooConfig) => {
      odooConfig.serviceRegistry.add(homeMenuService.name, homeMenuService);
      return WebClientEnterprise;
    };
    return { configure };
  });
}
