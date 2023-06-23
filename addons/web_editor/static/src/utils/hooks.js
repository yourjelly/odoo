/** @odoo-module **/
import { onWillDestroy, reactive, useChildSubEnv, useComponent, useEffect, useEnv, useState } from "@odoo/owl";


export function useParentedVisibility(id) {
    const visibleState = useState({
        visible: true,
        visibleChildren: {},
    });
    useChildSubEnv({
        updateParentVisibility: (id, active) => {
            visibleState.visibleChildren[id] = active;
        },
    });
    const env = useEnv();
    useEffect(
        () => {
            const childValues = Object.values(visibleState.visibleChildren);
            if (childValues.length > 0) {
                visibleState.visible = childValues.includes(true);
            }
        },
        () => [...Object.values(visibleState.visibleChildren)]
    );
    useEffect(
        () => {
            env.updateParentVisibility?.(id, visibleState.visible);
        },
        () => [visibleState.visible]
    );

    return visibleState;
}

const componentsByTarget = new Map();
const targetsByComponents = new Map();
export function useTarget(target) {
    const component = useComponent();
    const env = useEnv();
    const remove = async () => {
    };
    const visible = () => {
        return (target.dataset.invisible !== '1');
    };
    /**
     * Changes the target's visibility state and calls every related component
     * to notify them of the change.
     * @param {boolean} [show]
     */
    const toggleVisibilityStatus = (show) => {
        return env.snippetEditionRequest(async () => {
            if (show === undefined) {
                show = !visible();
            }
            if (show) {
                delete target.dataset.invisible;
            } else {
                target.dataset.invisible = '1';
            }
            for (const component of componentsByTarget.get(target)) {
                if (show) {
                    await component.onTargetShow?.();
                } else {
                    await component.onTargetHide?.();
                }
            }
            return show;
        });
    };
    /**
     * Called when the target is done moving
     */
    const onMove = () => {
        for (const component of componentsByTarget.get(target)) {
            component.onMove?.();
        }
    };
    const onBuilt = async () => {
        for (const component of componentsByTarget.get(target)) {
            component.onBuilt?.(target);
        }
    };
    const use = (callback) => {
        return callback(target);
    };
    const asyncUse = (callback) => {
        return env.snippetEditionRequest(() => callback(target));
    };
    if (!componentsByTarget.has(target)) {
        componentsByTarget.set(target, []);
    }
    componentsByTarget.get(target).push(component);
    targetsByComponents.set(component, target);

    onWillDestroy(() => {
        const components = componentsByTarget.get(target).filter(c => c !== component);
        if (!components.length) {
            componentsByTarget.delete(target);
        }
        componentsByTarget.set(target, components);
        targetsByComponents.delete(component);
    });

    return {
        get visible() {
            return visible();
        },
        toggleVisibilityStatus,
        remove,
        onMove,
        onBuilt,
        use,
        asyncUse,
        el: target
    };
}

export function callForEachChildSnippet(snippet, callback) {
    const proms = [];
    for (const [target, components] of componentsByTarget.entries()) {
        if (snippet.contains(target)) {
            proms.push(...components.map(callback));
        }
    }
    return proms;
}
