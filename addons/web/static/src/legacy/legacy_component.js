/** @odoo-module **/

const hasOwnProperty = Object.prototype.hasOwnProperty;

export class LegacyComponent extends owl.Component {
    get el() {
        const bdom = this.__owl__.bdom;
        if (!bdom) {
            return null;
        }

        if (hasOwnProperty.call(bdom, "component")) {
            return bdom.component.el;
        } else {
            return bdom.firstNode();
        }
    }
    /**
     * Add a new method to owl Components to ensure that no performed RPC is
     * resolved/rejected when the component is destroyed.
     */
    rpc() {
        return new Promise((resolve, reject) => {
            return this.env.services
                .rpc(...arguments)
                .then((result) => {
                    if (owl.status(this) !== "destroyed") {
                        resolve(result);
                    }
                })
                .catch((reason) => {
                    if (owl.status(this) !== "destroyed") {
                        reject(reason);
                    }
                });
        });
    }

    /**
     * Emit a custom event of type 'eventType' with the given 'payload' on the
     * component's el, if it exists. However, note that the event will only bubble
     * up to the parent DOM nodes. Thus, it must be called between mounted() and
     * willUnmount().
     */
    trigger(eventType, payload) {
        this.__trigger(eventType, payload);
    }
    /**
     * Private trigger method, allows to choose the component which triggered
     * the event in the first place
     */
    __trigger(eventType, payload) {
        if (this.env[odoo.widgetSymbol]) {
            this.env[odoo.widgetSymbol](eventType);
        }
        if (this.el) {
            const ev = new CustomEvent(eventType, {
                bubbles: true,
                cancelable: true,
                detail: payload,
            });
            this.el.dispatchEvent(ev);
        }
    }
}
