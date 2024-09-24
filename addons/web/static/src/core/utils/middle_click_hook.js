import { useEffect, useRef } from "@odoo/owl";
import { router, stateToUrl } from "@web/core/browser/router";

const EXCLUDED_TAGS = ["A", "IMG"];

export function useMiddleClick({ refName, clickParams, selector, contextMenuOptions = [] }) {
    const ref = useRef(refName || "middleclick");
    let _onCtrlClick;
    if (clickParams) {
        if (clickParams.onCtrlClick) {
            _onCtrlClick = clickParams.onCtrlClick;
        } else if (clickParams.record) {
            _onCtrlClick = (ev) => {
                const actionStack = [
                    ...router.current.actionStack,
                    {
                        action: clickParams.record.action,
                        model: clickParams.record.resModel,
                        resId: clickParams.record.resId,
                    },
                ];
                const href = stateToUrl({
                    actionStack,
                });
                ev?.preventDefault();
                ev?.stopPropagation();
                window.open(href);
            };
        }
    }
    const handleClick = (ev) => {
        if (
            !ev.target.classList.contains("middle_clickable") &&
            EXCLUDED_TAGS.find((tag) => ev.target.closest(`${tag}`))
        ) {
            // keep the default browser behavior if the click on the element is not explicitly handled by the hook
            return;
        }
        if ((_onCtrlClick && ev.ctrlKey && ev.button === 0) || ev.button === 1) {
            _onCtrlClick(ev);
        }
    };
    const styleControlPressed = (ev) => {
        if (ev.key === "Control") {
            document.body.classList.add("ctrl_key_pressed");
            if (clickParams.isRouterHandled) {
                router.enableOpenNewWindow();
            }
        }
    };
    const styleControlUp = (ev) => {
        if (ev.key === "Control") {
            document.body.classList.remove("ctrl_key_pressed");
            if (clickParams.isRouterHandled) {
                router.disableOpenNewWindow();
            }
        }
    };
    useEffect(
        () => {
            if (ref.el) {
                const els = selector ? ref.el.querySelectorAll(selector) : [ref.el];
                els.forEach((el) => {
                    el.classList.add("middle_clickable");
                    if (clickParams.record) {
                        el.classList.add("middle_clickable_record");
                    }
                    el.addEventListener("click", handleClick, { capture: true });
                });
                window.addEventListener("keydown", styleControlPressed);
                window.addEventListener("keyup", styleControlUp);
                return () => {
                    els.forEach((el) => {
                        el.removeEventListener("click", handleClick);
                    });
                    window.removeEventListener("keydown", styleControlPressed);
                    window.removeEventListener("keyup", styleControlUp);
                };
            }
        },
        () => [ref.el]
    );
}
