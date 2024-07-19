/* eslint-env worker */
/* eslint-disable no-restricted-globals */

import { Dispatcher } from "./dispatcher";

(async () => {
    await new Promise(setTimeout);
    const dispatcher = new Dispatcher();
    if (self.name.includes("shared")) {
        onconnect = function (ev) {
            const currentClient = ev.ports[0];
            dispatcher.registerClient(currentClient);
        };
    } else {
        dispatcher.registerClient(self);
    }
})();
