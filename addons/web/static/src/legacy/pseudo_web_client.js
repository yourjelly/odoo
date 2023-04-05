/** @odoo-module **/

import { webClient } from "./web_client";

export function makeLegacyWebClientService(legacyEnv) {
    const legacyPseudoWebClient = {
        dependencies: ["title", "router"],
        start(env) {
            function setTitlePart(part, title = null) {
                env.services.title.setParts({ [part]: title });
            }
            legacyEnv.bus.on("set_title_part", null, (params) => {
                const { part, title } = params;
                setTitlePart(part, title || null);
            });
            Object.assign(webClient, {
                do_push_state(state) {
                    if ("title" in state) {
                        setTitlePart("action", state.title);
                        delete state.title;
                    }
                    env.services.router.pushState(state);
                },
                set_title(title) {
                    setTitlePart("action", title);
                },
            });
        },
    };
    return legacyPseudoWebClient;
}
