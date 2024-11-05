import { registry } from "@web/core/registry";

registry.category("website-builder-actions").add("setClass", {
    isActive: ({ editingElement, params }) => {
        return editingElement.classList.contains(params);
    },
    apply: ({ editingElement, params }) => {
        editingElement.classList.add(params);
    },
    clean: ({ editingElement, params }) => {
        editingElement.classList.remove(params);
    },
});

const styleMap = {
    borderWidth: {
        getValue: (editingElement) => {
            return parseInt(
                getComputedStyle(editingElement).getPropertyValue("border-width")
            ).toString();
        },
        apply: (editingElement, value) => {
            const parsedValue = parseInt(value);
            const hasBorderClass = editingElement.classList.contains("border");
            if (!parsedValue || parsedValue < 0) {
                if (hasBorderClass) {
                    editingElement.classList.remove("border");
                }
            } else {
                if (!hasBorderClass) {
                    editingElement.classList.add("border");
                }
            }
            editingElement.style.setProperty("border-width", `${parsedValue}px`, "important");
        },
    },
};

registry.category("website-builder-actions").add("setStyle", {
    getValue: ({ editingElement, params }) => {
        const styleName = params.name;
        return styleMap[styleName]?.getValue(editingElement);
    },
    apply: ({ editingElement, params }) => {
        const styleName = params.name;
        styleMap[styleName]?.apply(editingElement, params.value);
    },
});
