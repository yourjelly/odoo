odoo.define('point_of_sale.main', function (require) {
    "use strict";

    const env = require('web.env');
    const Chrome = require('point_of_sale.Chrome');
    const Registries = require('point_of_sale.Registries');
    const PosRoot = require('point_of_sale.owlPosRoot');

    owl.config.mode = env.isDebug() ? 'dev' : 'prod';
    owl.Component.env = env;

    function setupResponsivePlugin(env) {
        const isMobile = () => window.innerWidth <= 768;
        env.isMobile = isMobile();
        const updateEnv = owl.utils.debounce(() => {
            if (env.isMobile !== isMobile()) {
                env.isMobile = !env.isMobile;
                env.qweb.forceUpdate();
            }
        }, 15);
        window.addEventListener("resize", updateEnv);
    }

    setupResponsivePlugin(owl.Component.env);

    const posRoot = new PosRoot(null);

    async function startPosApp() {
        Registries.Component.freeze();
        PosRoot.components = { Chrome: Registries.Component.get(Chrome) };
        await env.session.is_bound;
        env.qweb.addTemplates(env.session.owlTemplates);
        await owl.utils.whenReady();
        await posRoot.mount(document.body);
    }

    startPosApp();
    return posRoot;
});
