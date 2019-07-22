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
        this.dependencies = ['Arch', 'Renderer'];
        this.templatesDependencies = ['xml/media.xml'];
        this.buttons = {
            template: 'we3.buttons.fieldEdit',
            active: '_active',
            enabled: '_enabled',
        };
    }

    edit (value, archNode) {
        var elementInDom = this.dependencies.Renderer.getElement(archNode.id);
        var fieldType = elementInDom.getAttribute('data-oe-type');
        var input = document.createElement('input');
        input.setAttribute('value', elementInDom.textContent);
        if (fieldType === 'date') {
            input.setAttribute('type', 'date');
        } else if (fieldType === 'text') {
            input.setAttribute('type', 'text');
        }
        elementInDom.parentNode.insertBefore(input, elementInDom);
        elementInDom.style.visibility = "hidden";
        input.addEventListener('focusout', function (ev) {
            debugger;
        });
        debugger;
        // this.dependencies.Arch.importUpdate(archNode.toJSON());
    }

    getArchNode(archNode) {
        return archNode.ancestor(function (node) {
            return node.attributes && node.attributes['data-oe-type'];
        });
    }

    _active (buttonName, focusNode) {
        return false;
    }
    _enabled (buttonName, focusNode) {
        var ancestorFieldNode = focusNode.ancestor(function (node) {
            return node.attributes && node.attributes['data-oe-type'];
        });
        return ancestorFieldNode;
    }
});

})();
