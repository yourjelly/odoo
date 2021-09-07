/** @odoo-module **/

import { useDebugCategory } from "@web/core/debug/debug_context";
import { useSetupAction } from "@web/webclient/actions/action_hook";
import { registry } from "@web/core/registry";
import { useListener, useService } from "@web/core/utils/hooks";
import { KeepLast } from "@web/core/utils/concurrency";
import { evaluateExpr } from "@web/core/py_js/py";

const { useComponent } = owl.hooks;

export function useSetupView(params) {
    const component = useComponent();
    useDebugCategory("view", { component });
    useSetupAction(params);
}

export function useViewArch(arch, params = {}) {
    const CATEGORY = "__processed_archs__";

    arch = arch.trim();
    const processedRegistry = registry.category(CATEGORY);

    let processedArch;
    if (!processedRegistry.contains(arch)) {
        processedArch = {};
        processedRegistry.add(arch, processedArch);
    } else {
        processedArch = processedRegistry.get(arch);
    }

    const { compile, extract } = params;
    if (!("template" in processedArch) && compile) {
        processedArch.template = owl.tags.xml`${compile(arch)}`;
    }
    if (!("extracted" in processedArch) && extract) {
        processedArch.extracted = extract(arch);
    }

    return processedArch;
}

export function useActionLinks({ keepLast, resModel }) {
    const selector = `a[type="action"]`;
    const component = owl.hooks.useComponent();
    const orm = useService("orm");
    const { doAction } = useService("action");
    keepLast = keepLast || new KeepLast();

    async function handler(ev) {
        ev.preventDefault();
        const target = ev.target;
        const data = target.dataset;

        if (data.method !== undefined && data.model !== undefined) {
            const options = {};
            if (data.reloadOnClose) {
                options.onClose = () => component.render();
            }
            const action = await keepLast.add(orm.call(data.model, data.method));
            if (action !== undefined) {
                keepLast.add(doAction(action, options));
            }
        } else if (target.getAttribute("name")) {
            const options = {};
            if (data.context) {
                options.additionalContext = evaluateExpr(data.context);
            }
            keepLast.add(doAction(target.getAttribute("name"), options));
        } else {
            let views;
            const resId = data.resid ? parseInt(data.resid, 10) : null;
            if (data.views) {
                views = evaluateExpr(data.views);
            } else {
                views = resId
                    ? [[false, "form"]]
                    : [
                          [false, "list"],
                          [false, "form"],
                      ];
            }

            const action = {
                name: target.getAttribute("title") || target.textContent.trim(),
                type: "ir.actions.act_window",
                res_model: data.model || resModel,
                target: "current", // TODO: make customisable?
                views,
                domain: data.domain ? evaluateExpr(data.domain) : [],
            };
            if (resId) {
                action.res_id = resId;
            }

            const options = {};
            if (data.context) {
                options.additionalContext = evaluateExpr(data.context);
            }
            keepLast.add(doAction(action, options));
        }
    }

    useListener("click", selector, handler);
}
