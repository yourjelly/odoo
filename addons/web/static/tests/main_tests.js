// define the 'web.web_client' module because some other modules require it
odoo.define('web.web_client', function (require) {
"use strict";

const makeTestEnvironment = require("web.test_env");
const session = require("web.session");
const WebClient = require('web.WebClient');

const { QWeb } = owl;

const webClient = new WebClient();

async function startWebClient() {
    QWeb.DIRECTIVE_NAMES.inherit = 1;
    QWeb.DIRECTIVE_NAMES['inherit-mode'] = 1;

    await session.is_bound;
    session.owlTemplates = session.owlTemplates.replace(/t-transition/g, 'transition');
    owl.Component.env = makeTestEnvironment();
}

startWebClient();

return webClient;

});
