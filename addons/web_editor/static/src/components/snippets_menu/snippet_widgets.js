/** @odoo-module **/
import { pick } from "@web/core/utils/objects";
import { uniqueId } from "@web/core/utils/functions";
import { ColorPalette } from "@web_editor/js/wysiwyg/widgets/color_palette";
import weUtils from "@web_editor/js/common/utils";

import {
    Component,
    markup,
    onWillStart,
    reactive,
    useChildSubEnv,
    useEffect,
    useRef,
    useState,
    useSubEnv, xml
} from "@odoo/owl";
import { useParentedVisibility } from "@web_editor/utils/hooks";
import { useService } from "@web/core/utils/hooks";

const NULL_ID = "__NULL__";
/**
 * Cache of the SVG fetched
 * @type {Object.<string, Promise<string>>}
 */
const svgImageCache = {};

/**
 * Fetches the SVG's XML template and returns only the SVG Text
 * @param src
 * @returns {Promise<string>}
 */
async function getSvgText(src) {
    if (!(src in svgImageCache)) {
        svgImageCache[src] = (async () => {
            const response = await window.fetch(src);
            const text = await response.text();
            const parser = new window.DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            return xmlDoc.getElementsByTagName("svg")[0].outerHTML;
        })();
    }
    return await svgImageCache[src];
}

export class WeTooltip extends Component {
    static template = xml`<div class="p-1"><t t-slot="default"/></div>`;
}
export class WeRow extends Component {
    static template = "web_editor.WeRow";
    static props = {
        style: { type: String, optional: true },
        title: { type: String, optional: true },
        slots: {
            type: Object,
            shape: {
                title: { Object, optional: true },
                default: { Object },
            },
        },
        class: { type: String, optional: true },
        titleClasses: { type: String, optional: true },
    };
    setup() {
        this.visibilityState = useParentedVisibility(uniqueId("we-row"));
    }

    get cssClasses() {
        return {
            "d-none": !this.visibilityState.visible,
            [this.props.class]: true,
        };
    }

    get visible() {
        return this.visibilityState.visible;
    }
}

export class UserValueWidget extends Component {
    static props = {
        name: { type: String, optional: true },
        applyTo: { type: String, optional: true },
        defaultValue: { type: String, optional: true },
        title: { type: String, optional: true },
        noPreview: { type: Boolean, optional: true },
        dependencies: { type: Array, optional: true },
        "*": {},
        slots: {
            type: Object,
            optional: true,
            shape: {
                title: { Object, optional: true },
                default: { Object, optional: true },
            }
        }
    };
    static defaultProps = {
        noPreview: false,
    };
    setup() {
        this.state = useState({
            // Setting active as undefined to force computation of dependencies
            active: undefined,
            preview: false,
            visible: true,
            values: {},
        });
        this.id = uniqueId("we_widget");
        // Load available methods and possible values in the env
        this.data = {
            possibleValues: {},
            params: {},
            optionValues: reactive(new Map()),
            methodNames: new Set(),
            isActive: this.isActive.bind(this),
            toggleVisibility: this.toggleVisibility.bind(this),
            trigger: this.trigger.bind(this),
            triggerWidgetsNames: [],
            triggerWidgetsValues: [],
        };
        this.optionValues = useState(this.data.optionValues);
        for (const name in this.props) {
            if (name === "applyTo") {
                this.data.params.applyTo = this.props.applyTo;
            }
            if (name === "dependencies") {
                this.data.dependencies = this.props[name];
                continue;
            }
            if (name === "name") {
                this.data.name = this.props[name];
                continue;
            }
            if (name === "trigger") {
                this.data.triggerWidgetsNames.push(...this.props[name]);
                continue;
            }
            if (name === "triggerValue") {
                this.data.triggerWidgetsValues.push(...this.props[name]);
                continue;
            }

            if (!this.env.validMethodNames.includes(name)) {
                this.data.params[name] = this.props[name];
                continue;
            }

            this.data.methodNames.add(name);

            if (!this.data.possibleValues[name]) {
                this.data.possibleValues[name] = [];
            }
            this.data.possibleValues[name].push(this.props[name]);

            if (this.env.containerID) {
                const containerData = this.env.widgetsData[this.env.containerID];
                if (!containerData.possibleValues[name]) {
                    containerData.possibleValues[name] = [];
                }
                containerData.possibleValues[name].push(this.props[name]);
                containerData.methodNames.add(name);
                this.data.params = { ...containerData.params, ...this.data.params };
                this.data.containerID = this.env.containerID;
                containerData.subWidgets.push(this.data);
                containerData.triggerWidgetsNames.push(...this.data.triggerWidgetsNames);
                containerData.triggerWidgetsValues.push(...this.data.triggerWidgetsValues);
                this.data.optionValues = containerData.optionValues;
            }
        }
        this.optionValues = useState(this.data.optionValues);
        this.env.registerWidgetId(this.id);

        this.visibilityState = useParentedVisibility(this.id);

        // If any value changes, update this widget's state.
        useEffect(
            () => {
                this.state.values = this.computeValues([...this.optionValues.entries()]);
                this.state.active = this.isActive();
            },
            () => [...this.optionValues.values()]
        );
        useEffect(
            () => {
                if (this.state.preview && !this.visibilityState.visible) {
                    this.onUserValueReset();
                }
            },
            () => [this.visibilityState]
        );
    }

    /**
     * Computes and returns the CSS classes in an object that can be computed
     * by OWL with the `t-att-class` attribute.
     *
     * @returns {Object}
     */
    get cssClasses() {
        const cssClasses = {
            "d-none": !this.visibilityState.visible,
        };
        if (Array.isArray(this.props.class)) {
            this.props.class.forEach((value) => (cssClasses[value] = true));
        }
        if (typeof this.props.class === "object") {
            Object.assign(cssClasses, this.props.class);
        }
        if (typeof this.props.class === "string") {
            Object.assign(cssClasses, {
                [this.props.class]: true,
            });
        }
        return cssClasses;
    }
    /**
     * Shortcut to access the widgets data stored in the env
     * This allows parents to interact with the widgets. Check their values
     * and call some methods.
     *
     * @returns {Object} - the values shared with parents.
     */
    get data() {
        return this.env.widgetsData[this.id];
    }
    set data(values) {
        this.env.widgetsData[this.id] = values;
    }
    get defaultValue() {
        if (this.props.defaultValue) {
            return this.props.defaultValue;
        }
        const propKeys = Object.keys(this.props);
        for (const methodName of this.optionValues.keys()) {
            if (propKeys.includes(methodName)) {
                return this.data.possibleValues[name];
            }
        }
        return "";
    }
    /**
     * Allows other widget to override this method to compute their
     * state based on the option values.
     * @param values
     * @returns {*}
     */
    computeValues(values) {
        return pick(Object.fromEntries(values), ...this.env.validMethodNames);
    }
    isActive() {
        for (const value of Object.entries(this.optionValues)) {
            if (value && value !== NULL_ID) {
                return true;
            }
        }
    }
    toggleVisibility(visible) {
        if (visible === undefined) {
            return (this.visibilityState.visible = !this.visibilityState.visible);
        }
        return (this.visibilityState.visible = visible);
    }
    onUserValuePreview() {
        this.state.preview = true;
        this.data.preview = true;
    }
    onUserValueReset() {
        this.state.preview = false;
        this.data.preview = false;
    }
    onUserValueChange() {}
    notifyValueChange(values, preview, id) {
        this.activeValues = values;
        this.env.notifyValueChange(...arguments, { activeValues: this.state.values });
    }
    trigger(previewMode) {
        switch (previewMode) {
            case true: {
                return this.onUserValuePreview();
            }
            case "reset": {
                return this.onUserValueReset();
            }
            case false: {
                return this.onUserValueChange();
            }
        }
    }
}

export class WeButton extends UserValueWidget {
    static template = "web_editor.WeButton";
    static props = {
        ...UserValueWidget.props,
        img: { type: String, optional: true },
    };
    setup() {
        super.setup();
        this.popover = useService("popover");

        this.valueRef = useRef("value-ref");

        onWillStart(async () => {
            if (this.props.img && this.props.img.split(".").pop() === "svg") {
                const svgText = await getSvgText(this.props.img);
                this.svg = markup(svgText);
            } else {
                this.img = this.props.img;
            }
        });
    }

    /**
     * @override
     */
    get cssClasses() {
        const cssClasses = super.cssClasses;
        cssClasses["active"] = this.state.active;
        return cssClasses;
    }
    computeValues(values) {
        return pick(Object.fromEntries(values), ...Object.keys(this.props));
    }
    isActive() {
        for (const methodName of this.optionValues.keys()) {
            if (this.props[methodName] === this.optionValues.get(methodName)) {
                // If the button is part of a container
                if (this.env.activeValue) {
                    this.env.activeValue.set(methodName, this.valueRef);
                }
                return true;
            }
        }
        return false;
    }
    onUserValuePreview() {
        super.onUserValuePreview();
        if (this.props.noPreview) {
            return;
        }
        const preview = true;
        this.state.preview = true;
        const values = pick(this.props, ...this.env.validMethodNames);
        this.notifyValueChange(values, preview, this.id);
    }
    onUserValueReset() {
        if (this.state.preview) {
            super.onUserValueReset();
            const preview = "reset";
            const values = pick(this.state.values, ...this.env.validMethodNames);
            this.notifyValueChange(values, preview, this.id);
        }
    }
    onUserValueChange() {
        super.onUserValueChange();
        if (this.state.preview) {
            this.onUserValueReset();
        }
        const preview = false;
        this.state.preview = false;
        const values = pick(this.props, ...this.env.validMethodNames);
        this.notifyValueChange(values, preview, this.id);
    }
    onMouseEnter() {
        this.toggleTooltip(true);
        this.onUserValuePreview();
    }
    onMouseLeave() {
        this.toggleTooltip(false);
        this.onUserValueReset();
    }
    toggleTooltip(show) {
        if (show && (this.img || this.svg) && this.props.slots?.default) {
            this.removePopover = this.popover.add(this.valueRef.el, WeTooltip, {slots: {
                default: this.props.slots.default
            }});
        } else {
            this.removePopover?.();
        }
    }
}

/**
 * Abstract component for selection widget
 */
class WeBaseSelection extends UserValueWidget {
    static props = {
        ...UserValueWidget.props,
        closeOnSelect: { type: Boolean, optional: true },
    };
    static defaultProps = {
        ...UserValueWidget.defaultProps,
        closeOnSelect: true,
    };
    setup() {
        super.setup();
        this.data.subWidgets = [];
        this.data.container = true;
        useSubEnv({
            activeValue: reactive(new Map()),
            containerID: this.id,
        });
        useChildSubEnv({
            notifyValueChange: (values, preview, widgetID) => {
                if ((preview || preview === "reset") && this.props.noPreview) {
                    return;
                }
                if (!preview && this.props.closeOnSelect) {
                    this.toggleWidgets(false);
                }
                if (preview === true) {
                    this.onUserValuePreview(values);
                } else if (preview === "reset") {
                    this.onUserValueReset();
                } else {
                    this.onUserValueChange(values);
                }
            },
            registerWidgetId: (id) => {}
        });
    }
    onUserValuePreview(values) {
        super.onUserValuePreview();
        this.notifyValueChange(values, true, this.id);
    }

    onUserValueReset() {
        super.onUserValueReset();
        this.notifyValueChange(
            this.state.values,
            "reset",
            this.id
        );
    }

    onUserValueChange(values) {
        super.onUserValueChange();
        this.notifyValueChange(values, false, this.id);
    }

    /**
     * Abstract method called to display or hide child widgets
     *
     * @abstract
     * @param {Boolean} show
     */
    toggleWidgets(show) {}
}

export class WeSelect extends WeBaseSelection {
    static template = "web_editor.WeSelect";
    static props = {
        ...WeBaseSelection.props,
        placeholder: { type: String, optional: true },
    };
    static defaultProps = {
        ...WeBaseSelection.defaultProps,
        placeholder: "None",
    };
    setup() {
        super.setup();
        this.togglerState = useState({
            value: this.props.placeholder,
            open: false,
        });
        this.activeValue = useState(this.env.activeValue);
        useEffect(
            (...values) => {
                this.togglerState.value = values && values[0];
            },
            () => [...this.activeValue.values()]
        );
    }
    get togglerValue() {
        if (this.togglerState.value && this.togglerState.value.el) {
            return markup(this.togglerState.value.el.innerHTML);
        }
        return this.props.placeholder;
    }
    toggleWidgets(show) {
        this.togglerState.open = show;
    }

    onTogglerClick() {
        this.toggleWidgets(!this.togglerState.open);
    }
}

export class WeButtonGroup extends WeBaseSelection {
    static template = "web_editor.WeButtonGroup";
}

export class WeInput extends UserValueWidget {
    static template = "web_editor.WeInput";
    static props = {
        ...UserValueWidget.props,
        saveUnit: { type: String, optional: true },
        withUnit: { type: String, optional: true },
        extraClass: { type: String, optional: true },
        unit: { type: String, optional: true },
    };
    setup() {
        super.setup();
        this.state.values = "";
        this.state.inputValue = "";
    }
    get saveUnit() {
        return this.props.saveUnit || this.props.unit;
    }
    onUserValueChange(value, previewMode) {
        const propKeys = Object.keys(this.props);
        const methodName = [...this.optionValues.keys()].find((name) => propKeys.includes(name));
        value = value
            .split(/\s+/g)
            .map((v) => {
                const numValue = parseFloat(v);
                if (isNaN(numValue)) {
                    return this.defaultValue;
                } else {
                    const value = weUtils.convertNumericToUnit(
                        numValue,
                        this.props.unit,
                        this.saveUnit,
                        this.props.cssProperty
                    );
                    return `${this.floatToStr(value)}${this.saveUnit}`;
                }
            })
            .join(" ");
        this.notifyValueChange({ [methodName]: value }, previewMode, this.id);
    }
    onUserValuePreview(values) {
        super.onUserValuePreview();
        this.onUserValueChange(values, true);
    }
    onUserValueReset() {
        super.onUserValueReset();
        this.onUserValueChange(this.state.values, "reset")
    }
    computeValues(values) {
        const propKeys = Object.keys(this.props);
        for (const [name, value] of values) {
            if (propKeys.includes(name)) {
                if (!this.state.preview) {
                    this.state.inputValue = weUtils.convertValueToUnit(value, this.props.unit);
                }
                return weUtils.convertValueToUnit(value, this.saveUnit);
            }
        }
        return "";
    }
    onInput(ev) {
        this.state.preview = true;
        this.state.inputValue = ev.target.value;
        this.onUserValuePreview(ev.target.value, true);
    }
    onBlur(ev) {
        if (this.state.preview) {
            this.state.preview = false;
            this.onUserValueChange(ev.target.value, false);
        }
    }
    onKeydown(ev) {
        if (ev.key === "Enter" && this.state.preview) {
            this.state.preview = false;
            this.onUserValueChange(ev.target.value, false);
        }
    }
    isActive() {
        return true;
    }
    /**
     * Converts a floating value to a string, rounded to 5 digits without zeros.
     *
     * @private
     * @param {number} value
     * @returns {string}
     */
    floatToStr(value) {
        return `${parseFloat(value.toFixed(5))}`;
    }
}

export class WeColorPicker extends UserValueWidget {
    static template = "web_editor.WeColorPicker";
    static components = {
        ColorPalette,
    };
    static props = {
        ...UserValueWidget.props,
        withGradients: { type: Boolean, optional: true },
        opacity: { type: Number, optional: true },
        // The value is the name of the function which computes the combinations
        withCombinations: { type: String, optional: true },
        excluded: { type: String, optional: true },
    };
    static defaultProps = {
        ...UserValueWidget.defaultProps,
        withGradients: false,
        excluded: "",
    };
    // TODO: Find a better way to get these values.
    // Right now copy pasted because the old way to get them is to start a widget
    // and compute the available values.
    static colorNames = [
        "primary",
        "secondary",
        "alpha",
        "beta",
        "gamma",
        "delta",
        "epsilon",
        "success",
        "info",
        "warning",
        "danger",
        "1",
        "2",
        "3",
        "4",
        "5",
        "o-color-1",
        "o-color-3",
        "o-color-2",
        "o-color-4",
        "o-color-5",
        "black",
        "900",
        "800",
        "700",
        "600",
        "500",
        "400",
        "300",
        "200",
        "100",
        "white",
        "black-15",
        "black-25",
        "black-50",
        "black-75",
        "white-25",
        "white-50",
        "white-75",
        "white-85",
        "black",
        "900",
        "800",
        "700",
        "600",
        "500",
        "400",
        "300",
        "200",
        "100",
        "white",
    ];
    setup() {
        super.setup();
        this.togglerState = useState({
            style: "",
            open: false,
        });
        if (this.props.withCombinations) {
            this.data.methodNames.add(this.props.withCombinations);
            this.data.possibleValues[this.props.withCombinations] = [];
        }
        this.isGradient = false;
        this.ccValue = "";
        this.colorValue = "";
        this.data.params.colorNames = WeColorPicker.colorNames;

        // Validate a custom color when the Color Palette closes
        useEffect(
            (open) => {
                if (!open && this.customColor) {
                    this.onUserValueChange(
                        { ccValue: this.ccValue, color: this.customColor },
                        false
                    );
                }
            },
            () => [this.togglerState.open]
        );
    }
    get excluded() {
        const excluded = [...this.props.excluded.replace(/ /g, "").split(",")];
        if (this.props.noTransparency) {
            excluded.push("transparent_grayscale");
        }
        return excluded;
    }
    /**
     * Computes the style attribute of the span element used for displaying a
     * preview of the selected color.
     *
     * @returns {string}
     */
    getStyle() {
        let color;
        if (this.ccValue && !this.colorValue) {
            color = `var(--we-cp-o-cc${this.ccValue}-${this.props.colorPrefix.replace(/-/, "")})`;
        } else {
            color = this.colorValue;
        }
        const attribute = weUtils.isColorGradient(this.colorValue || this.ccValue)
            ? "background-image"
            : "background-color";
        return `${attribute}: ${color}`;
    }
    /**
     * @override
     */
    computeValues(values) {
        const valuesObj = {};
        for (const [name, value] of values) {
            if (name === this.props.withCombinations) {
                this.ccValue = value;
                continue;
            }
            if (this.data.methodNames.has(name)) {
                this.colorValue = value;
            }
            valuesObj[name] = value;
        }
        this.togglerState.style = this.getStyle();
        return valuesObj;
    }
    /**
     * TODO: colorPicker is only active if a color is selected.
     * @override
     */
    isActive() {
        return true;
    }
    onUserValuePreview(values) {
        super.onUserValuePreview();
        this.onUserValueChange(values, true);
    }
    onUserValueReset() {
        super.onUserValueReset();
        this.onUserValueChange(
            { ccValue: this.ccValue, color: this.customColor || this.colorValue },
            "reset"
        );
    }
    /**
     * ColorPalette callback when a color is hovered
     *
     * @param {{ccValue: String, color: String}} values
     */
    onColorHover(values) {
        this.onUserValuePreview(values);
    }
    /**
     * ColorPalette callback when a color is no longer hovered
     */
    onColorLeave() {
        this.onUserValueChange(
            { ccValue: this.ccValue, color: this.customColor || this.colorValue },
            "reset"
        );
    }
    /**
     * ColorPalette callback when a custom color is selected.
     * We do not send a preview=false right away. Only when the color picker is
     * close.
     *
     * @param {{ccValue: String, color: String}} values
     */
    onCustomColorPicked(values) {
        this.customColor = values.color;
    }
    /**
     * ColorPalette callback when a color square is clicked.
     *
     * @param {{ccValue: String, color: String}} values
     */
    onColorPicked(values) {
        this.togglerState.open = false;
        this.customColor = false;
        this.onUserValueChange(values, false);
    }
    /**
     * TODO: find a better way to do this.
     */
    onSetColorNames(colorNames) {
        this.data.params.colorNames = colorNames;
    }
    /**
     * Notifies the option that new values have been selected
     *
     * @param {{ccValue: String, color: String}} values
     * @param {Boolean|"reset"} previewMode
     */
    onUserValueChange(values, previewMode) {
        const newOptionValues = {};
        // We do not support multiple values for different method names
        // except for "withCombinations" so set the same value
        // for every other method of the option.
        for (const name of this.optionValues.keys()) {
            if (name === this.props.withCombinations) {
                newOptionValues[name] = values.ccValue;
            } else {
                newOptionValues[name] = values.color;
            }
        }
        this.notifyValueChange(newOptionValues, previewMode, this.id);
    }
}

export class WeMulti extends UserValueWidget {
    static template = "web_editor.WeMulti";
    setup() {
        super.setup();
        this.childWidgetIDs = [];
        this.data.subWidgets = [];
        useChildSubEnv({
            containerID: this.id,
            registerWidgetId: (id) => {
                this.childWidgetIDs.push(id);
            },
            notifyValueChange: this.childValueChanged.bind(this),
        });
    }

    computeValues(values) {
        const sortedWidgets = this.data.subWidgets.sort((a, b) =>
            a.params.sequence > b.params.sequence ? 1 : -1
        );
        for (const [name, value] of values) {
            let values = value.split(/\s*\|\s*/g);
            if (values.length === 1) {
                values = value.split(/\s+/g);
            }
            for (let i = 0; i < sortedWidgets.length; i++) {
                sortedWidgets[i].optionValues.set(name, values.shift());
            }
            //sortedWidgets[sortedWidgets.length - 1].optionValues.set(name, values.join(" "));
        }
        return values;
    }
    onUserValueReset() {
        super.onUserValueReset();
        this.notifyValueChange(this.state.values, "reset", this.id);
    }

    childValueChanged(value, previewMode, widgetID) {
        const newValues = {};
        const sortedWidgets = this.data.subWidgets.sort((a, b) =>
            a.params.sequence > b.params.sequence ? 1 : -1
        );
        for (const methodName of this.optionValues.keys()) {
            newValues[methodName] = sortedWidgets
                .map((widget) => {
                    if (widget === this.env.widgetsData[widgetID]) {
                        return value[methodName];
                    }
                    return widget.optionValues.get(methodName);
                })
                .join(" ");
        }
        this.notifyValueChange(newValues, previewMode, this.id);
    }
}

export class WeSelectPager extends WeSelect {
    static template = "web_editor.WeSelectPager";
    static defaultProps = { ...WeSelect.defaultProps, closeOnSelect: false };
    /**
     * @override
     */
    get cssClasses() {
        const classesObj = super.cssClasses;
        return {"o_we_widget_open": this.togglerState.open, ...classesObj};
    }
}
