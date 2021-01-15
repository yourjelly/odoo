odoo.define('wowl.WebClientConfigure', require => {
  const { WebClient } = require("@wowl/webclient/webclient");
  return {
    configure: (odooConfig) => {return WebClient;}
  };
});
