import { Component, useComponent, useState, useSubEnv, xml } from "@odoo/owl";
import { useBus } from "@web/core/utils/hooks";

export function useDomState(getState) {
    const state = useState(getState());
    const component = useComponent();
    useBus(component.env.editorBus, "STEP_ADDED", () => {
        Object.assign(state, getState());
    });
    return state;
}

export class WithSubEnv extends Component {
    static template = xml`<t t-slot="default" />`;
    static props = {
        env: Object,
    };

    setup() {
        useSubEnv(this.props.env);
    }
}
