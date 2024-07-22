import {
    getEmbeddedProps,
    StateChangeManager,
    useEmbeddedState,
} from "@html_editor/others/embedded_component_utils";
import { ExcalidrawDialog } from "@html_editor/others/embedded_components/excalidraw/excalidraw_dialog/excalidraw_dialog";
import { ReadonlyExcalidrawEmbeddedComponent } from "./readonly_excalidraw";

export class ExcalidrawEmbeddedComponent extends ReadonlyExcalidrawEmbeddedComponent {
    static props = {
        ...ReadonlyExcalidrawEmbeddedComponent.props,
        host: { type: Object },
    };
    static template = "html_editor.ExcalidrawEmbedded";

    setup() {
        super.setup();
        this.embeddedState = useEmbeddedState(this.props.host);
    }

    get templateState() {
        if (this.displayState.isResizing) {
            return this.state;
        } else {
            return this.embeddedState;
        }
    }

    onMouseDown() {
        this.state.width = this.embeddedState.width;
        this.state.height = this.embeddedState.height;
        super.onMouseDown(...arguments);
    }

    onMouseUp() {
        super.onMouseUp(...arguments);
        this.embeddedState.width = this.state.width;
        this.embeddedState.height = this.state.height;
    }

    openUpdateSource() {
        this.dialog.add(ExcalidrawDialog, {
            saveLink: (url) => {
                this.displayState.hasError = false;
                this.state.source = url;
                this.embeddedState.source = url;
            },
        });
    }

    setURL(url) {
        super.setURL(...arguments);
        this.embeddedState.source = url;
    }
}

export const excalidrawEmbedding = {
    name: "draw",
    Component: ExcalidrawEmbeddedComponent,
    getProps: (host) => {
        return { host, ...getEmbeddedProps(host) };
    },
    getStateChangeManager: (config) => new StateChangeManager(config),
};
