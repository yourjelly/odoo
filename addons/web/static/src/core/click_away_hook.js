/** @odoo-module **/

const { useComponent, useExternalListener, useRef } = owl.hooks;

/**
 * @param {() => void} action
 * @param {Object} [params]
 * @param {string} [params.container]
 * @param {(el: HTMLElement) => boolean} [params.ignoreWhen]
 */
export function useClickAway(action, params = {}) {
    const component = useComponent();
    const ignoreWhen = params.ignoreWhen ? params.ignoreWhen.bind(component) : () => false;

    let container = component;
    if (params.container) {
        container = useRef(params.container);
    }

    function onWindowClick(ev) {
        if (!container.el.contains(ev.target) && !ignoreWhen(ev.target)) {
            action.call(component);
        }
    }

    useExternalListener(window, "click", onWindowClick, { capture: true });
}
