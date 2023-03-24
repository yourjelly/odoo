/* @odoo-module */

import { Thread } from "@mail/core_ui/thread";
import { ImStatus } from "@mail/discuss/im_status";
import { patch } from "@web/core/utils/patch";

patch(Thread.components, "mail", { ImStatus });
