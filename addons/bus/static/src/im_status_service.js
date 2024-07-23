/** @odoo-module **/

import { registry } from "@web/core/registry";

export const UPDATE_BUS_PRESENCE_DELAY = 60000;
/**
 * @deprecated Presences are broadcasted to every user when they change.
 *
 * This service updates periodically the user presence in order for the
 * im_status to be up to date.
 *
 * In order to receive bus notifications related to im_status, one must
 * register model/ids to monitor to this service.
 */
export const imStatusService = {
    dependencies: ["bus_service", "multi_tab", "presence"],

    start(env, { bus_service, multi_tab, presence }) {
        return {
            /**
             * Register model/ids whose im_status should be monitored.
             * Notification related to the im_status are then sent
             * through the bus. Overwrite registration if already
             * present.
             *
             * @param {string} model model related to the given ids.
             * @param {Number[]} ids ids whose im_status should be
             * monitored.
             */
            registerToImStatus(model, ids) {},
            /**
             * Unregister model from im_status notifications.
             *
             * @param {string} model model to unregister.
             */
            unregisterFromImStatus(model) {},
        };
    },
};

registry.category("services").add("im_status", imStatusService);
