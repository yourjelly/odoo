/** @odoo-module */

import env from 'point_of_sale.env';
import { useBus } from '@web/core/utils/hooks';

/**
 * Used for transmitting broadcasted pos messages.
 */
const posBroadcastBus = new owl.EventBus();

/**
 * Mixin to allow component to start listening to
 * broadcasted pos messages upon mounting.
 * @param {owl.Component} Component
 */
export const PosBroadcastMixin = (Component) =>
    class extends Component {
        constructor() {
            super(...arguments);
            owl.onMounted(() => {
                if (odoo.pos_broadcast_enabled) {
                    this._startListeningForPosMessages();
                }
            });
        }
        /**
         * Start listening to pos near real-time messages.
         */
        _startListeningForPosMessages() {
            env.services.bus_service.onNotification(null, async (notifications) => {
                let posNotifications = notifications.filter(
                    (n) => n.type == 'pos_notification' && n.payload.pos_session_id == odoo.pos_session_id
                );
                if (posNotifications.length > 0) {
                    for (let posMessage of posNotifications.map((n) => n.payload.message)) {
                        let [name, value] = posMessage;
                        posBroadcastBus.trigger(name, value);
                    }
                }
            });
            env.services.bus_service.updateOption('has_open_pos_session', true);
            env.services.bus_service.updateOption('pos_session_id', odoo.pos_session_id);
            env.services.bus_service.startPolling();
        }
    };

/**
 * Use this hook to listen to broadcasted pos messages.
 *
 * Example
 * -------
 *
 * ```js
 * // Someplace where the message is sent.
 * let { broadcastPosMessage } = require('@point_of_sale/js/pos_broadcast');
 * class Anywhere {
 *   _addProduct(product) {
 *     // ...
 *     broadcastPosMessage('product-added', [product.name, product.id]);
 *     // ...
 *   }
 * }
 *
 * // In a component to catch the broadcasted message.
 * let { onPosBroadcast } = require('@point_of_sale/js/pos_broadcast');
 * class AnyPosComponent extends PosComponent {
 *   constructor() {
 *     super(...arguments);
 *     onPosBroadcast('product-added', this._onProductAdded)
 *   }
 *   _onProductAdded(messageValue) {
 *       let [productName, productId] = messageValue;
 *       // Do something with productName and productId.
 *     }
 *   }
 * }
 * ```
 * @param {string} messageName
 * @param {(messageValue) => void | Promise<void>} callback
 */
export function onPosBroadcast(messageName, callback) {
    useBus(posBroadcastBus, messageName, callback);
}

/**
 * Broadcast a message to every open pos ui from the same pos.session.
 * Use the `onPosBroadcast` to catch the broadcasted message.
 *
 * @param {str} messageName
 * @param {any} messageValue
 */
export function broadcastPosMessage(messageName, messageValue) {
    return env.services.rpc({
        model: 'pos.session',
        method: 'broadcast_pos_message',
        args: [[odoo.pos_session_id], messageName, messageValue],
    });
}
