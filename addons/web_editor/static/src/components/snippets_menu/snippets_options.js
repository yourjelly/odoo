/** @odoo-module **/
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { convertCSSColorToRgba } from "@web/core/utils/colors";
import weUtils from "@web_editor/js/common/utils";
import { preserveCursor, descendants } from "@web_editor/js/editor/odoo-editor/src/OdooEditor";
import * as widgets from "./snippet_widgets";

import {
    Component,
    useState,
    useEffect,
    useSubEnv,
    onWillUpdateProps,
    xml,
    onMounted,
    onWillStart,
} from "@odoo/owl";
import { MEDIAS_BREAKPOINTS, SIZES } from "@web/core/ui/ui_service";
import { pick } from "@web/core/utils/objects";
import { useService } from "@web/core/utils/hooks";
import * as gridUtils from "@web_editor/js/common/grid_layout_utils";
import dom from "@web/legacy/js/core/dom";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
const {
    normalizeColor,
} = weUtils;
import {
    loadImage,
    loadImageInfo,
    applyModifications,
    isImageSupportedForProcessing,
    isImageSupportedForStyle,
    getDataURLBinarySize,
} from "@web_editor/js/editor/image_processing";

/**
 * Creates a proxy for an object where one property is replaced by a different
 * value. This value is captured in the closure and can be read and written to.
 *
 * @param {Object} obj - the object for which to create a proxy
 * @param {string} propertyName - the name/key of the property to replace
 * @param {*} value - the initial value to give to the property's copy
 * @returns {Proxy} a proxy of the object with the property replaced
 */
function createPropertyProxy(obj, propertyName, value) {
    return new Proxy(obj, {
        get: function (obj, prop) {
            if (prop === propertyName) {
                return value;
            }
            return obj[prop];
        },
        set: function (obj, prop, val) {
            if (prop === propertyName) {
                return (value = val);
            }
            return Reflect.set(...arguments);
        },
    });
}
/**
 * Main class defining right panel options.
 */
export class SnippetOption extends Component {
    static components = { ...widgets };
    static props = [
        "id",
        "template",
        "target",
        "updateOverlay",
        "visible",
        "toggleVisibility",
        "toggleOverlay",
        "optionUpdate",
        "requestUserValueWidget",
        "notifyOptions",
        "updateOptionsUICounter",
        "updateOptionsUIVisibilityCounter",
        "overlayEl",
        "events",
        "data",
    ];
    /**
     * Indicates if the option should be displayed in the button group at the
     * top of the options panel, next to the clone/remove button.
     *
     * @type {boolean}
     */
    static isTopOption = false;
    /**
     * The option needs the handles overlay to be displayed on the snippet.
     *
     * @type {boolean}
     */
    static displayOverlayOptions = false;
     /**
      * Forces the target to not be possible to remove.
      *
      * @type {boolean}
      */
     static forceNoDeleteButton = false;
    events = {
        cleanForSave: this.cleanForSave.bind(this),
        onBuilt: this.onBuilt.bind(this),
        onClone: this.onClone.bind(this),
        onMove: this.onMove.bind(this),
        onRemove: this.onRemove.bind(this),
        onTargetShow: this.onTargetShow.bind(this),
        onTargetHide: this.onTargetHide.bind(this),
        notify: this.notify.bind(this),
    };
    setup() {
        this.editionState = useState(this.env.editionState);
        this.dialogService = useService("dialog");

        Object.assign(this.props.events, this.events);
        this.widgetIds = [];
        this.actionQueues = new Map();
        this.widgetsVisibility = useState({});
        this.target = this.props.target;
        this.visible = false;

        useSubEnv({
            validMethodNames: [
                "selectClass",
                "selectDataAttribute",
                "selectStyle",
                "selectColorCombination",
            ],
            registerWidgetId: (widgetId) => {
                this.widgetIds.push(widgetId);
            },
            notifyValueChange: this.notifyValueChange.bind(this),
        });
        // Because the widgets data are only loaded after the first render,
        // we have to delay the start method until after the first render.
        onWillUpdateProps(async (nextProps) => {
            if (
                nextProps.updateOptionsUIVisibilityCounter === 1 &&
                this.props.updateOptionsUIVisibilityCounter === 0
            ) {
                await this.start();
            }
            if (nextProps.updateOptionsUICounter > this.props.updateOptionsUICounter) {
                await this.updateUI();
            }
            if (
                nextProps.updateOptionsUIVisibilityCounter >
                this.props.updateOptionsUIVisibilityCounter
            ) {
                await this.updateUIVisibility();
            }
            // This is the first updateUI, after updating the UI we can now start the option.
            if (
                nextProps.updateOptionsUIVisibilityCounter === 1 &&
                this.props.updateOptionsUIVisibilityCounter === 0
            ) {
                this.env.mutex.exec(this.start.bind(this));
            }
            // Because renders can be flushed if a parent updates a second time,
            // ensure we actually call onFocus/onBlur only once.
            // These two method should be deprecated in favor of a useEffect
            // on the prop. Since it's only related to UI things and not target
            // it should be handled by OWL and not by the SnippetOption itself.
            if (nextProps.visible !== this.visible) {
                await (nextProps.visible && this.onFocus() || this.onBlur());
                this.visible = nextProps.visible;
            }
        });
    }
    get widgets() {
        return pick(this.env.widgetsData, ...this.widgetIds);
    }
    get $target() {
        return $(this.target);
    }
    setTarget(target) {
        this.target = target;
    }
    async notify(name, data) {
        if (name === "setTarget") {
            this.setTarget(data.target);
        }
    }
    /**
     * Shortcut to this.$target.find
     *
     * @param selector
     * @return {jQuery}
     */
    $(selector) {
        return this.$target.find(selector);
    }
    /**
     * Method called when the option is about to start.
     * It allows the modification of the target.
     */
    start() {}
    /**
     * Default option method which allows to select one and only one class in
     * the option classes set and set it on the associated snippet. The common
     * case is having a select with each item having a `data-select-class`
     * value allowing to choose the associated class, or simply an unique
     * checkbox to allow toggling a unique class.
     * @param {boolean|string} previewMode
     *        - truthy if the option is enabled for preview or if leaving it (in
     *          that second case, the value is 'reset')
     *        - false if the option should be activated for good
     * @param {string} widgetValue
     * @param {Object} params
     * @returns {Promise|undefined}
     */
    selectClass(previewMode, widgetValue, params) {
        for (const classNames of params.possibleValues) {
            if (classNames) {
                this.target.classList.remove(...classNames.trim().split(/\s+/g));
            }
        }
        if (widgetValue) {
            this.target.classList.add(...widgetValue.trim().split(/\s+/g));
        }
    }
    /**
     * Default option method which allows to select a value and set it on the
     * associated snippet as a data attribute. The name of the data attribute is
     * given by the attributeName parameter.
     *
     * @param {boolean} previewMode - @see selectClass
     * @param {string} widgetValue
     * @param {Object} params
     * @returns {Promise|undefined}
     */
    selectDataAttribute(previewMode, widgetValue, params) {
        const value = this.selectAttributeHelper(widgetValue, params);
        this.target.dataset[params.attributeName] = value;
    }
    selectStyle(previewMode, widgetValue, params) {
        // Disable all transitions for the duration of the method as many
        // comparisons will be done on the element to know if applying a
        // property has an effect or not. Also, changing a css property via the
        // editor should not show any transition as previews would not be done
        // immediately, which is not good for the user experience.
        this.target.classList.add("o_we_force_no_transition");
        const _restoreTransitions = () => this.target.classList.remove("o_we_force_no_transition");

        // Always reset the inline style first to not put inline style on an
        // element which already have this style through css stylesheets.
        let cssProps = weUtils.CSS_SHORTHANDS[params.cssProperty] || [params.cssProperty];
        for (const cssProp of cssProps) {
            this.target.style.setProperty(cssProp, "");
        }
        if (params.extraClass) {
            this.target.classList.remove(params.extraClass);
        }
        // Plain color and gradient are mutually exclusive as background so in
        // case we edit a background-color we also have to reset the gradient
        // part of the background-image property (the opposite is handled by the
        // fact that editing a gradient as background is done by calling this
        // method with background-color as property too, so it is automatically
        // reset anyway).
        let bgImageParts = undefined;
        if (params.withGradients && params.cssProperty === "background-color") {
            const styles = getComputedStyle(this.target);
            bgImageParts = weUtils.backgroundImageCssToParts(styles["background-image"]);
            delete bgImageParts.gradient;
            const combined = weUtils.backgroundImagePartsToCss(bgImageParts);
            this.target.style.setProperty("background-image", "");
            applyCSS.call(this, "background-image", combined, styles);
        }

        // Only allow to use a color name as a className if we know about the
        // other potential color names (to remove) and if we know about a prefix
        // (otherwise we suppose that we should use the actual related color).
        // Note: color combinations classes are handled by a dedicated method,
        // as they can be combined with normal classes.
        if (params.colorNames && params.colorPrefix) {
            const colorNames = params.colorNames.filter(
                (name) => !weUtils.isColorCombinationName(name)
            );
            const classes = weUtils.computeColorClasses(colorNames, params.colorPrefix);
            this.target.classList.remove(...classes);

            if (colorNames.includes(widgetValue)) {
                const originalCSSValue = window.getComputedStyle(this.target)[cssProps[0]];
                const className = params.colorPrefix + widgetValue;
                this.target.classList.add(className);
                if (originalCSSValue !== window.getComputedStyle(this.target)[cssProps[0]]) {
                    // If applying the class did indeed changed the css
                    // property we are editing, nothing more has to be done.
                    // (except adding the extra class)
                    this.target.classList.add(params.extraClass);
                    _restoreTransitions();
                    return;
                }
                // Otherwise, it means that class probably does not exist,
                // we remove it and continue. Especially useful for some
                // prefixes which only work with some color names but not all.
                this.target.classList.remove(className);
            }
        }

        const styles = window.getComputedStyle(this.target);

        // At this point, the widget value is either a property/color name or
        // an actual css property value. If it is a property/color name, we will
        // apply a css variable as style value.
        const htmlPropValue = weUtils.getCSSVariableValue(widgetValue);
        if (htmlPropValue) {
            widgetValue = `var(--${widgetValue})`;
        }

        // In case of background-color edition, we could receive a gradient, in
        // which case the value has to be combined with the potential background
        // image (real image).
        if (
            params.withGradients &&
            params.cssProperty === "background-color" &&
            weUtils.isColorGradient(widgetValue)
        ) {
            cssProps = ["background-image"];
            bgImageParts.gradient = widgetValue;
            widgetValue = weUtils.backgroundImagePartsToCss(bgImageParts);

            // Also force the background-color to transparent as otherwise it
            // won't act as a "gradient replacing the color combination
            // background" but be applied over it (which would be the opposite
            // of what happens when editing the background color).
            applyCSS.call(this, "background-color", "rgba(0, 0, 0, 0)", styles);
        }

        // replacing ', ' by ',' to prevent attributes with internal space separators from being split:
        // eg: "rgba(55, 12, 47, 1.9) 47px" should be split as ["rgba(55,12,47,1.9)", "47px"]
        const values = widgetValue.replace(/,\s/g, ",").split(/\s+/g);
        while (values.length < cssProps.length) {
            switch (values.length) {
                case 1:
                case 2: {
                    values.push(values[0]);
                    break;
                }
                case 3: {
                    values.push(values[1]);
                    break;
                }
                default: {
                    values.push(values[values.length - 1]);
                }
            }
        }

        let hasUserValue = false;
        for (let i = cssProps.length - 1; i > 0; i--) {
            hasUserValue = applyCSS.call(this, cssProps[i], values.pop(), styles) || hasUserValue;
        }
        hasUserValue = applyCSS.call(this, cssProps[0], values.join(" "), styles) || hasUserValue;

        function applyCSS(cssProp, cssValue, styles) {
            if (typeof params.forceStyle !== "undefined") {
                this.target.style.setProperty(cssProp, cssValue, params.forceStyle);
                return true;
            }

            // This condition requires extraClass to NOT be set.
            if (
                !weUtils.areCssValuesEqual(
                    styles.getPropertyValue(cssProp),
                    cssValue,
                    cssProp,
                    this.target
                )
            ) {
                // Property must be set => extraClass will be enabled.
                if (params.extraClass) {
                    // The extraClass is temporarily removed during selectStyle
                    // because it is enabled only if the element style is set
                    // by the option. (E.g. add the bootstrap border class only
                    // if there is a border width.) Unfortunately the
                    // extraClass might specify default !important properties,
                    // therefore determining whether !important is needed
                    // requires the class to be applied.
                    this.target.classList.add(params.extraClass);
                    // Set inline style only if different from value defined
                    // with extraClass.
                    if (
                        !weUtils.areCssValuesEqual(
                            styles.getPropertyValue(cssProp),
                            cssValue,
                            cssProp,
                            this.target
                        )
                    ) {
                        this.target.style.setProperty(cssProp, cssValue);
                    }
                } else {
                    // Inline style required.
                    this.target.style.setProperty(cssProp, cssValue);
                }
                // If change had no effect then make it important.
                // This condition requires extraClass to be set.
                if (
                    !params.preventImportant &&
                    !weUtils.areCssValuesEqual(
                        styles.getPropertyValue(cssProp),
                        cssValue,
                        cssProp,
                        this.target
                    )
                ) {
                    this.target.style.setProperty(cssProp, cssValue, "important");
                }
                if (params.extraClass) {
                   this.target.classList.remove(params.extraClass);
                }
                return true;
            }
            return false;
        }

        if (params.extraClass) {
            this.target.classList.toggle(params.extraClass, hasUserValue);
        }

        _restoreTransitions();
    }
    /**
     * Sets a color combination.
     *
     * @see this.selectClass for parameters
     */
    async selectColorCombination(previewMode, widgetValue, params) {
        if (params.colorNames) {
            const names = params.colorNames.filter(weUtils.isColorCombinationName);
            const classes = weUtils.computeColorClasses(names);
            this.target.classList.remove(...classes);

            if (widgetValue) {
                this.target.classList.add("o_cc", `o_cc${widgetValue}`);
            }
        }
    }
    /**
     * Used to handle attribute or data attribute value change
     *
     * @see selectValueHelper for parameters
     */
    selectAttributeHelper(value, params) {
        if (!params.attributeName) {
            throw new Error("Attribute name missing");
        }
        return this.selectValueHelper(value, params);
    }
    /**
     * Used to handle value of a select
     *
     * @param {string} value
     * @param {Object} params
     * @returns {string|undefined}
     */
    selectValueHelper(value, params) {
        if (params.saveUnit && !params.withUnit) {
            // Values that come with a unit are saved without unit as
            // data-attribute unless told otherwise.
            value = value.split(params.saveUnit).join("");
        }
        if (params.extraClass) {
            this.target.classList.toggle(params.extraClass, params.defaultValue !== value);
        }
        return value;
    }
    async notifyValueChange(values, previewMode, widgetID, params) {
        // First check if the updated widget or any of the widgets it triggers
        // will require a reload or a confirmation choice by the user. If it is
        // the case, warn the user and potentially ask if he agrees to save its
        // current changes. If not, just do nothing.
        const widget = this.env.widgetsData[widgetID];
        let requiresReload = false;
        if (!previewMode) {
            const linkedWidgets = this.requestUserValueWidgets(...widget.triggerWidgetsNames);
            const widgets = [widget].concat(linkedWidgets);

            const warnMessage = await this._checkIfWidgetsUpdateNeedWarning(widgets);
            if (warnMessage) {
                const okWarning = await new Promise(resolve => {
                    this.dialogService.add(ConfirmationDialog, {
                        body: warnMessage,
                        confirm: () => resolve(true),
                        cancel: () => resolve(false),
                    });
                });
                if (!okWarning) {
                    return;
                }
            }
            requiresReload = !!await this._checkIfWidgetsUpdateNeedReload(widgets);
        }
        // Queue action so that we can later skip useless actions.
        if (!this.actionQueues.get(widget)) {
            this.actionQueues.set(widget, []);
        }
        const currentAction = {previewMode};
        this.actionQueues.get(widget).push(currentAction);

        this.env.snippetEditionRequest(async () => {
            const widget = this.env.widgetsData[widgetID];
            // Filter actions that are counterbalanced by earlier/later actions
            const actionQueue = this.actionQueues.get(widget).filter(({previewMode}, i, actions) => {
                const prev = actions[i - 1];
                const next = actions[i + 1];
                if (previewMode === true && next && next.previewMode) {
                    return false;
                } else if (previewMode === 'reset' && prev && prev.previewMode) {
                    return false;
                }
                return true;
            });
            // Skip action if it's been counterbalanced
            if (!actionQueue.includes(currentAction)) {
                this.actionQueues.set(widget, actionQueue);
                return;
            }
            this.actionQueues.set(widget, actionQueue.filter(action => action !== currentAction));
            await this.select(values, previewMode, widget, params);
            if (!previewMode) {
                this.props.optionUpdate();
            }
        });
    }
    /**
     * Activates the option associated to the given DOM element.
     *
     * @private
     * @param {Object} values - Contains the values per key, where the key is
     *                          the method name.
     * @param {boolean|string} previewMode
     *        - truthy if the option is enabled for preview or if leaving it (in
     *          that second case, the value is 'reset')
     *        - false if the option should be activated for good
     * @param {Object} widget - the widget which triggered the option change
     * @returns {Promise}
     */
    async select(values, previewMode, widget, params) {
        if (previewMode === true) {
            this.env.odooEditor.automaticStepUnactive("preview_option");
        }

        for (const method in values) {
            const possibleValues = widget.possibleValues[method];
            const extraParams = widget.params;
            let obj = this;
            if (widget.params.applyTo) {
                const $firstSubTarget = this.$(widget.params.applyTo).eq(0);
                if (!$firstSubTarget.length) {
                    continue;
                }
                obj = createPropertyProxy(this, 'target', $firstSubTarget[0]);
            }
            const activeValue = params.activeValues?.[method];
            if (!this[method]) {
                throw new Error(_t("The Snippet Option does not have the method %s", method));
            }
            await this[method].call(obj, previewMode, values[method], {
                possibleValues,
                activeValue,
                name: widget.name,
                ...extraParams,
            });
        }
        this.props.updateOverlay();
        if (previewMode === "reset" || previewMode === false) {
            this.env.odooEditor.automaticStepActive("preview_option");
        }
    }
    async updateUI() {
        const proms = [];

        for (const widget of Object.values(this.widgets)) {
            let container = null;
            if (widget.containerID) {
                container = this.widgets[widget.containerID];
            }
            let obj = this;
            if (widget.preview === true || (container && container.preview === true)) {
                // Do not update widgets that are in preview mode.
                continue;
            }
            if (widget.params.applyTo) {
                const $firstSubTarget = this.$(widget.params.applyTo).eq(0);
                if (!$firstSubTarget.length) {
                    continue;
                }
                obj = createPropertyProxy(this, 'target', $firstSubTarget[0]);
            }
            for (const method of widget.methodNames) {
                const state = await this.computeWidgetState.call(obj, method, {
                    possibleValues: widget.possibleValues[method],
                    ...widget.params,
                });
                widget.optionValues.set(method, state);
            }
        }
        await Promise.all(proms);
    }
    async updateUIVisibility() {
        const widgets = Object.values(this.widgets);
        const proms = widgets.map(async (widget) => {
            const params = widget.params;

            // Make sure to check the visibility of all sub-widgets. For
            // simplicity and efficiency, those will be checked with main
            // widgets params.
            const allSubWidgets = [widget];
            let i = 0;
            while (i < allSubWidgets.length) {
                if (allSubWidgets[i].container) {
                    allSubWidgets.push(...allSubWidgets[i].subWidgets);
                }
                i++;
            }
            const proms = allSubWidgets.map(async (widget) => {
                const show = await this.computeWidgetVisibility(widget.name || "", {
                    ...params,
                    possibleValues: widget.possibleValues,
                });
                if (!show) {
                    widget.toggleVisibility(false);
                    return;
                }

                const dependencies = widget.dependencies || [];

                if (dependencies.length === 1 && dependencies[0] === "fake") {
                    widget.toggleVisibility(false);
                    return;
                }

                const dependenciesData = [];
                dependencies.forEach((depName) => {
                    const toBeActive = depName[0] !== "!";
                    if (!toBeActive) {
                        depName = depName.substring(1);
                    }

                    const widget = this.requestUserValueWidgets(depName, true)[0];
                    if (widget) {
                        dependenciesData.push({
                            widget: widget,
                            toBeActive: toBeActive,
                        });
                    }
                });
                const dependenciesOK =
                    !dependenciesData.length ||
                    dependenciesData.some((depData) => {
                        return depData.widget.isActive() === depData.toBeActive;
                    });

                widget.toggleVisibility(dependenciesOK);
            });
            return Promise.all(proms);
        });

        await Promise.all(proms);
        // TODO: Hide layouting elements. should be ok with parented visibility.
    }

    /**
     * Callbacks used by widgets to notify an option of their visibility
     *
     * @param widgetId
     * @param active
     */
    updateOptionVisibility(widgetId, active) {
        this.widgetsVisibility[widgetId] = active;
    }
    /**
     * Returns the string value that should be hold by the widget which is
     * related to the given method name.
     *
     * If the value is irrelevant for a method, it must return undefined.
     *
     * @protected
     * @param {string} methodName
     * @param {Object} params
     * @returns {Promise<string|undefined>|string|undefined}
     */
    computeWidgetState(methodName, params) {
        switch (methodName) {
            case "selectClass": {
                let maxNbClasses = 0;
                let activeClassNames = "";
                for (const classNames of params.possibleValues) {
                    if (!classNames) {
                        continue;
                    }
                    const classes = classNames.split(/\s+/g);
                    if (params.stateToFirstClass) {
                        if (this.target.classList.contains(classes[0])) {
                            return classNames;
                        } else {
                            continue;
                        }
                    }

                    if (
                        classes.length >= maxNbClasses &&
                        classes.every((className) => this.target.classList.contains(className))
                    ) {
                        maxNbClasses = classes.length;
                        activeClassNames = classNames;
                    }
                }
                return activeClassNames;
            }
            case "selectAttribute":
            case "selectDataAttribute": {
                const attrName = params.attributeName;
                let attrValue;
                if (methodName === "selectAttribute") {
                    attrValue = this.target.getAttribute(attrName);
                } else if (methodName === "selectDataAttribute") {
                    attrValue = this.target.dataset[attrName];
                }
                attrValue = (attrValue || "").trim();
                if (params.saveUnit && !params.withUnit) {
                    attrValue = attrValue
                        .split(/\s+/g)
                        .map((v) => v + params.saveUnit)
                        .join(" ");
                }
                return attrValue || params.attributeDefaultValue || "";
            }
            case "selectStyle": {
                let usedCC = undefined;
                if (params.colorPrefix && params.colorNames) {
                    for (const c of params.colorNames) {
                        const className = weUtils.computeColorClasses([c], params.colorPrefix)[0];
                        if (this.target.classList.contains(className)) {
                            if (weUtils.isColorCombinationName(c)) {
                                usedCC = c;
                                continue;
                            }
                            return c;
                        }
                    }
                }

                // Disable all transitions for the duration of the style check
                // as we want to know the final value of a property to properly
                // update the UI.
                this.target.classList.add("o_we_force_no_transition");
                const _restoreTransitions = () =>
                    this.target.classList.remove("o_we_force_no_transition");

                const styles = window.getComputedStyle(this.target);

                if (params.withGradients && params.cssProperty === "background-color") {
                    // Check if there is a gradient, in that case this is the
                    // value to be returned, we normally not allow color and
                    // gradient at the same time (the option would remove one
                    // if editing the other).
                    const parts = weUtils.backgroundImageCssToParts(styles["background-image"]);
                    if (parts.gradient) {
                        _restoreTransitions();
                        return parts.gradient;
                    }
                }

                const cssProps = weUtils.CSS_SHORTHANDS[params.cssProperty] || [params.cssProperty];
                const borderWidthCssProps = weUtils.CSS_SHORTHANDS["border-width"];
                const cssValues = cssProps.map((cssProp) => {
                    let value = styles.getPropertyValue(cssProp).trim();
                    if (cssProp === "box-shadow") {
                        const inset = value.includes("inset");
                        let values = value
                            .replace(/,\s/g, ",")
                            .replace("inset", "")
                            .trim()
                            .split(/\s+/g);
                        const color = values.find((s) => !s.match(/^\d/));
                        values = values.join(" ").replace(color, "").trim();
                        value = `${color} ${values}${inset ? " inset" : ""}`;
                    }
                    if (borderWidthCssProps.includes(cssProp) && value.endsWith("px")) {
                        // Rounding value up avoids zoom-in issues.
                        // Zoom-out issues are not an expected use case.
                        value = `${Math.ceil(parseFloat(value))}px`;
                    }
                    return value;
                });
                // TODO: check if target is really needed.
                if (
                    cssValues.length === 4 &&
                    weUtils.areCssValuesEqual(
                        cssValues[3],
                        cssValues[1],
                        params.cssProperty,
                        this.$target
                    )
                ) {
                    cssValues.pop();
                }
                if (
                    cssValues.length === 3 &&
                    weUtils.areCssValuesEqual(
                        cssValues[2],
                        cssValues[0],
                        params.cssProperty,
                        this.$target
                    )
                ) {
                    cssValues.pop();
                }
                if (
                    cssValues.length === 2 &&
                    weUtils.areCssValuesEqual(
                        cssValues[1],
                        cssValues[0],
                        params.cssProperty,
                        this.$target
                    )
                ) {
                    cssValues.pop();
                }

                _restoreTransitions();

                const value = cssValues.join(" ");

                if (params.cssProperty === "background-color" && params.withCombinations) {
                    if (usedCC) {
                        const ccValue = weUtils.getCSSVariableValue(`o-cc${usedCC}-bg`).trim();
                        if (weUtils.areCssValuesEqual(value, ccValue)) {
                            // Prevent to consider that a color is used as CC
                            // override in case that color is the same as the
                            // one used in that CC.
                            return "";
                        }
                    } else {
                        const rgba = convertCSSColorToRgba(value);
                        if (rgba && rgba.opacity < 0.001) {
                            // Prevent to consider a transparent color is
                            // applied as background unless it is to override a
                            // CC. Simply allows to add a CC on a transparent
                            // snippet in the first place.
                            return "";
                        }
                    }
                }

                return value;
            }
            case "selectColorCombination": {
                if (params.colorNames) {
                    for (const c of params.colorNames) {
                        if (!weUtils.isColorCombinationName(c)) {
                            continue;
                        }
                        const className = weUtils.computeColorClasses([c])[0];
                        if (this.target.classList.contains(className)) {
                            return c;
                        }
                    }
                }
                return "";
            }
        }
    }
    /**
     * @private
     * @param {string} widgetName
     * @param {Object} params
     * @returns {Promise<boolean>|boolean}
     */
    async computeWidgetVisibility(widgetName, params) {
        const moveUpOrLeft = widgetName === "move_up_opt" || widgetName === "move_left_opt";
        const moveDownOrRight = widgetName === "move_down_opt" || widgetName === "move_right_opt";

        if (moveUpOrLeft || moveDownOrRight) {
            // The arrows are not displayed if the target is in a grid and if
            // not in mobile view.
            const mobileViewThreshold = MEDIAS_BREAKPOINTS[SIZES.LG].minWidth;
            const isMobileView =
                this.target.ownerDocument.defaultView.frameElement.clientWidth < mobileViewThreshold;
            if (this.target.classList.contains("o_grid_item") && !isMobileView) {
                return false;
            }
            const firstOrLastChild = moveUpOrLeft ? ":first-child" : ":last-child";
            return !this.$target.is(firstOrLastChild);
        }
        return true;
    }
    /**
     * Called when the parent edition overlay is covering the associated snippet
     * (the first time, this follows the call to the @see start method).
     *
     * @returns {Promise|undefined}
     */
    async onFocus() {}
    /**
     * Called when the parent edition overlay is covering the associated snippet
     * for the first time, when it is a new snippet dropped from the d&d snippet
     * menu. Note: this is called after the start and onFocus methods.
     *
     * @returns {Promise|undefined}
     */
    async onBuilt() {}
    /**
     * Called when the parent edition overlay is removed from the associated
     * snippet (another snippet enters edition for example).
     *
     * @returns {Promise|undefined}
     */
    async onBlur() {}
    /**
     * Called when the associated snippet is the result of the cloning of
     * another snippet (so `this.$target` is a cloned element).
     *
     * @param {boolean} options.isCurrent
     *        true if the associated snippet is a clone of the main element that
     *        was cloned (so not a clone of a child of this main element that
     *        was cloned)
     */
    onClone(options) {}
    /**
     * Called when the associated snippet is moved to another DOM location.
     */
    onMove() {}
    /**
     * Called when the associated snippet is about to be removed from the DOM.
     *
     * @returns {Promise|undefined}
     */
    async onRemove() {}
    /**
     * Called when the target is shown, only meaningful if the target was hidden
     * at some point (typically used for 'invisible' snippets).
     *
     * @returns {Promise|undefined}
     */
    async onTargetShow() {}
    /**
     * Called when the target is hidden (typically used for 'invisible'
     * snippets).
     *
     * @returns {Promise|undefined}
     */
    async onTargetHide() {}
    /**
     * Called when the template which contains the associated snippet is about
     * to be saved.
     *
     * @return {Promise|undefined}
     */
    async cleanForSave() {}
    /**
     * @private
     * @param {...string} widgetNames
     * @param {boolean} [allowParentOption=false]
     * @returns {UserValueWidget[]}
     */
    requestUserValueWidgets(...args) {
        const widgetNames = args;
        let allowParentOption = false;
        const lastArg = args[args.length - 1];
        if (typeof lastArg === "boolean") {
            widgetNames.pop();
            allowParentOption = lastArg;
        }

        const widgets = [];
        for (const widgetName of widgetNames) {
            const widget = this.props.requestUserValueWidget(widgetName, allowParentOption);
            if (widget) {
                widgets.push(widget);
            }
        }
        return widgets;
    }
    /**
     * @private
     * @param {UserValueWidget[]} widgets
     * @returns {Promise<string>}
     */
    async _checkIfWidgetsUpdateNeedWarning(widgets) {
        const messages = [];
        for (const widget of widgets) {
            const message = widget.params.warnMessage;
            if (message) {
                messages.push(message);
            }
        }
        return messages.join(' ');
    }
    /**
     * @private
     * @param {UserValueWidget[]} widgets
     * @returns {Promise<boolean|string>}
     */
    async _checkIfWidgetsUpdateNeedReload(widgets) {
        return false;
    }
}

export class Sizing extends SnippetOption {
    static displayOverlayOptions = true;

    setup() {
        super.setup();
        this.$overlay = $(this.props.overlayEl);
        this.$handles = this.$overlay.find(".o_handle");
    }

    //--------------------------------------------------------------------------
    // SnippetOption overrides
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    async start() {
        const self = this;
        const def = super.start(...arguments);

        let resizeValues = this.getSize();
        this.$handles.on("mousedown", function (ev) {
            ev.preventDefault();
            self.env.odooEditor.automaticStepUnactive("resizing");

            // If the handle has the class 'readonly', don't allow to resize.
            // (For the grid handles when we are in mobile view).
            if (ev.currentTarget.classList.contains("readonly")) {
                return;
            }

            // First update size values as some element sizes may not have been
            // initialized on option start (hidden slides, etc)
            resizeValues = self.getSize();
            const handleEl = ev.currentTarget;

            const dirClasses = ["n", "s", "e", "w", "nw", "ne", "sw", "se"];
            const compass = [...handleEl.classList].find(c => dirClasses.includes(c));
            let XY = "";
            if (compass.includes("n") || compass.includes("s")) {
                XY += "Y";
            }
            if (compass.includes("e") || compass.includes("w")) {
                XY += "X";
            }

            // Don't call the normal resize methods if we are in a grid and
            // vice-versa.
            const isGrid = Object.keys(resizeValues).length === 4;
            const isGridHandle = handleEl.classList.contains("o_grid_handle");
            if (isGrid && !isGridHandle || !isGrid && isGridHandle) {
                return;
            }

            let resizeVal;
            if (compass.length > 1) {
                resizeVal = [resizeValues[compass[0]], resizeValues[compass[1]]];
            } else {
                resizeVal = [resizeValues[compass]];
            }

            if (resizeVal.some(rV => !rV)) {
                return;
            }

            // If we are in grid mode, add a background grid and place it in
            // front of the other elements.
            const rowEl = self.target.parentNode;
            let backgroundGridEl;
            if (rowEl.classList.contains("o_grid_mode")) {
                self.env.odooEditor.observerUnactive("displayBackgroundGrid");
                backgroundGridEl = gridUtils._addBackgroundGrid(rowEl, 0);
                self.env.odooEditor.observerActive("displayBackgroundGrid");
                gridUtils._setElementToMaxZindex(backgroundGridEl, rowEl);
            }

            // For loop to handle the cases where it is ne, nw, se or sw. Since
            // there are two directions, we compute for both directions and we
            // store the values in an array.
            const directions = [];
            for (const [i, resize] of resizeVal.entries()) {
                const props = {};
                let current = 0;
                const cssProperty = resize[2];
                const cssPropertyValue = parseInt(self.$target.css(cssProperty));
                resize[0].forEach((val, key) => {
                    if (self.target.classList.contains(val)) {
                        current = key;
                    } else if (resize[1][key] === cssPropertyValue) {
                        current = key;
                    }
                });

                props.resize = resize;
                props.current = current;
                props.begin = current;
                props.beginClass = self.target.className;
                props.regClass = new RegExp("\\s*" + resize[0][current].replace(/[-]*[0-9]+/, "[-]*[0-9]+"), "g");
                props.xy = ev["page" + XY[i]];
                props.XY = XY[i];
                props.compass = compass[i];

                directions.push(props);
            }

            const cursor = $(handleEl).css("cursor") + "-important";
            const $body = $(this.ownerDocument.body);
            $body.addClass(cursor);

            const bodyMouseMove = function (ev) {
                ev.preventDefault();

                let changeTotal = false;
                for (const dir of directions) {
                    // dd is the number of pixels by which the mouse moved,
                    // compared to the initial position of the handle.
                    const dd = ev["page" + dir.XY] - dir.xy + dir.resize[1][dir.begin];
                    const next = dir.current + (dir.current + 1 === dir.resize[1].length ? 0 : 1);
                    const prev = dir.current ? (dir.current - 1) : 0;

                    let change = false;
                    // If the mouse moved to the right/down by at least 2/3 of
                    // the space between the previous and the next steps, the
                    // handle is snapped to the next step and the class is
                    // replaced by the one matching this step.
                    if (dd > (2 * dir.resize[1][next] + dir.resize[1][dir.current]) / 3) {
                        self.target.className = self.target.className.replace(dir.regClass, "");
                        self.target.classList.add(dir.resize[0][next]);
                        dir.current = next;
                        change = true;
                    }
                    // Same as above but to the left/up.
                    if (prev !== dir.current && dd < (2 * dir.resize[1][prev] + dir.resize[1][dir.current]) / 3) {
                        self.target.className = self.target.className.replace(dir.regClass, "")
                        self.target.classList.add(dir.resize[0][prev]);
                        dir.current = prev;
                        change = true;
                    }

                    if (change) {
                        self.onResize(dir.compass, dir.beginClass, dir.current);
                    }

                    changeTotal = changeTotal || change;
                }

                if (changeTotal) {
                    self.props.updateOverlay();
                    handleEl.classList.add("o_active");
                }
            };
            const bodyMouseUp = function () {
                $body.off("mousemove", bodyMouseMove);
                $body.off("mouseup", bodyMouseUp);
                $body.removeClass(cursor);
                handleEl.classList.remove("o_active");

                // If we are in grid mode, removes the background grid.
                // Also sync the col-* class with the g-col-* class so the
                // toggle to normal mode and the mobile view are well done.
                if (rowEl.classList.contains("o_grid_mode")) {
                    self.env.odooEditor.observerUnactive("displayBackgroundGrid");
                    backgroundGridEl.remove();
                    self.env.odooEditor.observerActive("displayBackgroundGrid");
                    gridUtils._resizeGrid(rowEl);

                    const colClass = [...self.target.classList].find(c => /^col-/.test(c));
                    const gColClass = [...self.target.classList].find(c => /^g-col-/.test(c));
                    self.target.classList.remove(colClass);
                    self.target.classList.add(gColClass.substring(2));
                }

                // Highlights the previews for a while
                self.$handles.addClass("o_active").delay(300).queue(function () {
                    self.$handles.removeClass("o_active").dequeue();
                });

                if (directions.every(dir => dir.begin === dir.current)) {
                    return;
                }

                setTimeout(function () {
                    self.env.odooEditor.historyStep();
                }, 0);

                self.env.odooEditor.automaticStepActive("resizing");
            };
            $body.on("mousemove", bodyMouseMove);
            $body.on("mouseup", bodyMouseUp);
        });

        for (const [key, value] of Object.entries(resizeValues)) {
            this.$handles.filter("." + key).toggleClass("readonly", !value);
        }
        if (this.target.classList.contains("o_grid_item")) {
            this.$handles.filter(".o_grid_handle").toggleClass("readonly", false);
        }

        return def;
    }

    /**
     * @override
     */
    async updateUI() {
        this.updateSizingHandles();
        await super.updateUI(...arguments);
    }
    /**
     * @override
     */
    setTarget() {
        // TODO: Is this still needed? -> doesn't seem to be called
        super.setTarget(...arguments);
        // TODO master: onResize should not be called here, need to check if
        // updateUI is called when the target is changed
        this.onResize();
    }
    /**
     * @override
     */
    async updateUIVisibility() {
        await super.updateUIVisibility(...arguments);

        const mobileViewThreshold = MEDIAS_BREAKPOINTS[SIZES.LG].minWidth;
        const isMobileView = this.target.ownerDocument.defaultView.frameElement.clientWidth < mobileViewThreshold;
        const isGrid = this.target.classList.contains("o_grid_item");
        if (this.target.parentNode && this.target.parentNode.classList.contains("row")) {
            // Hiding/showing the correct resize handles if we are in grid mode
            // or not.
            for (const handleEl of this.$handles) {
                const isGridHandle = handleEl.classList.contains("o_grid_handle");
                handleEl.classList.toggle("d-none", isGrid ^ isGridHandle);
                // Disabling the resize if we are in mobile view.
                const isHorizontalSizing = handleEl.matches(".e, .w");
                handleEl.classList.toggle("readonly", isMobileView && (isHorizontalSizing || isGridHandle));
            }

            // Hiding the move handle in mobile view so we can't drag the
            // columns.
            const moveHandleEl = this.$overlay[0].querySelector(".o_move_handle");
            moveHandleEl.classList.toggle("d-none", isMobileView);

            // Hiding/showing the arrows.
            if (isGrid) {
                const moveLeftArrowEl = this.$overlay[0].querySelector(".fa-angle-left");
                const moveRightArrowEl = this.$overlay[0].querySelector(".fa-angle-right");
                const showLeft = await this.computeWidgetVisibility("move_left_opt");
                const showRight = await this.computeWidgetVisibility("move_right_opt");
                moveLeftArrowEl.classList.toggle("d-none", !showLeft);
                moveRightArrowEl.classList.toggle("d-none", !showRight);
            }

            // Show/hide the buttons to send back/front a grid item.
            const bringFrontBackEls = this.$overlay[0].querySelectorAll(".o_front_back");
            bringFrontBackEls.forEach(button => button.classList.toggle("d-none", !isGrid || isMobileView));
        }
    }

    //--------------------------------------------------------------------------
    // Option specific
    //--------------------------------------------------------------------------

    /**
     * Returns an object mapping one or several cardinal direction (n, e, s, w)
     * to an Array containing:
     * 1) A list of classes to toggle when using this cardinal direction
     * 2) A list of values these classes are supposed to set on a given CSS prop
     * 3) The mentioned CSS prop
     *
     * Note: this object must also be saved in this.grid before being returned.
     *
     * @abstract
     * @private
     * @returns {Object}
     */
    getSize() {}
    /**
     * Called when the snippet is being resized and its classes changes.
     *
     * @private
     * @param {string} [compass] - resize direction ('n', 's', 'e' or 'w')
     * @param {string} [beginClass] - attributes class at the beginning
     * @param {integer} [current] - current increment in this.grid
     */
    onResize(compass, beginClass, current) {
        this.updateSizingHandles();
        this.notifyResizeChange();
    }
    /**
     * @private
     */
    updateSizingHandles() {
        // Adapt the resize handles according to the classes and dimensions
        const resizeValues = this.getSize();
        for (const [direction, resizeValue] of Object.entries(resizeValues)) {
            const classes = resizeValue[0];
            const values = resizeValue[1];
            const cssProperty = resizeValue[2];

            const $handle = this.$handles.filter("." + direction);

            let current = 0;
            const cssPropertyValue = parseInt(this.$target.css(cssProperty));
            classes.forEach((className, key) => {
                if (this.target.classList.contains(className)) {
                    current = key;
                } else if (values[key] === cssPropertyValue) {
                    current = key;
                }
            });

            $handle.toggleClass("o_handle_start", current === 0);
            $handle.toggleClass("o_handle_end", current === classes.length - 1);
        }

        // Adapt the handles to fit the left, top and bottom sizes
        const ml = this.$target.css("margin-left");
        this.$overlay.find(".o_handle.w").css({
            width: ml,
            left: "-" + ml,
        });
        this.$overlay.find(".o_handle.e").css({
            width: 0,
        });
        this.$overlay.find(".o_handle.n, .o_handle.s").toArray().forEach((handleEl) => {
            const direction = handleEl.classList.contains("n") ? "top" : "bottom";
            handleEl.style.height = this.$target.css("padding-" + direction);
        });
    }
    /**
     * @override
     */
    notifyResizeChange() {
        this.env.odooEditor.dispatchEvent(new Event("contentChanged"));
    }
}

/**
 * Handles the edition of padding-top and padding-bottom.
 */
export class SizingY extends Sizing {
    /**
     * @override
     */
    getSize() {
        let nClass = "pt";
        let nProp = "padding-top";
        let sClass = "pb";
        let sProp = "padding-bottom";
        if (this.$target.is("hr")) { // TODO can surely be removed.
            nClass = "mt";
            nProp = "margin-top";
            sClass = "mb";
            sProp = "margin-bottom";
        }

        const grid = [];
        for (let i = 0; i <= (256 / 8); i++) {
            grid.push(i * 8);
        }
        grid.splice(1, 0, 4);
        this.grid = {
            n: [grid.map(v => nClass + v), grid, nProp],
            s: [grid.map(v => sClass + v), grid, sProp],
        };
        return this.grid;
    }
}

export class SizingX extends Sizing {
    /**
     * @override
     */
    async onClone(options) {
        super.onClone(...arguments);
        // Below condition is added to remove offset of target element only
        // and not its children to avoid design alteration of a container/block.
        if (options.isCurrent) {
            this.target.className = this.target.className.replace(/\s*(offset-xl-|offset-lg-)([0-9-]+)/g, "");
        }
        await this.updateUI(); // Needed to be added as the overlay was not updated.
    }

    //--------------------------------------------------------------------------
    // Option specific
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    getSize() {
        const width = this.target.closest(".row").getBoundingClientRect().width;
        const gridE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        const gridW = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        this.grid = {
            e: [gridE.map(v => ("col-lg-" + v)), gridE.map(v => width / 12 * v), "width"],
            w: [gridW.map(v => ("offset-lg-" + v)), gridW.map(v => width / 12 * v), "margin-left"],
        };
        return this.grid;
    }
    /**
     * @override
     */
    onResize(compass, beginClass, current) {
        if (compass === "w" || compass === "e") {
            const beginOffset = Number(beginClass.match(/offset-lg-([0-9-]+)|$/)[1] || beginClass.match(/offset-xl-([0-9-]+)|$/)[1] || 0);

            if (compass === "w") {
                // don't change the right border position when we change the offset (replace col size)
                const beginCol = Number(beginClass.match(/col-lg-([0-9]+)|$/)[1] || 0);
                let offset = Number(this.grid.w[0][current].match(/offset-lg-([0-9-]+)|$/)[1] || 0);
                if (offset < 0) {
                    offset = 0;
                }
                let colSize = beginCol - (offset - beginOffset);
                if (colSize <= 0) {
                    colSize = 1;
                    offset = beginOffset + beginCol - 1;
                }
                this.target.className = this.target.className.replace(/\s*(offset-xl-|offset-lg-|col-lg-)([0-9-]+)/g, "");

                this.target.classList.add("col-lg-" + (colSize > 12 ? 12 : colSize));
                if (offset > 0) {
                    this.target.classList.add("offset-lg-" + offset);
                }
            } else if (beginOffset > 0) {
                const endCol = Number(this.grid.e[0][current].match(/col-lg-([0-9]+)|$/)[1] || 0);
                // Avoids overflowing the grid to the right if the
                // column size + the offset exceeds 12.
                if ((endCol + beginOffset) > 12) {
                    this.target.className = this.target.className.replace(/\s*(col-lg-)([0-9-]+)/g, "");
                    this.target.classList.add("col-lg-" + (12 - beginOffset));
                }
            }
        }
        return super.onResize(...arguments);
    }
    /**
     * @override
     */
    async notifyResizeChange() {
        // TODO check if working when Steps options will be done.
        await this.props.notifyOptions("StepsConnector", {
            name: "change_column_size",
        });
        super.notifyResizeChange(...arguments);
    }
}

/**
 * Handles the sizing in grid mode: edition of grid-{column|row}-{start|end}.
 */
export class SizingGrid extends Sizing {
    /**
     * @override
     */
    getSize() {
        const rowEl = this.target.closest(".row");
        const gridProp = gridUtils._getGridProperties(rowEl);

        const rowStart = this.target.style.gridRowStart;
        const rowEnd = parseInt(this.target.style.gridRowEnd);
        const columnStart = this.target.style.gridColumnStart;
        const columnEnd = this.target.style.gridColumnEnd;

        const gridN = [];
        const gridS = [];
        for (let i = 1; i < rowEnd + 12; i++) {
            gridN.push(i);
            gridS.push(i + 1);
        }
        const gridW = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        const gridE = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

        this.grid = {
            n: [gridN.map(v => ("g-height-" + (rowEnd - v))), gridN.map(v => ((gridProp.rowSize + gridProp.rowGap) * (v - 1))), "grid-row-start"],
            s: [gridS.map(v => ("g-height-" + (v - rowStart))), gridS.map(v => ((gridProp.rowSize + gridProp.rowGap) * (v - 1))), "grid-row-end"],
            w: [gridW.map(v => ("g-col-lg-" + (columnEnd - v))), gridW.map(v => ((gridProp.columnSize + gridProp.columnGap) * (v - 1))), "grid-column-start"],
            e: [gridE.map(v => ("g-col-lg-" + (v - columnStart))), gridE.map(v => ((gridProp.columnSize + gridProp.columnGap) * (v - 1))), "grid-column-end"],
        };

        return this.grid;
    }
    /**
     * @override
     */
    onResize(compass, beginClass, current) {
        if (compass === "n") {
            const rowEnd = parseInt(this.target.style.gridRowEnd);
            if (current < 0) {
                this.target.style.gridRowStart = 1;
            } else if (current + 1 >= rowEnd) {
                this.target.style.gridRowStart = rowEnd - 1;
            } else {
                this.target.style.gridRowStart = current + 1;
            }
        } else if (compass === "s") {
            const rowStart = parseInt(this.target.style.gridRowStart);
            const rowEnd = parseInt(this.target.style.gridRowEnd);
            if (current + 2 <= rowStart) {
                this.target.style.gridRowEnd = rowStart + 1;
            } else {
                this.target.style.gridRowEnd = current + 2;
            }

            // Updating the grid height.
            const rowEl = this.target.parentNode;
            const rowCount = parseInt(rowEl.dataset.rowCount);
            const backgroundGridEl = rowEl.querySelector(".o_we_background_grid");
            const backgroundGridRowEnd = parseInt(backgroundGridEl.style.gridRowEnd);
            let rowMove = 0;
            if (this.target.style.gridRowEnd > rowEnd && this.target.style.gridRowEnd > rowCount + 1) {
                rowMove = this.target.style.gridRowEnd - rowEnd;
            } else if (this.target.style.gridRowEnd < rowEnd && this.target.style.gridRowEnd >= rowCount + 1) {
                rowMove = this.target.style.gridRowEnd - rowEnd;
            }
            backgroundGridEl.style.gridRowEnd = backgroundGridRowEnd + rowMove;
        } else if (compass === "w") {
            const columnEnd = parseInt(this.target.style.gridColumnEnd);
            if (current < 0) {
                this.target.style.gridColumnStart = 1;
            } else if (current + 1 >= columnEnd) {
                this.target.style.gridColumnStart = columnEnd - 1;
            } else {
                this.target.style.gridColumnStart = current + 1;
            }
        } else if (compass === "e") {
            const columnStart = parseInt(this.target.style.gridColumnStart);
            if (current + 2 > 13) {
                this.target.style.gridColumnEnd = 13;
            } else if (current + 2 <= columnStart) {
                this.target.style.gridColumnEnd = columnStart + 1;
            } else {
                this.target.style.gridColumnEnd = current + 2;
            }
        }

        if (compass === "n" || compass === "s") {
            const numberRows = this.target.style.gridRowEnd - this.target.style.gridRowStart;
            this.target.className = this.target.className.replace(/\s*(g-height-)([0-9-]+)/g, "");
            this.target.classList.add("g-height-" + numberRows);
        }

        if (compass === "w" || compass === "e") {
            const numberColumns = this.target.style.gridColumnEnd - this.target.style.gridColumnStart;
            this.target.className = this.target.className.replace(/\s*(g-col-lg-)([0-9-]+)/g, "");
            this.target.classList.add("g-col-lg-" + numberColumns);
        }
    }
}

/**
 * Controls box properties.
 */
export class Box extends SnippetOption {
    setup() {
        super.setup();
        this.env.validMethodNames.push("setShadow");
    }
    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * TODO this should be reviewed in master to avoid the need of using the
     * 'reset' previewMode and having to remember the previous box-shadow value.
     * We are forced to remember the previous box shadow before applying a new
     * one as the whole box-shadow value is handled by multiple widgets.
     *
     * @see this.selectClass for parameters
     */
    async setShadow(previewMode, widgetValue, params) {
        // Check if the currently configured shadow is not using the same shadow
        // mode, in which case nothing has to be done.
        const styles = window.getComputedStyle(this.target);
        const currentBoxShadow = styles["box-shadow"] || "none";
        const currentMode =
            currentBoxShadow === "none"
                ? ""
                : currentBoxShadow.includes("inset") ? "inset" : "outset";
        if (currentMode === widgetValue) {
            return;
        }

        if (previewMode === true) {
            this._prevBoxShadow = currentBoxShadow;
        }

        // Add/remove the shadow class
        this.target.classList.toggle(params.shadowClass, !!widgetValue);

        // Change the mode of the old box shadow. If no shadow was currently
        // set then get the shadow value that is supposed to be set according
        // to the shadow mode. Try to apply it via the selectStyle method so
        // that it is either ignored because the shadow class had its effect or
        // forced (to the shadow value or none) if toggling the class is not
        // enough (e.g. if the item has a default shadow coming from CSS rules,
        // removing the shadow class won't be enough to remove the shadow but in
        // most other cases it will).
        let shadow = "none";
        if (previewMode === "reset") {
            shadow = this._prevBoxShadow;
        } else {
            if (currentBoxShadow === 'none') {
                shadow = this._getDefaultShadow(widgetValue, params.shadowClass);
            } else {
                if (widgetValue === 'outset') {
                    shadow = currentBoxShadow.replace('inset', '').trim();
                } else if (widgetValue === 'inset') {
                    shadow = currentBoxShadow + ' inset';
                }
            }
        }
        await this.selectStyle(previewMode, shadow, Object.assign({cssProperty: 'box-shadow'}, params));
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    computeWidgetState(methodName, params) {
        if (methodName === "setShadow") {
            const targetStyle = this.target.ownerDocument.defaultView.getComputedStyle(this.target);
            const shadowValue = targetStyle.getPropertyValue("box-shadow");
            if (!shadowValue || shadowValue === "none") {
                return "";
            }
            return targetStyle.getPropertyValue("box-shadow").includes("inset")
                ? "inset"
                : "outset";
        }
        return super.computeWidgetState(...arguments);
    }
    /**
     * @override
     */
    async computeWidgetVisibility(widgetName, params) {
        if (widgetName === 'fake_inset_shadow_opt') {
            return false;
        }
        return super.computeWidgetVisibility(...arguments);
    }
    /**
     * @private
     * @param {string} type
     * @param {string} shadowClass
     * @returns {string}
     */
    _getDefaultShadow(type, shadowClass) {
        if (!type) {
            return 'none';
        }

        const el = document.createElement('div');
        el.classList.add(shadowClass);
        document.body.appendChild(el);
        const shadow = `${$(el).css('box-shadow')}${type === 'inset' ? ' inset' : ''}`;
        el.remove();
        return shadow;
    }
}

export class LayoutColumn extends SnippetOption {
    setup() {
        super.setup();
        this.env.validMethodNames.push("selectLayout", "addElement", "selectCount");
    }
    /**
     * @override
     */
    cleanForSave() {
        // Remove the padding highlights.
        this.target.querySelectorAll('.o_we_padding_highlight').forEach(highlightedEl => {
            highlightedEl._removePaddingPreview();
        });
    }

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Changes the number of columns.
     *
     * @see this.selectClass for parameters
     */
    async selectCount(previewMode, widgetValue, params) {
        const previousNbColumns = this.$target.find('> .row').children().length;
        let $row = this.$target.find('> .row');
        if (!$row.length) {
            const restoreCursor = preserveCursor(this.target.ownerDocument);
            for (const node of descendants(this.target)) {
                node.ouid = undefined;
            }
            $row = this.$target.contents().wrapAll($('<div class="row"><div class="col-lg-12"/></div>')).parent().parent();
            restoreCursor();
        }

        const nbColumns = parseInt(widgetValue);
        await this._updateColumnCount($row, (nbColumns || 1) - $row.children().length);
        // Yield UI thread to wait for event to bubble before activate_snippet is called.
        // In this case this lets the select handle the click event before we switch snippet.
        // TODO: make this more generic in activate_snippet event handler.
        // TODO: Check if still needed in owl.
        // await new Promise(resolve => setTimeout(resolve));
        if (nbColumns === 0) {
            const restoreCursor = preserveCursor(this.target.ownerDocument);
            for (const node of descendants($row[0])) {
                node.ouid = undefined;
            }
            $row.contents().unwrap().contents().unwrap();
            restoreCursor();
            this.env.activateSnippet(this.target);
        } else if (previousNbColumns === 0) {
            this.env.activateSnippet(this.target.querySelector(".row").children?.[0]);
        }
        // TODO: When notify is adapted.
        //this.trigger_up('option_update', {
        //    optionName: 'StepsConnector',
        //    name: 'change_columns',
        //});
    }
    /**
     * Changes the layout (columns or grid).
     *
     * @see this.selectClass for parameters
     */
    async selectLayout(previewMode, widgetValue, params) {
        if (widgetValue === "grid") {
            const rowEl = this.target.querySelector('.row');
            if (!rowEl || !rowEl.classList.contains('o_grid_mode')) { // Prevent toggling grid mode twice.
                gridUtils._toggleGridMode(this.target);
                this.env.activateSnippet(this.target);
            }
        } else {
            // Toggle normal mode only if grid mode was activated (as it's in
            // normal mode by default).
            const rowEl = this.target.querySelector('.row');
            if (rowEl && rowEl.classList.contains('o_grid_mode')) {
                this._toggleNormalMode(rowEl);
                this.env.activateSnippet(this.target);
            }
        }
        // TODO: when notify is adapted.
        //this.trigger_up('option_update', {
        //    optionName: 'StepsConnector',
        //    name: 'change_columns',
        //});
    }
    /**
     * Adds an image, some text or a button in the grid.
     *
     * @see this.selectClass for parameters
     */
    async addElement(previewMode, widgetValue, params) {
        const rowEl = this.target.querySelector('.row');
        const elementType = widgetValue;

        // If it has been less than 15 seconds that we have added an element,
        // shift the new element right and down by one cell. Otherwise, put it
        // on the top left corner.
        const currentTime = new Date().getTime();
        if (this.lastAddTime && (currentTime - this.lastAddTime) / 1000 < 15) {
            this.lastStartPosition = [this.lastStartPosition[0] + 1, this.lastStartPosition[1] + 1];
        } else {
            this.lastStartPosition = [1, 1]; // [rowStart, columnStart]
        }
        this.lastAddTime = currentTime;

        // Create the new column.
        const newColumnEl = document.createElement('div');
        newColumnEl.classList.add('o_grid_item');
        let numberColumns, numberRows;

        if (elementType === 'image') {
            // Set the columns properties.
            newColumnEl.classList.add('col-lg-6', 'g-col-lg-6', 'g-height-6', 'o_grid_item_image');
            numberColumns = 6;
            numberRows = 6;

            // Create a default image and add it to the new column.
            const imgEl = document.createElement('img');
            imgEl.classList.add('img', 'img-fluid', 'mx-auto');
            imgEl.src = '/web/image/website.s_text_image_default_image';
            imgEl.alt = '';
            imgEl.loading = 'lazy';

            newColumnEl.appendChild(imgEl);
        } else if (elementType === 'text') {
            newColumnEl.classList.add('col-lg-4', 'g-col-lg-4', 'g-height-2');
            numberColumns = 4;
            numberRows = 2;

            // Create default text content.
            const pEl = document.createElement('p');
            pEl.classList.add('o_default_snippet_text');
            pEl.textContent = _t("Write something...");

            newColumnEl.appendChild(pEl);
        } else if (elementType === 'button') {
            newColumnEl.classList.add('col-lg-2', 'g-col-lg-2', 'g-height-1');
            numberColumns = 2;
            numberRows = 1;

            // Create default button.
            const aEl = document.createElement('a');
            aEl.href = '#';
            aEl.classList.add('mb-2', 'btn', 'btn-primary');
            aEl.textContent = "Button";

            newColumnEl.appendChild(aEl);
        }
        // Place the column in the grid.
        const rowStart = this.lastStartPosition[0];
        let columnStart = this.lastStartPosition[1];
        if (columnStart + numberColumns > 13) {
            columnStart = 1;
            this.lastStartPosition[1] = columnStart;
        }
        newColumnEl.style.gridArea = `${rowStart} / ${columnStart} / ${rowStart + numberRows} / ${columnStart + numberColumns}`;

        // Setting the z-index to the maximum of the grid.
        gridUtils._setElementToMaxZindex(newColumnEl, rowEl);

        // Add the new column and update the grid height.
        rowEl.appendChild(newColumnEl);
        gridUtils._resizeGrid(rowEl);
        this.env.activateSnippet(newColumnEl);
    }
    /**
     * @override
     */
    async selectStyle(previewMode, widgetValue, params) {
        await super.selectStyle(...arguments);
        if (params.cssProperty.startsWith('--grid-item-padding')) {
            // Reset the animations.
            this._removePaddingPreview();
            void this.target.offsetWidth; // Trigger a DOM reflow.

            // Highlight the padding when changing it, by adding a pseudo-
            // element with an animated colored border inside the grid items.
            const rowEl = this.target;
            rowEl.classList.add('o_we_padding_highlight');
            rowEl._removePaddingPreview = () => this._removePaddingPreview(rowEl);
            rowEl.addEventListener('animationend', rowEl._removePaddingPreview);
        }
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    computeWidgetState(methodName, params) {
        if (methodName === 'selectCount') {
            return this.$target.find('> .row').children().length;
        } else if (methodName === 'selectLayout') {
            const rowEl = this.target.querySelector('.row');
            if (rowEl && rowEl.classList.contains('o_grid_mode')) {
                return "grid";
            } else {
                return "normal";
            }
        }
        return super.computeWidgetState(...arguments);
    }
    /**
     * @override
     */
    computeWidgetVisibility(widgetName, params) {
        if (widgetName === 'zero_cols_opt') {
            // Note: "s_allow_columns" indicates containers which may have
            // bare content (without columns) and are allowed to have columns.
            // By extension, we only show the "None" option on elements that
            // were marked as such as they were allowed to have bare content in
            // the first place.
            return this.target.matches('.s_allow_columns');
        } else if (widgetName === "column_count_opt") {
            // Hide the selectCount widget if the `s_nb_column_fixed` class is
            // on the row.
            return !this.target.querySelector(":scope > .row.s_nb_column_fixed");
        }
        return super.computeWidgetVisibility(...arguments);
    }
    /**
     * Adds new columns which are clones of the last column or removes the
     * last x columns.
     *
     * @private
     * @param {jQuery} $row - the row in which to update the columns
     * @param {integer} count - positif to add, negative to remove
     */
    async _updateColumnCount($row, count) {
        if (!count) {
            return;
        }

        if (count > 0) {
            var $lastColumn = $row.children().last();
            for (var i = 0; i < count; i++) {
                await new Promise(resolve => {
                    this.trigger_up('clone_snippet', {$snippet: $lastColumn, onSuccess: resolve});
                });
            }
        } else {
            var self = this;
            for (const el of $row.children().slice(count)) {
                await new Promise(resolve => {
                    self.trigger_up('remove_snippet', {$snippet: $(el), onSuccess: resolve, shouldRecordUndo: false});
                });
            }
        }

        this._resizeColumns($row.children());
        this.trigger_up('cover_update');
    }
    /**
     * Resizes the columns so that they are kept on one row.
     *
     * @private
     * @param {jQuery} $columns - the columns to resize
     */
    _resizeColumns($columns) {
        const colsLength = $columns.length;
        var colSize = Math.floor(12 / colsLength) || 1;
        var colOffset = Math.floor((12 - colSize * colsLength) / 2);
        var colClass = 'col-lg-' + colSize;
        $columns.toArray().forEach((column) => {
            var $column = $(column);
            $column.attr('class', $column.attr('class').replace(/\b(col|offset)-lg(-\d+)?\b/g, ''));
            $column.addClass(colClass);
        });
        if (colOffset) {
            $columns.first().addClass('offset-lg-' + colOffset);
        }
    }
    /**
     * Toggles the normal mode.
     *
     * @private
     * @param {Element} rowEl
     */
    _toggleNormalMode(rowEl) {
        // Removing the grid class
        rowEl.classList.remove('o_grid_mode');
        const columnEls = rowEl.children;
        for (const columnEl of columnEls) {
            // Reloading the images.
            gridUtils._reloadLazyImages(columnEl);

            // Removing the grid properties.
            const gridSizeClasses = columnEl.className.match(/(g-col-lg|g-height)-[0-9]+/g);
            columnEl.classList.remove('o_grid_item', 'o_grid_item_image', 'o_grid_item_image_contain', ...gridSizeClasses);
            columnEl.style.removeProperty('grid-area');
            columnEl.style.removeProperty('z-index');
        }
        // Removing the grid properties.
        delete rowEl.dataset.rowCount;
        rowEl.style.removeProperty('--grid-item-padding-x');
        rowEl.style.removeProperty('--grid-item-padding-y');
    }
    /**
     * Removes the padding highlights that were added when changing the grid
     * items padding.
     *
     * @private
     */
    _removePaddingPreview() {
        const rowEl = this.target;
        rowEl.removeEventListener('animationend', rowEl._removePaddingPreview);
        rowEl.classList.remove('o_we_padding_highlight');
        delete rowEl._removePaddingPreview;
    }
}

export class VerticalAlignment extends SnippetOption {
    /**
     * @override
     */
    async computeWidgetState(methodName, params) {
        const value = await super.computeWidgetState(...arguments);
        if (methodName === 'selectClass' && !value) {
            // If there is no `align-items-` class on the row, then the `align-
            // items-stretch` class is selected, because the behaviors are
            // equivalent in both situations.
            return 'align-items-stretch';
        }
        return value;
    }
}
/**
 * Handle the save of a snippet as a template that can be reused later
 */
class SnippetSave extends SnippetOption {
    static isTopOption = true;

    setup() {
        super.setup();
        this.env.validMethodNames.push("saveSnippet");
        this.dialog = useService("dialog");
    }
    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * @see this.selectClass for parameters
     */
    saveSnippet(previewMode, widgetValue, params) {
        console.log("Requesting save");
        //return new Promise(resolve => {
        //    Dialog.confirm(this, _t("To save a snippet, we need to save all your previous modifications and reload the page."), {
        //        cancel_callback: () => resolve(false),
        //        buttons: [
        //            {
        //                text: _t("Save and Reload"),
        //                classes: 'btn-primary',
        //                close: true,
        //                click: () => {
        //                    const snippetKey = this.$target[0].dataset.snippet;
        //                    let thumbnailURL;
        //                    this.trigger_up('snippet_thumbnail_url_request', {
        //                        key: snippetKey,
        //                        onSuccess: url => thumbnailURL = url,
        //                    });
        //                    let context;
        //                    this.trigger_up('context_get', {
        //                        callback: ctx => context = ctx,
        //                    });
        //                    this.trigger_up('request_save', {
        //                        reloadEditor: true,
        //                        invalidateSnippetCache: true,
        //                        onSuccess: async () => {
        //                            const defaultSnippetName = sprintf(_t("Custom %s"), this.data.snippetName);
        //                            const targetCopyEl = this.$target[0].cloneNode(true);
        //                            delete targetCopyEl.dataset.name;
        //                            // By the time onSuccess is called after request_save, the
        //                            // current widget has been destroyed and is orphaned, so this._rpc
        //                            // will not work as it can't trigger_up. For this reason, we need
        //                            // to bypass the service provider and use the global RPC directly
        //                            await rpc.query({
        //                                model: 'ir.ui.view',
        //                                method: 'save_snippet',
        //                                kwargs: {
        //                                    'name': defaultSnippetName,
        //                                    'arch': targetCopyEl.outerHTML,
        //                                    'template_key': this.options.snippets,
        //                                    'snippet_key': snippetKey,
        //                                    'thumbnail_url': thumbnailURL,
        //                                    'context': context,
        //                                },
        //                            });
        //                        },
        //                    });
        //                    resolve(true);
        //                }
        //            }, {
        //                text: _t("Cancel"),
        //                close: true,
        //                click: () => resolve(false),
        //            }
        //        ]
        //    });
        //});
    }
}
registry.category("snippets_options").add("SnippetSave", {
    component: SnippetSave,
    selector: "[data-snippet]",
    exclude: ".o_no_save",
    template: "web_editor.SnippetSave",
});
/**
 * Allows snippets to be moved before the preceding element or after the following.
 */
export class SnippetMove extends SnippetOption {
    static displayOverlayOption = true;

    setup() {
        super.setup();
        this.env.validMethodNames.push("moveSnippet");
        onMounted(() => {
            const moveOptions = this.props.overlayEl.querySelector(".o_overlay_move_options");
            this.__owl__.bdom.moveBeforeDOMNode(moveOptions.firstChild, moveOptions);
        });
    }

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Moves the snippet around.
     *
     * @see this.selectClass for parameters
     */
    moveSnippet(previewMode, widgetValue, params) {
        const isNavItem = this.target.classList.contains('nav-item');
        const $tabPane = isNavItem ? $(this.$target.find('.nav-link')[0].hash) : null;
        switch (widgetValue) {
            case 'prev':
                this.$target.prev().before(this.$target);
                if (isNavItem) {
                    $tabPane.prev().before($tabPane);
                }
                break;
            case 'next':
                this.$target.next().after(this.$target);
                if (isNavItem) {
                    $tabPane.next().after($tabPane);
                }
                break;
        }
        if (!this.$target.is(this.props.data.target)
            && (params.name === 'move_up_opt' || params.name === 'move_down_opt')) {
            const mainScrollingEl = $().getScrollingElement()[0];
            const elTop = this.$target[0].getBoundingClientRect().top;
            const heightDiff = mainScrollingEl.offsetHeight - this.$target[0].offsetHeight;
            const bottomHidden = heightDiff < elTop;
            const hidden = elTop < 0 || bottomHidden;
            if (hidden) {
                dom.scrollTo(this.$target[0], {
                    extraOffset: 50,
                    forcedOffset: bottomHidden ? heightDiff - 50 : undefined,
                    easing: 'linear',
                    duration: 500,
                });
            }
        }
        //this.trigger_up('option_update', {
        //    optionName: 'StepsConnector',
        //    name: 'move_snippet',
        //});
        //// Update the "Invisible Elements" panel as the order of invisible
        //// snippets could have changed on the page.
        //this.trigger_up("update_invisible_dom");
    }
}

export class BackgroundToggler extends SnippetOption {

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Toggles background image on or off.
     *
     * @see this.selectClass for parameters
     */
    toggleBgImage(previewMode, widgetValue, params) {
        if (!widgetValue) {
            this.$target.find('> .o_we_bg_filter').remove();
            // TODO: use setWidgetValue instead of calling background directly when possible
            const [bgImageWidget] = this._requestUserValueWidgets('bg_image_opt');
            const bgImageOpt = bgImageWidget.getParent();
            return bgImageOpt.background(false, '', bgImageWidget.getMethodsParams('background'));
        } else {
            // TODO: use trigger instead of el.click when possible
            this._requestUserValueWidgets('bg_image_opt')[0].el.click();
        }
    }
    /**
     * Toggles background shape on or off.
     *
     * @see this.selectClass for parameters
     */
    toggleBgShape(previewMode, widgetValue, params) {
        const [shapeWidget] = this._requestUserValueWidgets('bg_shape_opt');
        const shapeOption = shapeWidget.getParent();
        // TODO: open select after shape was selected?
        // TODO: use setWidgetValue instead of calling shapeOption method directly when possible
        return shapeOption._toggleShape();
    }
    /**
     * Sets a color filter.
     *
     * @see this.selectClass for parameters
     */
    async selectFilterColor(previewMode, widgetValue, params) {
        // Find the filter element.
        let filterEl = this.$target[0].querySelector(':scope > .o_we_bg_filter');

        // If the filter would be transparent, remove it / don't create it.
        const rgba = widgetValue && convertCSSColorToRgba(widgetValue);
        if (!widgetValue || rgba && rgba.opacity < 0.001) {
            if (filterEl) {
                filterEl.remove();
            }
            return;
        }

        // Create the filter if necessary.
        if (!filterEl) {
            filterEl = document.createElement('div');
            filterEl.classList.add('o_we_bg_filter');
            const lastBackgroundEl = this._getLastPreFilterLayerElement();
            if (lastBackgroundEl) {
                $(lastBackgroundEl).after(filterEl);
            } else {
                this.$target.prepend(filterEl);
            }
        }

        // Apply the color on the filter.
        const obj = createPropertyProxy(this, '$target', $(filterEl));
        params.cssProperty = 'background-color';
        return this.selectStyle.call(obj, previewMode, widgetValue, params);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    computeWidgetState(methodName, params) {
        switch (methodName) {
            case 'toggleBgImage': {
                const [bgImageWidget] = this._requestUserValueWidgets('bg_image_opt');
                const bgImageOpt = bgImageWidget.getParent();
                return !!bgImageOpt._computeWidgetState('background', bgImageWidget.getMethodsParams('background'));
            }
            case 'toggleBgShape': {
                const [shapeWidget] = this._requestUserValueWidgets('bg_shape_opt');
                const shapeOption = shapeWidget.getParent();
                return !!shapeOption._computeWidgetState('shape', shapeWidget.getMethodsParams('shape'));
            }
            case 'selectFilterColor': {
                const filterEl = this.$target[0].querySelector(':scope > .o_we_bg_filter');
                if (!filterEl) {
                    return '';
                }
                const obj = createPropertyProxy(this, '$target', $(filterEl));
                params.cssProperty = 'background-color';
                return this._computeWidgetState.call(obj, 'selectStyle', params);
            }
        }
        return super.computeWidgetState(...arguments);
    }
    /**
     * @private
     */
    _getLastPreFilterLayerElement() {
        return null;
    }
}

/**
 * Marks color levels of any element that may get or has a color classes. This
 * is done for the specific main colorpicker option so that those are marked on
 * snippet drop (so that base snippet definition do not need to care about that)
 * and on first focus (for compatibility).
 */
export class ColoredLevelBackground extends BackgroundToggler {
    /**
     * @override
     */
    start() {
        this._markColorLevel();
        return super.start(...arguments);
    }
    /**
     * @override
     */
    onBuilt() {
        this._markColorLevel();
        return super.onBuilt();
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Adds a specific class indicating the element is colored so that nested
     * color classes work (we support one-level). Removing it is not useful,
     * technically the class can be added on anything that *may* receive a color
     * class: this does not come with any CSS rule.
     *
     * @private
     */
    _markColorLevel() {
        this.env.odooEditor.observerUnactive('_markColorLevel');
        this.$target.addClass('o_colored_level');
        this.env.odooEditor.observerActive('_markColorLevel');
    }
}

/*
 * Abstract option to be extended by the Carousel and gallery options (through
 * the "CarouselHandler" option) that handles all the common parts (reordering
 * of elements).
 */
export class GalleryHandler extends SnippetOption {

    /**
     * Handles reordering of items.
     *
     * @override
     */
    async notify(name, data) {
        await super.notify(...arguments);
        if (name === "reorder_items") {
            const itemsEls = this.getGalleryItems();
            const oldPosition = itemsEls.indexOf(data.itemEl);
            if (oldPosition === 0 && data.position === "prev") {
                data.position = "last";
            } else if (oldPosition === itemsEls.length - 1 && data.position === "next") {
                data.position = "first";
            }
            itemsEls.splice(oldPosition, 1);
            switch (data.position) {
                case "first":
                    itemsEls.unshift(data.itemEl);
                    break;
                case "prev":
                    itemsEls.splice(Math.max(oldPosition - 1, 0), 0, data.itemEl);
                    break;
                case "next":
                    itemsEls.splice(oldPosition + 1, 0, data.itemEl);
                    break;
                case "last":
                    itemsEls.push(data.itemEl);
                    break;
            }
            this.reorderItems(itemsEls, itemsEls.indexOf(data.itemEl));
        }
    }
    /**
     * Called to get the items of the gallery sorted by index if any (see
     * gallery option) or by the order on the DOM otherwise.
     *
     * @abstract
     * @returns {HTMLElement[]}
     */
    getGalleryItems() {}
    /**
     * Called to reorder the items of the gallery.
     *
     * @abstract
     * @param {HTMLElement[]} itemsEls - the items to reorder.
     * @param {integer} newItemPosition - the new position of the moved items.
     */
    reorderItems(itemsEls, newItemPosition) {}
}

/*
 * Abstract option to be extended by the Carousel and gallery options that
 * handles the update of the carousel indicator.
 */
export class CarouselHandler extends GalleryHandler {

    /**
     * Gets the bootstrap instance of the carousel.
     */
    get bsCarousel() {
        const targetWindow = this.target.ownerDocument.defaultView;
        return targetWindow.Carousel.getOrCreateInstance(this.target);
    }
    /**
     * Update the carousel indicator.
     *
     * @param {integer} position - the position of the indicator to activate on
     * the carousel.
     */
    updateIndicatorAndActivateSnippet(position) {
        const carouselEl = this.target.classList.contains("carousel") ? this.target
            : this.target.querySelector(".carousel");
        carouselEl.classList.remove("slide");
        this.bsCarousel.to(position);
        for (const indicatorEl of this.target.querySelectorAll(".carousel-indicators li")) {
            indicatorEl.classList.remove("active");
        }
        this.target.querySelector(`.carousel-indicators li[data-bs-slide-to="${position}"]`)
            .classList.add("active");
        const snippet = this.target.querySelector(".carousel-item.active img");
        if (snippet) {
            this.env.activateSnippet(snippet);
        }
        carouselEl.classList.add("slide");
    }
}

/*
 * Abstract option to be extended by the ImageTools and BackgroundOptimize
 * options that handles all the common parts.
 */
class ImageHandlerOption extends SnippetOption {
    /**
     * @override
     */
    setup() {
        super.setup();

        this.rpc = useService("rpc");

        onWillStart(async () => {
            await this.initializeImage();
        });
    }

    //--------------------------------------------------------------------------
    // SnippetOption overrides
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    async start() {
        await super.start(...arguments);
        // TODO weight stuff later.
        const weightEl = document.createElement('span');
        weightEl.classList.add('o_we_image_weight', 'o_we_tag', 'd-none');
        weightEl.title = _t("Size");
        this.$weight = $(weightEl);
        // Perform the loading of the image info synchronously in order to
        // avoid an intermediate rendering of the Blocks tab during the
        // loadImageInfo RPC that obtains the file size.
        // This does not update the target.
        await this.applyOptions(false);
    }
    /**
     * @override
     */
    async updateUI() {
        await super.updateUI(...arguments);

        if (this._filesize === undefined) {
            this.$weight.addClass('d-none');
            await this.applyOptions(false);
        }
        if (this._filesize !== undefined) {
            this.$weight.text(`${this._filesize.toFixed(1)} kb`);
            this.$weight.removeClass('d-none');
            this.relocateWeightEl();
        }
    }
    /**
     * @override
     */
    computeVisibility() {
        const src = this.getImg().getAttribute('src');
        return src && src !== '/';
    }
    /**
     * @override
     */
    async computeWidgetState(methodName, params) {
        const img = this.getImg();

        // Make sure image is loaded because we need its naturalWidth
        await new Promise((resolve, reject) => {
            if (img.complete) {
                resolve();
                return;
            }
            img.addEventListener('load', resolve, {once: true});
            img.addEventListener('error', resolve, {once: true});
        });

        switch (methodName) {
            case 'selectFormat':
                return img.naturalWidth + ' ' + this.getImageMimetype(img);
            case 'setFilter':
                return img.dataset.filter;
            case 'glFilter':
                return img.dataset.glFilter || "";
            case 'setQuality':
                return img.dataset.quality || "75";
            case 'customFilter': {
                const {filterProperty} = params;
                const options = JSON.parse(img.dataset.filterOptions || "{}");
                const defaultValue = filterProperty === "blend" ? "normal" : "0";
                return options[filterProperty] || defaultValue;
            }
        }
        return super.computeWidgetState(...arguments);
    }
    /**
     * @override TODO CHECK HOW TO RENDER CUSTOM XML NOW !
     */
    async _renderCustomXML(uiFragment) {
        const img = this.getImg();
        if (!this.originalSrc || !this.isImageSupportedForProcessing(img)) {
            return;
        }
        const $select = $(uiFragment).find('we-select[data-name=format_select_opt]');
        (await this.computeAvailableFormats()).forEach(([value, [label, targetFormat]]) => {
            $select.append(`<we-button data-select-format="${Math.round(value)} ${targetFormat}" class="o_we_badge_at_end">${label} <span class="badge rounded-pill text-bg-dark">${targetFormat.split('/')[1]}</span></we-button>`);
        });

        if (!['image/jpeg', 'image/webp'].includes(this.getImageMimetype(img))) {
            const optQuality = uiFragment.querySelector('we-range[data-set-quality]');
            if (optQuality) {
                optQuality.remove();
            }
        }
    }
    /**
     * @override
     */
    computeWidgetVisibility(widgetName, params) {
        if (this.isImageProcessingWidget(widgetName, params)) {
            const img = this.getImg();
            return this.isImageSupportedForProcessing(img, true);
        }
        return isImageSupportedForStyle(this.getImg());
    }

    //--------------------------------------------------------------------------
    // Option specific
    //--------------------------------------------------------------------------

    /**
     * @see this.selectClass for parameters
     */
    selectFormat(previewMode, widgetValue, params) {
        const values = widgetValue.split(' ');
        const image = this.getImg();
        image.dataset.resizeWidth = values[0];
        if (image.dataset.shape) {
            // If the image has a shape, modify its originalMimetype attribute.
            image.dataset.originalMimetype = values[1];
        } else {
            // If the image does not have a shape, modify its mimetype
            // attribute.
            image.dataset.mimetype = values[1];
        }
        return this.applyOptions();
    }
    /**
     * @see this.selectClass for parameters
     */
    setQuality(previewMode, widgetValue, params) {
        if (previewMode) {
            return;
        }
        this.getImg().dataset.quality = widgetValue;
        return this.applyOptions();
    }
    /**
     * @see this.selectClass for parameters
     */
    glFilter(previewMode, widgetValue, params) {
        const dataset = this.getImg().dataset;
        if (widgetValue) {
            dataset.glFilter = widgetValue;
        } else {
            delete dataset.glFilter;
        }
        return this.applyOptions();
    }
    /**
     * @see this.selectClass for parameters
     */
    customFilter(previewMode, widgetValue, params) {
        const img = this.getImg();
        const {filterOptions} = img.dataset;
        const {filterProperty} = params;
        if (filterProperty === 'filterColor') {
            widgetValue = normalizeColor(widgetValue);
        }
        const newOptions = Object.assign(JSON.parse(filterOptions || "{}"), {[filterProperty]: widgetValue});
        img.dataset.filterOptions = JSON.stringify(newOptions);
        return this.applyOptions();
    }
    /**
     * @abstract
     */
    relocateWeightEl() {}
    /**
     * Returns a list of valid formats for a given image.
     */
    async computeAvailableFormats() {
        const img = this.getImg();
        const original = await loadImage(this.originalSrc);
        const maxWidth = img.dataset.width ? img.naturalWidth : original.naturalWidth;
        const optimizedWidth = Math.min(maxWidth, this.computeMaxDisplayWidth());
        this.optimizedWidth = optimizedWidth;
        const widths = {
            128: ['128px', 'image/webp'],
            256: ['256px', 'image/webp'],
            512: ['512px', 'image/webp'],
            1024: ['1024px', 'image/webp'],
            1920: ['1920px', 'image/webp'],
        };
        widths[img.naturalWidth] = [_t("%spx", img.naturalWidth), 'image/webp'];
        widths[optimizedWidth] = [_t("%spx (Suggested)", optimizedWidth), 'image/webp'];
        const imgMimetype = this.getImageMimetype(img);
        widths[maxWidth] = [_t("%spx (Original)", maxWidth), imgMimetype];
        if (imgMimetype !== 'image/webp') {
            // Avoid a key collision by subtracting 0.1 - putting the webp
            // above the original format one of the same size.
            widths[maxWidth - 0.1] = [_t("%spx", maxWidth), 'image/webp'];
        }
        return Object.entries(widths)
            .filter(([width]) => width <= maxWidth)
            .sort(([v1], [v2]) => v1 - v2);
    }
    /**
     * Applies all selected options on the original image.
     *
     * @param {boolean} [update=true] If this is false, this does not actually
     *     modifies the image but only simulates the modifications on it to
     *     be able to update the filesize UI.
     */
    async applyOptions(update = true) {
        const img = this.getImg();
        if (!update && !(img && img.complete)) {
            return;
        }
        if (!this.isImageSupportedForProcessing(img)) {
            this.originalId = null;
            this._filesize = undefined;
            return;
        }
        // Do not apply modifications if there is no original src, since it is
        // needed for it.
        if (!img.dataset.originalSrc) {
            delete img.dataset.mimetype;
            return;
        }
        const dataURL = await applyModifications(img, {mimetype: this.getImageMimetype(img)});
        this._filesize = getDataURLBinarySize(dataURL) / 1024;

        if (update) {
            img.classList.add('o_modified_image_to_save');
            const loadedImg = await loadImage(dataURL, img);
            this.applyImage(loadedImg);
            return loadedImg;
        }
        return img;
    }
    /**
     * Loads the image's attachment info.
     */
    async loadImageInfo(attachmentSrc = '') {
        const img = this.getImg();
        await loadImageInfo(img, this.rpc, attachmentSrc);
        if (!img.dataset.originalId) {
            this.originalId = null;
            this.originalSrc = null;
            return;
        }
        this.originalId = img.dataset.originalId;
        this.originalSrc = img.dataset.originalSrc;
    }
    /**
     * Sets the image's width to its suggested size.
     */
    async autoOptimizeImage() {
        await this.loadImageInfo();
        await this._rerenderXML(); // TODO check for rerender
        const img = this.getImg();
        if (!['image/gif', 'image/svg+xml'].includes(img.dataset.mimetype)) {
            // Convert to recommended format and width.
            img.dataset.mimetype = 'image/webp';
            img.dataset.resizeWidth = this.optimizedWidth;
        } else if (img.dataset.shape && img.dataset.originalMimetype !== "image/gif") {
            img.dataset.originalMimetype = "image/webp";
            img.dataset.resizeWidth = this.optimizedWidth;
        }
        await this.applyOptions();
        await this.updateUI();
    }
    /**
     * Returns the image that is currently being modified.
     *
     * @abstract
     * @returns {HTMLImageElement} the image to use for modifications
     */
    getImg() {}
    /**
     * Computes the image's maximum display width.
     *
     * @abstract
     * @returns {Int} the maximum width at which the image can be displayed
     */
    computeMaxDisplayWidth() {}
    /**
     * Use the processed image when it's needed in the DOM.
     *
     * @abstract
     * @param {HTMLImageElement} img
     */
    applyImage(img) {}
    /**
     * @param {HTMLImageElement} img
     * @returns {String} The right mimetype used to apply options on image.
     */
    getImageMimetype(img) {
        return img.dataset.mimetype;
    }
    /**
     *
     */
    async initializeImage() {
        return this.loadImageInfo();
    }
     /**
     * @param {HTMLImageElement} img
     * @param {Boolean} [strict=false]
     * @returns {Boolean}
     */
    isImageSupportedForProcessing(img, strict = false) {
        return isImageSupportedForProcessing(this.getImageMimetype(img), strict);
    }
    /**
     * Indicates if an option should be applied only on supported mimetypes.
     *
     * @param {String} widgetName
     * @param {Object} params
     * @returns {Boolean}
     */
    isImageProcessingWidget(widgetName, params) {
        return params.possibleValues.glFilter
            || 'customFilter' in params.possibleValues
            || params.possibleValues.setQuality
            || widgetName === 'format_select_opt';
    }
}

class SnippetTestOption extends SnippetOption {
    setup() {
        super.setup();
        useSubEnv({
            validMethodNames: [
                ...this.env.validMethodNames,
                "wait",
                "test",
                "testImg",
                "testTimedate",
                "testRange",
                "testInput",
                "testNotify",
                "toggleButton",
                "renderListItems",
                "testMany2one",
                "testMany2many",
            ],
        });
        this.date = luxon.DateTime.now().ts;
        this.range = "value1";
        this.input = "auto";
        this.records = [];
        this.listItems = JSON.stringify([]);
        this.many2oneState = "";
        this.many2manyState = "[]";
        for (let i = 1; i <= 10; i++) {
            this.records.push(
                {
                    id: i,
                    display_name: `Example ${i}`,
                }
            );
        }
    }
    notify(name, data) {
        console.log(name, data);
    }
    async wait(previewMode, widgetValue, params) {
        const promise = new Promise((resolve, reject) => {
            setTimeout(resolve, 1000);
        });
        await promise;
    }
    async test(previewMode, widgetValue, params) {}

    testImg() {}
    testTimedate(previewMode, widgetValue, params) {
        this.date = widgetValue;
    }
    testRange(previewMode, widgetValue, params) {
        this.range = widgetValue;
    }
    testInput(previewMode, widgetValue, params) {
        this.input = widgetValue;
    }
    renderListItems(previewMode, widgetValue, params) {
        this.listItems = widgetValue;
    }
    async testNotify(previewMode, widgetValue, params) {
        await this.props.notifyOptions("SnippetTestOption", {
            name: "test_notify",
            data: {
                target: this.target,
            },
        });
    }
    async toggleButton(previewMode, widgetValue, params) {
        this.toggleButtonValue = widgetValue;
    }
    async testMany2one(previewMode, widgetValue, params) {
        this.many2oneState = widgetValue;
    }

    async testMany2many(previewMode , widgetValue, params) {
        this.many2manyState = widgetValue;
    }
    /**
     * @override
     */
    computeWidgetState(methodName, params) {
        if (methodName === "wait") {
            return false;
        }
        if (methodName === "test") {
            return false;
        }
        if (methodName === "testNotify") {
            return false;
        }
        if (methodName === "testImg") {
            return "/web/image/website.s_text_image_default_image";
        }
        if (methodName === "testTimedate") {
            return this.date;
        }
        if (methodName === "testRange") {
            return this.range;
        }
        if (methodName === "testInput") {
            return this.input;
        }
        if (methodName === "toggleButton") {
            return this.toggleButtonValue || "";
        }
        if (methodName === "renderListItems") {
            return this.listItems;
        }
        if (methodName === "testMany2one") {
            return this.many2oneState;
        }
        if (methodName === "testMany2many") {
            return this.many2manyState;
        }
        return super.computeWidgetState(...arguments);
    }
}

registry.category("snippets_options").add(
    "TestOption",
    {
        component: SnippetTestOption,
        selector: "section",
        template: "web_editor.TestOption",
    },
    {
        sequence: 15,
    }
);

registry.category("snippets_options").add("s_hr", {
    selector: ".s_hr",
    dropNear: "p, h1, h2, h3, blockquote, .s_hr",
    template: xml`<div class="d-none"/>`,
});
