(function () {
'use strict';

// var utils = we3.utils;

// var Field = class extends we3.ArchNode {
//     isVoidoid () {
//         return this.attributes['data-oe-type'] || 'html';;
//     }
//     removeLeft () {
//         this.remove();
//     }
//     removeRight () {
//         this.remove();
//     }
//     split () {
//         return;
//     }
// };

//--------------------------------------------------------------------------
// Image
//--------------------------------------------------------------------------

we3.addPlugin('Field', class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.dependencies = ['Arch'];
        this.templatesDependencies = ['xml/media.xml'];
        this.buttons = {
            template: 'we3.buttons.fieldEdit',
            active: '_active',
            enabled: '_enabled',
        };
    }

    edit (value, archNode) {
        debugger;
        // this.dependencies.Arch.importUpdate(archNode.toJSON());
    }

    getArchNode(archNode) {
        return archNode.ancestor(function (node) {
            return node.nodeName === 'span';
        });
    }

    _active (buttonName, focusNode) {
        return false;
    }
    _enabled (buttonName, focusNode) {
        var ancestorHTMLNode = focusNode.ancestor(function (node) {
            return node.nodeName === 'span';
        });
        if (ancestorHTMLNode) {
            debugger;
        }
        var res = ancestorHTMLNode && ancestorHTMLNode.attributes['data-oe-type'];
        console.log(res);
        return res;
    }
});

})();
