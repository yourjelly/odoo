import { Component, useExternalListener, useState } from "@odoo/owl";
import { toolbarButtonProps } from "@html_editor/main/toolbar/toolbar";
import { registry } from "@web/core/registry";
import { ImageTransformation } from "./image_transformation";

export class ImageTransformButton extends Component {
    static template = "html_editor.ImageTransformButton";
    static props = {
        icon: String,
        getSelectedImage: Function,
        resetImageTransformation: Function,
        addStep: Function,
        document: { validate: (p) => p.nodeType === Node.DOCUMENT_NODE },
        editable: { validate: (p) => p.nodeType === Node.ELEMENT_NODE },
        ...toolbarButtonProps,
    };

    setup() {
        this.state = useState({ active: false });
        useExternalListener(
            this.props.document,
            "mousedown",
            (ev) => {
                if (this.isNodeOutsideTransform(ev.target)) {
                    this.closeImageTransformation();
                }
            },
            { capture: true }
        );
        useExternalListener(
            this.props.document,
            "selectionchange",
            (ev) => {
                this.closeImageTransformation();
            },
            { capture: true }
        );
    }

    isNodeOutsideTransform(node) {
        if (!node) {
            return true;
        }
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentElement;
        }
        if (node.matches('[name="image_transform"], [name="image_transform"] *')) {
            return false;
        }
        if (
            this.isImageTransformationOpen() &&
            node.matches(
                ".transfo-container, .transfo-container div, .transfo-container i, .transfo-container span"
            )
        ) {
            return false;
        }
        return true;
    }

    onButtonClick() {
        this.handleImageTransformation(this.props.getSelectedImage());
    }

    handleImageTransformation(image) {
        if (this.isImageTransformationOpen()) {
            this.props.resetImageTransformation(image);
            this.closeImageTransformation();
        } else {
            this.openImageTransformation(image);
        }
    }

    openImageTransformation(image) {
        this.state.active = true;
        registry.category("main_components").add("ImageTransformation", {
            Component: ImageTransformation,
            props: {
                image,
                document: this.props.document,
                editable: this.props.editable,
                destroy: () => this.closeImageTransformation(),
                onChange: () => this.props.addStep(),
            },
        });
    }

    isImageTransformationOpen() {
        return registry.category("main_components").contains("ImageTransformation");
    }

    closeImageTransformation() {
        this.state.active = false;
        if (this.isImageTransformationOpen()) {
            registry.category("main_components").remove("ImageTransformation");
        }
    }
}
