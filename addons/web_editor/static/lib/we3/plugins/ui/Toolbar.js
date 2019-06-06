(function () {
'use strict';

var PopoverPlugin = we3.getPlugin('Popover');
var ToolbarPlugin = class extends PopoverPlugin {
    /**
     * @override
     */
    blurEditor () {
        var toolbar = this.popovers[0];
        toolbar.element.querySelectorAll('we3-button[name]').forEach(function (button) {
            button.classList.add('disabled');
        });
        this._toggleDropDownEnabled();
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _createPopover (insertCallback) {
        var toolbar = document.createElement('we3-toolbar');
        insertCallback(toolbar);
        this.popovers = [{
            pluginNames: this.options.toolbar,
            element: toolbar,
            display: true,
        }];
    }
    /**
     * @override
     */
    _createPopoverCheckMethod () {
        return;
    }
    /**
     * @override
     */
    _hidePopovers () {
        return;
    }
    /**
     * @override
     */
    _setOptionalDependencies () {
        var dependencies = this.dependencies.slice();
        this.options.toolbar.forEach(function (item) {
            if (dependencies.indexOf(item) === -1) {
                dependencies.push(item);
            }
        });
        this.dependencies = dependencies;
    }
    /**
     * @override
     */
    _updatePopovers () {
        return;
    }
    /**
     * @override
     */
    _updatePosition () {
        return;
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * On focusNode change, update the popover buttons.
     *
     * @override
     */
    _onFocusNode (focusNode) {
        this._updatePopoverButtons(focusNode);
    }
};

we3.addPlugin('Toolbar', ToolbarPlugin);

})();
