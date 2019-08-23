odoo.define('web.web_client', function (require) {

const env = require('web.env');
const session = require("web.session");
const WebClient = require('web.WebClient');

const { Component, QWeb } = owl;

const webClient = new WebClient();

async function startWebClient() {
    QWeb.DIRECTIVE_NAMES.inherit = 1;
    QWeb.DIRECTIVE_NAMES['inherit-mode'] = 1;

    await session.is_bound;
    env.qweb.addTemplates(session.owlTemplates);
    Component.env = env;

    await owl.utils.whenReady();
    webClient.setElement($(document.body));
    webClient.start();
}

startWebClient();

return webClient;

});
