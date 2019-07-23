(function () {
'use strict';

var VerticalSizing = class extends (we3.getPlugin('BlockOption:OverlaySizing')) {

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _getSize(target) {
        var nClass = 'pt';
        var nProp = 'paddingTop';
        var sClass = 'pb';
        var sProp = 'paddingPottom';
        if (target.tagName === 'HR') {
            nClass = 'mt';
            nProp = 'marginTop';
            sClass = 'mb';
            sProp = 'marginBottom';
        }

        var grid = [];
        for (var i = 0; i <= 256 / 8; i++) {
            grid.push(i * 8);
        }
        grid.splice(1, 0, 4);
        return {
            n: [
                _.map(grid, function (v) {
                    return nClass + v;
                }),
                grid,
                nProp
            ],
            s: [
                _.map(grid, function (v) {
                    return sClass + v;
                }),
                grid,
                sProp
            ],
        };
    }
    /**
     * @override
     */
    _onResize(overlay, target, grid, compass, beginClass, current) {
        super._onResize(...arguments);

        var targetStyle = window.getComputedStyle(target);
        overlay.querySelectorAll('.n, .s').forEach(function (handle) {
            var direction = handle.classList.contains('n') ? 'Top' : 'Bottom';
            handle.style.height = targetStyle['padding' + direction];
        });
    }
};

we3.getPlugin('CustomizeBlock').registerOptionPlugIn('sizing_y', VerticalSizing);
})();
