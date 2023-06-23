/** @odoo-module **/
import { pick } from "@web/core/utils/objects";
import { uniqueId } from "@web/core/utils/functions";
import { camelToKebab } from "@web/core/utils/strings";
import { ColorPalette } from "@web_editor/js/wysiwyg/widgets/color_palette";
import weUtils from "@web_editor/js/common/utils";

import {
    Component,
    markup, onMounted,
    onWillStart,
    reactive,
    useChildSubEnv, useComponent,
    useEffect, useEnv,
    useRef,
    useState,
    useSubEnv, xml
} from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { MediaDialog } from "@web_editor/components/media_dialog/media_dialog";
import { DateTimeInput } from "@web/core/datetime/datetime_input";
import { useSortable } from "@web/core/utils/sortable";
import { _lt } from "@web/core/l10n/translation";
import { getActiveHotkey } from "@web/core/hotkeys/hotkey_service";
import { KeepLast } from "@web/core/utils/concurrency";
import { debounce } from "@web/core/utils/timing";

const { DateTime } = luxon;

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

/**
 * Used to display a tooltip using the slot given to a button.
 * Used if the button also has an faIcon.
 */
export class WeTooltip extends Component {
    static template = xml`<div class="p-1"><t t-slot="default"/></div>`;
}
/**
 * Function used by components to register their visibility.
 * The last children will determine if the parent component should be visible.
 * A parent is visible if one or more of the children component is visible.
 *
 * @return {{visibleChildren: {}, visible: boolean}}
 */
export function useParentedVisibility() {
    const component = useComponent();
    // The current component visibility state
    const visibleState = useState({
        visible: true,
        visibleChildren: new Map(),
    });
    // Make a method available for children components to notify the parent
    // of their visibility status.
    useChildSubEnv({
        updateParentVisibility: (childComponent, visible) => {
            visibleState.visibleChildren.set(childComponent, visible);
        },
    });
    const env = useEnv();
    // When the children's visibility state are updated, check if the
    // parent should update theirs.
    useEffect(
        (...childValues) => {
            if (childValues.length > 0) {
                visibleState.visible = childValues.includes(true);
            }
        },
        () => [...visibleState.visibleChildren.values()]
    );
    // When this component's visibility state is updated, notify the parent.
    useEffect(
        () => {
            env.updateParentVisibility?.(component, visibleState.visible);
        },
        () => [visibleState.visible]
    );

    return visibleState;
}
/**
 * Layout component with the extra ability to hide itself in case all the
 * children component are being hidden. @see useParentedVisibility
 */
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
        this.visibilityState = useParentedVisibility();
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
/**
 * Abstract Widget class for SnippetOptions
 */
export class UserValueWidget extends Component {
    static props = {
        name: { type: String, optional: true },
        applyTo: { type: String, optional: true },
        defaultValue: { type: String, optional: true },
        title: { type: String, optional: true },
        noPreview: { type: Boolean, optional: true },
        dependencies: { type: Array, optional: true },
        // Allow any prop for customisation purposes.
        "*": {},
        slots: {
            type: Object,
            optional: true,
            shape: {
                title: { Object, optional: true },
                default: { Object, optional: true },
            },
        },
    };
    static defaultProps = {
        noPreview: false,
    };
    setup() {
        this.state = useState({
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
            let possibleValues = this.props[name];
            if (!Array.isArray(this.props[name])) {
                possibleValues = [this.props[name]];
            }
            this.data.possibleValues[name].push(...possibleValues);

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
                if (!containerData.subWidgetsOwnValues) {
                    this.data.optionValues = containerData.optionValues;
                }
            }
        }
        this.optionValues = useState(this.data.optionValues);
        this.env.registerWidgetId(this.id);

        this.visibilityState = useParentedVisibility();

        // This is the key part of the widget re-rendering.
        // Whenever an option updates the "optionValues" state stored in the env
        // this useEffect will execute so that widgets can compute their state
        // according to the values.
        useEffect(
            () => {
                this.state.values = this.computeValues([...this.optionValues.entries()]);
                this.state.active = this.isActive();
            },
            () => [...this.optionValues.values()]
        );
        // Always reset if the widget was in previewMode but is no longer visible.
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
     * @returns {Object} - keys will be the css class and values will be truthy
     *                      or falsy if the class should be on or not
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
    /**
     * Shortcut to `this.data.methodNames` which is a set.
     * @return {String[]}
     */
    get methodNames() {
        return [...this.data.methodNames.values()];
    }
    /**
     * Returns the first possible value of the specified methodName
     * or return a dictionary of all default values by methodName.
     *
     * @param [methodName]
     * @return {*|Object}
     */
    getDefaultValue(methodName) {
        if (this.props.defaultValue) {
            return this.props.defaultValue;
        }
        if (!methodName) {
            const values = {};
            for (const methodName of this.methodNames) {
                values[methodName] = this.getDefaultValue(methodName);
            }
            return values;
        }
        const possibleValues = this.data.possibleValues[methodName];
        if (possibleValues) {
            return possibleValues[0];
        }
        return '';
    }
    /**
     * Returns the values stored in the props as those would be the values
     * considered as active. Same as above, if no method name give, returns
     * an object with each methodName associated with their activeValues.
     *
     * @param [methodName]
     * @return {*|Object}
     */
    getActiveValues(methodName) {
        if (!methodName) {
            return pick(this.props, ...this.methodNames);
        }
        // The active value is the one given to the widget as a prop.
        return this.props[methodName] || "";
    }
    /**
     * This method is called by the useEffect whenever an option updates
     * the values the widget should display.
     *
     * @param {[[String, String]]} values
     * @returns {*}
     */
    computeValues(values) {
        return pick(Object.fromEntries(values), ...this.env.validMethodNames);
    }
    /**
     * Returns whether the widget is active (holds a value).
     *
     * @return {boolean}
     */
    isActive() {
        for (const value of Object.values(this.optionValues)) {
            if (value && value !== NULL_ID) {
                return true;
            }
        }
    }
    /**
     * @param {boolean} visible
     */
    toggleVisibility(visible) {
        if (visible === undefined) {
            return (this.visibilityState.visible = !this.visibilityState.visible);
        }
        return (this.visibilityState.visible = visible);
    }
    /**
     * This method should be called whenever a widget is about to notify
     * the option of a preview change
     */
    onUserValuePreview() {
        this.state.preview = true;
        this.data.preview = true;
    }
    /**
     * This method should be called whenever a widget leaves the preview mode
     */
    onUserValueReset() {
        this.state.preview = false;
        this.data.preview = false;
    }
    /**
     * This method should be called whenever a widget is about to notify
     * the option of a new selected value.
     */
    onUserValueChange() {
        this.state.preview = false;
        this.data.preview = false;
    }
    // TODO: The old system just used "getValue" at a higher level
    /**
     * Notifies the option of new values selected.
     *
     * @param {Object} values - the key is the method name and the value is the
     *                          value the widget holds. It can be different per
     *                          method like in the case of a button that activates
     *                          a class but also a style attribute.
     *                          It can also be the same for each method.
     * @param {true|false|"reset"} preview
     */
    notifyValueChange(values, preview) {
        if (this.props.noPreview && preview) {
            return;
        }
        this.activeValues = values;
        this.env.notifyValueChange(...arguments, this.id, { activeValues: this.state.values });
    }
    /**
     * Allows options and other widgets to trigger a state on this widget.
     *
     * @param previewMode
     */
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
        // Special prop which adds a <i/> tag with the class given as prop
        faIcon: { type: String, optional: true },
    };
    /**
     * @override
     */
    setup() {
        super.setup();

        for (const methodName of this.methodNames) {
            if (this.data.possibleValues[methodName].length <= 1) {
                this.data.possibleValues[methodName].unshift("");
            }
        }

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
    /**
     * Whether a tooltip should be shown
     */
    get showTooltip() {
        return this.img || this.svg || this.props.faIcon;
    }
    /**
     * @override
     */
    computeValues(values) {
        return pick(Object.fromEntries(values), ...Object.keys(this.props));
    }
    /**
     * @override
     */
    isActive() {
        for (const methodName of this.optionValues.keys()) {
            if (this.getActiveValues(methodName) === this.optionValues.get(methodName)) {
                // If the button is part of a container
                if (this.env.activeValue) {
                    this.env.activeValue.set(methodName, this.valueRef);
                }
                return true;
            }
        }
        return false;
    }
    /**
     * @override
     */
    onUserValuePreview() {
        super.onUserValuePreview();
        if (this.props.noPreview) {
            return;
        }
        const preview = true;
        this.state.preview = true;
        const values = this.state.active ? this.getDefaultValue() : this.getActiveValues();
        this.notifyValueChange(values, preview);
    }
    /**
     * @override
     */
    onUserValueReset() {
        if (this.state.preview) {
            super.onUserValueReset();
            const preview = "reset";
            const values = pick(this.state.values, ...this.methodNames);
            this.notifyValueChange(values, preview);
        }
    }
    /**
     * @override
     */
    onUserValueChange() {
        super.onUserValueChange();
        const preview = false;
        this.state.preview = false;
        const values = this.state.active ? this.getDefaultValue() : this.getActiveValues();
        this.notifyValueChange(values, preview);
    }
    /**
     * Toggles the tooltip when the mouse hovers the button
     */
    onMouseEnter() {
        this.toggleTooltip(true);
        this.onUserValuePreview();
    }
    /**
     * Hide the tooltip when the mosue no longer hovers the button
     */
    onMouseLeave() {
        this.toggleTooltip(false);
        this.onUserValueReset();
    }
    toggleTooltip(show) {
        if (show && this.showTooltip && this.props.slots?.default) {
            this.removePopover = this.popover.add(this.valueRef.el, WeTooltip, {slots: {
                default: this.props.slots.default
            }});
        } else {
            this.removePopover?.();
        }
    }
}
export class WeCheckbox extends WeButton {
    static template = "web_editor.WeCheckbox";
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
    /**
     * @override
     */
    setup() {
        super.setup();
        this.data.subWidgets = [];
        this.data.container = true;
        this.data.toggleWidgets = this.toggleWidgets.bind(this);
        if (!this.env.activeValue) {
            useSubEnv({
                activeValue: reactive(new Map()),
            });
        }
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
            registerWidgetId: (id) => {},
            containerID: this.id,
        });
    }
    /**
     * @override
     */
    onUserValuePreview(values) {
        super.onUserValuePreview();
        this.notifyValueChange(values, true);
    }
    /**
     * @override
     */
    onUserValueReset() {
        super.onUserValueReset();
        this.notifyValueChange(this.state.values, "reset");
    }
    /**
     * @override
     */
    onUserValueChange(values) {
        super.onUserValueChange();
        this.notifyValueChange(values, false);
    }
    /**
     * Optional method called to display or hide child widgets
     *
     * @param {Boolean} show
     */
    toggleWidgets(show) {
        // If an item was previewed before closing the widget
        // reset its preview as it will not be able do reset it
        // itself.
        if (this.state.preview && !show) {
            this.onUserValueReset();
        }
    }
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
    /**
     * @override
     */
    setup() {
        super.setup();
        this.state.togglerValue = this.props.placeholder;
        this.state.isToggleActive = false;
        this.activeValue = useState(this.env.activeValue);
        useEffect(
            (...values) => {
                this.state.togglerValue = values && values[0];
            },
            () => [...this.activeValue.values()]
        );
    }
    /**
     * @type {String|Markup}
     */
    get togglerValue() {
        if (this.state.togglerValue) {
            if (this.state.togglerValue.el) {
                return markup(this.state.togglerValue.el.innerHTML);
            } else {
                return this.state.togglerValue;
            }
        }
        return this.props.placeholder;
    }
    /**
     * @override
     */
    onUserValuePreview() {
        if (!this.state.isTogglerActive) {
            return;
        }
        super.onUserValuePreview(...arguments);
    }
    /**
     * @override
     */
    toggleWidgets(show) {
        this.state.isTogglerActive = show;
    }
    /**
     * Toggles the menu
     */
    onTogglerClick() {
        this.toggleWidgets(!this.state.isTogglerActive);
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
        placeholder: { type: String, optional: true },
    };
    static defaultProps = {
        ...UserValueWidget.defaultProps,
        unit: "",
    };
    /**
     * @override
     */
    setup() {
        super.setup();
        this.state.values = this.getDefaultValue(this.methodNames[0]);
        this.state.inputValue = "";
    }
    /**
     * @type {String}
     */
    get saveUnit() {
        return this.props.saveUnit || this.props.unit;
    }
    isActive() {
        const methodName = this.methodNames[0]
        return (
            weUtils.convertValueToUnit(this.optionValues.get(methodName) || "", this.props.unit)
            !== this.getDefaultValue(methodName)
        );
    }
    getDefaultValue(methodName) {
        const value = super.getDefaultValue(methodName);
        return super.getDefaultValue(methodName);
    }

    /**
     * @override
     */
    notifyValueChange(value, previewMode) {
        super.notifyValueChange(this.formatValues(value), previewMode);
    }
    /**
     * Formats the value the input holds and set it as the value of any method
     * passed in props that holds true or an empty string.
     * @return {Object} - where the key is the methodName and the widget value
     *                  - is what the widget holds.
     */
    formatValues(value) {
        const newValues = {};
        const formattedValue = value
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
        for (const methodName of this.methodNames) {
            newValues[methodName] = formattedValue;
        }
        return newValues;
    }
    /**
     * @override
     */
    onUserValuePreview(values) {
        super.onUserValuePreview();
        this.notifyValueChange(values, true);
    }
    /**
     * @override
     */
    onUserValueReset() {
        super.onUserValueReset();
        this.notifyValueChange(this.state.values, "reset");
    }
    /**
     * @override
     */
    onUserValueChange(value) {
        super.onUserValueChange();
        this.notifyValueChange(value);
    }
    /**
     * @override
     */
    computeValues(values) {
        const propKeys = Object.keys(this.props);
        for (const [methodName, value] of values) {
            if (propKeys.includes(methodName)) {
                if (value === undefined || "") {
                    this.state.inputValue = "";
                    return "";
                }
                if (!this.state.preview) {
                    this.state.inputValue = weUtils.convertValueToUnit(value, this.props.unit);
                }
                return weUtils.convertValueToUnit(value, this.saveUnit);
            }
        }
        return this.getDefaultValue(this.methodNames[0]);
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

    //--------------------------------------------------------------------------
    // External events
    //--------------------------------------------------------------------------

    onInput(ev) {
        this.state.preview = true;
        this.state.inputValue = ev.target.value;
        this.onUserValuePreview(ev.target.value);
    }
    onBlur(ev) {
        if (this.state.preview) {
            this.state.preview = false;
            this.onUserValueChange(ev.target.value);
        }
    }
    onKeydown(ev) {
        const key = getActiveHotkey(ev);
        switch (key) {
            case "enter": {
                if (this.state.preview) {
                    this.onUserValueChange(ev.target.value);
                }
                break;
            }
            // TODO: arrowup and arrowdown for steps
        }
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
                } else if (!open && this.state.preview) {
                    this.onUserValueReset();
                }
            },
            () => [this.state.isTogglerActive]
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
        this.state.togglerStyle = this.getStyle();
        return valuesObj;
    }
    /**
     * TODO: colorPicker is only active if a color is selected.
     * @override
     */
    isActive() {
        return this.ccValue || this.colorValue;
    }
    onUserValuePreview(values) {
        if (!this.state.isTogglerActive) {
            // Ignore events that occur inbetween the toggler being open
            // and closed.
            return;
        }
        super.onUserValuePreview();
        this.notifyValueChange(values, true);
    }
    onUserValueReset() {
        super.onUserValueReset();
        this.notifyValueChange(
            { ccValue: this.ccValue, color: this.customColor || this.colorValue },
            "reset"
        );
    }
    onUserValueChange(values) {
        super.onUserValueChange();
        this.notifyValueChange(values, false);
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
        this.onUserValueReset();
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
        this.state.isTogglerActive = false;
        this.customColor = false;
        this.onUserValueChange(values);
    }
    /**
     * TODO: find a better way to do this.
     */
    onSetColorNames(colorNames) {
        this.data.params.colorNames = colorNames;
    }
    /**
     * @override
     * @param {{ccValue: String, color: String}} values
     * @param {Boolean|"reset"} previewMode
     */
    notifyValueChange(values, previewMode) {
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
        super.notifyValueChange(newOptionValues, previewMode);
    }
}

export class WeMulti extends UserValueWidget {
    static template = "web_editor.WeMulti";
    setup() {
        super.setup();
        this.childWidgetIDs = [];
        this.data.subWidgets = [];
        // Each widget act as its own "selectStyle" widget.
        this.data.subWidgetsOwnValues = true;
        useChildSubEnv({
            containerID: this.id,
            registerWidgetId: (id) => {
                this.childWidgetIDs.push(id);
            },
            notifyValueChange: this.childValueChanged.bind(this),
        });
    }
    /**
     * @override
     */
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
    /**
     * @override
     */
    onUserValueReset() {
        super.onUserValueReset();
        this.notifyValueChange(this.state.values, "reset");
    }
    /**
     * Override of the "notifyValueChange" exposed to sub widgets to compute
     * the total value of this widget.
     */
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
        this.notifyValueChange(newValues, previewMode);
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
        return {"o_we_widget_open": this.state.isTogglerActive, ...classesObj};
    }
}

export class WeMediaPicker extends UserValueWidget {
    static components = { WeButton };
    static template = "web_editor.WeMediaPicker";
    static props = {
        ...UserValueWidget.props,
        buttonStyle: { type: Boolean, optional: true },
    };
    static defaultProps = {
        buttonStyle: false,
    };
    /**
     * @override
     */
    setup() {
        super.setup();
        this.dialog = useService("dialog");
    }
    /**
     * @type {active: Boolean}
     */
    get buttonClass() {
        return {
            "active": this.isActive(),
        };
    }
    get faIcon() {
        if (this.props.buttonStyle) {
            return "fa fa-fw fa-camera";
        }
        return false;
    }
    notifyValueChange(mediaSrc) {
        // In the case of the Mediapicker, we will call all the methods with
        // the same values.
        // TODO: Maybe this should be made more generic.
        const values = {};
        for (const methodName of this.methodNames) {
            values[methodName] = mediaSrc;
        }
        super.notifyValueChange(values, false);
    }
    /**
     * Creates and opens a media dialog to edit a given element's media.
     *
     * @private
     * @param {HTMLElement} el the element whose media should be edited
     * @param {boolean} [images] whether images should be available
     *   default: false
     * @param {boolean} [videos] whether videos should be available
     *   default: false
     * @param {Function} save the function called when the dialog is confirmed.
     */
    openDialog(el, {images = false, videos = false, save}) {
        el.src = Object.values(this.state.values)[0];
        const editable = this.env.editable.matches(".o_editable") || this.env.editable.querySelector(".o_editable");
        this.dialog.add(MediaDialog, {
            noImages: !images,
            noVideos: !videos,
            noIcons: true,
            noDocuments: true,
            isForBgVideo: true,
            vimeoPreviewIds: ['299225971', '414790269', '420192073', '368484050', '334729960', '417478345',
                '312451183', '415226028', '367762632', '340475898', '374265101', '370467553'],
            'res_model': editable.dataset.oeModel,
            'res_id': editable.dataset.oeId,
            save,
            media: el,
        });
    }
    /**
     * Called when the edit button is clicked.
     *
     * @private
     * @param {Event} ev
     */
    onEditMedia() {}
}

export class WeImagePicker extends WeMediaPicker {
    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    onEditMedia(ev) {
        // Need a dummy element for the media dialog to modify.
        const dummyEl = document.createElement('img');
        this.openDialog(dummyEl, {
            images: true,
            save: (media) => {
                // Accessing the value directly through dummyEl.src converts the url to absolute,
                // using getAttribute allows us to keep the url as it was inserted in the DOM
                // which can be useful to compare it to values stored in db.
                this.notifyValueChange(media.getAttribute("src"));
            }
        });
    }
}
export class WeVideoPicker extends WeMediaPicker {
    /**
     * @override
     */
    onEditMedia(ev) {
        // Need a dummy element for the media dialog to modify.
        const dummyEl = document.createElement('iframe');
        this.openDialog(dummyEl, {
            videos: true,
            save: (media) => {
                this.notifyValueChange(media.querySelector('iframe').src);
            }});
    }
}

export class WeDatetimePicker extends UserValueWidget {
    static template = "web_editor.WeDatetimePicker";
    static components = { DateTimeInput };
    type = "datetime";
    setup() {
        super.setup();
        this.localizationService = useService("localization");
        this.defaultFormat = this.localizationService.dateTimeFormat;
    }
    get dateTimePickerValue() {
        if (!Object.values(this.state.values)[0]) {
            return null;
        }
        return DateTime.fromMillis(Object.values(this.state.values)[0]);
    }
    onDateTimePickerChange(newValue) {
        this.onUserValuePreview(newValue);
    }
    onDateTimePickerApply(newValue) {
        this.onUserValueChange(newValue);
    }
    onUserValuePreview(newValue) {
        super.onUserValuePreview();
        this.notifyValueChange(newValue.ts, true);
    }
    onUserValueReset() {
        super.onUserValueReset();
        this.notifyValueChange(Object.values(this.state.values)[0], "reset");
    }
    onUserValueChange(newValue) {
        super.onUserValueChange();
        if (this.state.preview) {
            this.onUserValueReset();
        }
        this.notifyValueChange(newValue.ts, false);
    }
    notifyValueChange(value, preview) {
        const newValues = {};
        for (const methodName of this.methodNames) {
            newValues[methodName] = value;
        }
        super.notifyValueChange(newValues, preview);
    }
}
export class WeDatePicker extends WeDatetimePicker {
    type = "date";
    setup() {
        super.setup();
        this.defaultFormat = this.localizationService.dateFormat;
    }
}

export class WeRange extends WeInput {
    static template = "web_editor.WeRange";
    static props = {
        ...WeInput.props,
        max: { type: Number, optional: true },
        min: { type: Number, optional: true },
        step: { type: Number, optional: true },
    };
    static defaultProps = {
        ...WeInput.defaultProps,
        max: null,
        min: null,
        step: 1,
    };
    get max() {
        if (this.props.max !== null) {
            return this.props.max;
        }
        for (const methodName of this.methodNames) {
            if (this.data.possibleValues[methodName].length > 1) {
                return this.data.possibleValues[methodName].length - 1;
            }
        }
        return 100;
    }
    get min() {
        if (this.props.min !== null) {
            return this.props.min;
        }
        return 0;
    }
    computeValues(values) {
        for (const [methodName, value] of values) {
            if (this.data.possibleValues[methodName].length > 1) {
                const index = this.data.possibleValues[methodName].indexOf(value);
                this.state.inputValue = index;
                return index;
            }
        }
        return super.computeValues(...arguments);
    }
    onRangeChange(ev) {
        this.state.inputValue = ev.target.value;
        this.onUserValueChange(ev.target.value, false);
    }
    onRangeInput(ev) {
        this.onUserValuePreview(ev.target.value, true);
    }
    formatValues(value) {
        const newValues = super.formatValues(value);
        for (const methodName of this.methodNames) {
            if (this.data.possibleValues[methodName].length > 1) {
                newValues[methodName] = this.data.possibleValues[methodName][parseInt(value)];
            }
        }
        return newValues;
    }
}

export class WeList extends UserValueWidget {
    static template = "web_editor.WeList";
    static components = { WeSelect };
    static props = {
        ...UserValueWidget.props,
        editable: { type: Boolean, optional: true },
        newElementsNotToggleable: { type: Boolean, optional: true },
        inputs: {
            type: Array,
            optional: true,
        },
        records: { type: Array, optional: true, element: Object },
        selectValue: { type: String, optional: true },
        defaultValue: { type: String, optional: true },
        slots: {
            type: Object,
            optional: true,
            shape: {
                ...UserValueWidget.props.slots.shape,
                createWidget: { optional: true },
            }
        }
    };
    static defaultProps = {
        ...UserValueWidget.defaultProps,
        editable: true,
        inputs: [{idMode: "name", display: "display_name"}],
        newElementsNotToggleable: false,
        selectValue: _lt("Select an item"),
        defaultValue: _lt("Entry"),
        records: [],
    };
    setup() {
        super.setup();
        this.state.list = [];
        this.tableRef = useRef("table");
        this.state.isTogglerOpen = false;
        useSortable({
            ref: this.tableRef,
            elements: "tr",
            handle: ".o_we_drag_handle",
            onDrop: (params) => {
                const newList = [];
                for (const el of this.tableRef.el.querySelectorAll("tr")) {
                    if (!el.classList.contains("o_dragged")) {
                        newList.push(this.state.list[el.dataset.index]);
                    }
                }
                this.notifyValueChange(newList);
            }
        });
    }
    computeValues(values) {
        // Usually this widget will be used with one method, but if more than a
        // method is given, use the last one that was an array.
        for (const [, value] of values) {
            const parsedValue = value && JSON.parse(value);
            if (parsedValue && Array.isArray(parsedValue)) {
                this.state.list = parsedValue;
                this.newList = null;
            }
        }
        return super.computeValues(values);
    }
    toggleItem(item) {
        const newList = Array.from(this.newList || this.state.list);
        const itemIndex = newList.findIndex((element => element.id === item.id));
        newList[itemIndex].selected = !newList[itemIndex].selected;
        this.notifyValueChange(newList);
    }
    deleteItem(item) {
        const newList = Array.from(this.newList || this.state.list);
        const itemIndex = newList.findIndex((element => element.id === item.id));
        newList.splice(itemIndex, 1);
        this.notifyValueChange(newList);
    }
    addItem() {
        const newList = Array.from(this.newList || this.state.list);
        newList.push({
            display_name: this.props.defaultValue,
            notToggleable: this.props.newElementsNotToggleable,
            selected: true,
        });
        this.notifyValueChange(newList);
    }
    addExisting(recordIndex) {
        const newList = Array.from(this.newList || this.state.list);
        const record = this.props.records[recordIndex];
        record.notToggleable = this.props.newElementsNotToggleable;
        newList.push(record);
        this.notifyValueChange(newList);
    }
    /**
     * Mostly used to match previous test cases. Dump the data from the record
     * in the DOM.
     *
     * @param input
     * @param listItem
     * @return {{}}
     */
    getInputAttributes(input, listItem) {
        const attrs = { [input.idMode || 'name']: listItem.id };
        // TODO: maybe only output those values to DOM if we're in test mode?
        for (const [dataKey, dataValue] of Object.entries(listItem)) {
            attrs[`data-${camelToKebab(dataKey)}`] = dataValue.toString();
        }
        return attrs;
    }
    notifyValueChange(newList) {
        if (!newList && !this.state.preview) {
            newList = this.newList;
        }
        this.newList = newList;
        const newValue = JSON.stringify(newList);
        const methodName = this.methodNames[this.methodNames.length - 1];
        const previousValue = this.state.values[methodName] || "[]";
        if (newValue !== previousValue) {
            const values = {
                [methodName]: newValue,
            };
            super.notifyValueChange(values, this.state.preview);
        }
    }
    onInputFocus() {
        this.state.preview = true;
    }
    onInputBlur() {
        this.state.preview = false;
        this.notifyValueChange(null);
    }
    onInputKeydown(ev) {
        const key = getActiveHotkey(ev);
        if (key === "enter" && this.state.preview) {
            this.state.preview = false;
        }
    }
    onInputInput(ev) {
        const newList = Array.from(this.newList || this.state.list);
        const inputDef = this.props.inputs[ev.target.dataset.inputIndex];
        const itemIndex = ev.target.dataset.itemIndex;
        const item = { ...this.state.list[itemIndex] };
        item[inputDef.display] = ev.target.value;
        newList[itemIndex] = item;
        this.notifyValueChange(newList);
    }
}
WeList.props.slots.shape["add-button"] = { Object, optional: true };

let m2oRpcCache = {};
export const clearM2oRpcCache = () => {
    m2oRpcCache = {};
};
export class WeMany2one extends UserValueWidget {
    static template = "web_editor.WeMany2one";
    static props = {
        ...UserValueWidget.props,
        model: { type: String },
        fields: { type: Array, element: String, optional: true },
        domain: { type: Array, optional: true },
        createMethod: { type: String, optional: true },
        filterInModel: { type: String, optional: true },
        filterInField: { type: String, optional: true },
        placeholder: { type: String, optional: true },
        limit: { type: Number, optional: true },
    };
    static defaultProps = {
        limit: 5,
        placeholder: _lt("Select a record"),
        fields: ["display_name"],
        domain: [],
    };
    static components = { WeSelect };
    /**
     * @override
     */
    setup() {
        super.setup();
        useSubEnv({
            activeValue: reactive(new Map()),
        });
        useChildSubEnv({
            registerWidgetId: (id) => {
                this.weListId = id;
            }
        });

        this._orm = useService("orm");
        // Proxy to cache ORM calls.
        this.orm = new Proxy(this, {
            get(target, prop) {
                return (...args) => {
                    const cacheId = JSON.stringify(args);
                    if (!target._rpcCache[cacheId]) {
                        target._rpcCache[cacheId] = target._orm[prop](...args);
                    }
                    return target._rpcCache[cacheId];
                };
            }
        });

        this._rpcCache = m2oRpcCache;
        this.displayNameCache = {};
        this.domainComponents = {};

        this.state.recordsList = [];
        this.state.searchValue = "";

        this.searchKeepLast = new KeepLast();
        this.nameGetKeepLast = new KeepLast();

        this.state.createInputValue = "";
        const debouncedSearch = debounce((searchValue) => this.searchKeepLast.add(this.search(searchValue)), 250);

        useEffect(
            (searchValue) => {
                debouncedSearch(searchValue);
            },
            // Re-compute the search box if the domain changes as well.
            // Flattening it to properly compute dependencies.
            () => [this.state.searchValue, ...this.props.domain.flat()]
        );

        // TODO: Make sure that any widget realying on this line of code
        // definie it itself from now on.
        // options.nullText = $target[0].dataset.nullText ||
        //     JSON.parse($target[0].dataset.oeContactOptions || '{}')['null_text'];

    }
    get fields() {
        const fields = this.props.fields;
        if (!fields.includes("display_name")) {
            fields.push("display_name");
        }
        return fields;
    }
    /**
     * @override 
     */
    computeValues(values) {
        for (const [methodName, value] of values) {
            const id = parseInt(value);
            if (isNaN(id)) {
                this.changeSelectName(() => this.props.placeholder, methodName);
                this.state.activeId = false;
                continue;
            }
            this.state.activeId = id;
            const existingRecord = this.state.recordsList.find(record => record.id === id);
            if (!existingRecord) {
                this.changeSelectName(
                    async () => {
                        const [, name] = (await this.orm.nameGet(this.props.model, [id]))[0];
                        return name;
                    },
                    methodName
                );
            } else {
                this.changeSelectName(() => existingRecord.display_name, methodName);
            }
        }
        return super.computeValues(...arguments);
    }
    /**
     * Only keep the last name change even if there's a current call
     * to the server.
     *
     * @param {Function} nameFunc
     * @param {String} methodName - This is to properly conform to WeSelect
     */
    changeSelectName(nameFunc, methodName) {
        this.nameGetKeepLast.add(Promise.resolve(nameFunc())).then((name) => {
            this.env.activeValue.set(methodName, name);
        });
    }
    /**
     * Searches the database for corresponding records and updates the dropdown
     *
     * @protected
     */
    async search(searchValue) {
        const recTuples = await this.orm.call(
            this.props.model, 
            "name_search",
            [],
            {
                name: searchValue,
                operator: "ilike",
                args: (await this.getSearchDomain()).concat(
                    Object.values(this.domainComponents).filter(item => item !== null)
                ),
                limit: this.props.limit + 1,
            }
        );
        const records = await this.orm.read(
            this.props.model,
            recTuples.map(([id, _name]) => id),
            this.fields
        );
        this.state.recordsList = records;
    }
    /**
     * Returns the domain to use for the search.
     *
     * @private
     */
    async getSearchDomain() {
        return this.props.domain;
    }
    selectRecord(record) {
        this.data.params.record = record;
        this.data.params.callWith = record[this.props.callWith];
        this.notifyValueChange({
            [this.methodNames[this.methodNames.length - 1]]: record.id,
        }, false);
        // Bit hackish way of accessing the weList to toggle it.
        this.env.widgetsData[this.weListId]?.toggleWidgets(false);
    }
}

export class WeMany2Many extends UserValueWidget {
    static template = "web_editor.WeMany2Many";
    static components = { WeList, WeMany2one };
    /**
     * @override
     */
    setup() {
        super.setup();
        this.listWidgetName = uniqueId("m2m_list_widget");
        this.data.subWidgets = [];
        useChildSubEnv({
            notifyValueChange: this.subWidgetValueChanged.bind(this),
            containerID: this.id,
            subWidgetsOwnValues: true,
            registerWidgetId: () => null,
            validMethodNames: ["renderListItems", "addRecord"],
        });
        onMounted(() => {
            this.data.methodNames.delete("renderListItems");
            this.data.methodNames.delete("addRecord");
        })
    }
    /**
     * @override
     */
    computeValues(values) {
        const listWidget = this.data.subWidgets.find(widget => widget.name === this.listWidgetName);
        for (const [methodName, value] of values) {
            if (methodName === this.methodNames[0]) {
                const entries = JSON.parse(value);
                for (const entry of entries) {
                    entry.undeletable = false;
                    entry.notToggleable = true;
                    entry.undraggable = true;
                }
                listWidget.optionValues.set("renderListItems", JSON.stringify(entries));
            }
        }
        return values;
    }
    /**
     * @override
     */
    notifyValueChange(values, preview) {
        const newValues = { [this.methodNames[0]]: values };
        return super.notifyValueChange(newValues, preview);
    }
    /**
     * Called by sub widgets to notify this widget that their value is changed.
     * Computes the value and then notify the option.
     *
     * @param {Object} values - the values the widget hold
     * @param {Boolean|"reset"} previewMode
     * @param {String} widgetId - the subWidget id
     */
    subWidgetValueChanged(values, previewMode, widgetId) {
        const methodName = this.methodNames[0];
        // m2o adding value
        if (Object.keys(values).includes("addRecord")) {
            const newValues = JSON.parse(this.state.values[methodName] || "[]");
            const widgetParams = this.env.widgetsData[widgetId].params;
            this.data.params = widgetParams;
            newValues.push({
                id: values["addRecord"],
                display_name: widgetParams.record.display_name,
                callWith: widgetParams.callWith,
            });
            // TODO: do the ORM call.
            return this.notifyValueChange(JSON.stringify(newValues), previewMode);
        }
        // we-list removing a value.
        if (Object.keys(values).includes("renderListItems")) {
            return this.notifyValueChange(values.renderListItems, previewMode);
        }
    }
}
