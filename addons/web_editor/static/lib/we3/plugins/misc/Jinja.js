(function () {
'use strict';


var jinjaExp = /(^|\n)\s*%\s?(end|endif|else|if|set)/;
var isJinjaLineExp = /^\n?\s*((%\s?(end|endif|else|(if|set) [^\n]+)?)|(\{%.*%\})|(\$\{[^}]+\}\s*%?))\s*\n?$/;


var JINJA = class extends we3.ArchNodeText {
    //--------------------------------------------------------------------------
    // static
    //--------------------------------------------------------------------------

    static parse (archNode) {
        if (archNode.isText() && jinjaExp.test(archNode.nodeValue)) {
            return JINJA._splitTextArchNode(archNode);
        }
    }
    static _splitTextArchNode (archNode) {
        var fragment = new we3.ArchNodeFragment(archNode.params);
        archNode.nodeValue.trim().split('\n').forEach(function (line) {
            fragment.append(new JINJA(archNode.params, null, null, '\n'));
            if (isJinjaLineExp.test(line)) {
                fragment.append(new JINJA(archNode.params, null, null, line.trim()));
            } else {
                fragment.append(new we3.ArchNodeText(archNode.params, null, null, line.trim()));
            }
        });
        fragment.append(new JINJA(archNode.params, null, null, '\n'));
        return fragment;
    }

    //--------------------------------------------------------------------------
    // public
    //--------------------------------------------------------------------------

    isBlock () {
        return true;
    }
    isInPre () {
        return true;
    }
    isJinja () {
        return true;
    }
    get type () {
        return 'JINJA';
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _addArchitecturalSpaceNode () {
        this.nodeValue = this.nodeValue.replace(/^\n|\n$/g, '');
        if (!this.nodeValue.length) {
            if (this.isRightEdge()) {
                this.after(this.params.create('ArchitecturalSpace'));
            }
            return;
        }
        if (this.__removed || !this.parent || this._hasArchitecturalSpace) {
            return;
        }

        this.before(this.params.create('ArchitecturalSpace'));
        if (this.isRightEdge()) {
            this.after(this.params.create('ArchitecturalSpace'));
        }
        this._hasArchitecturalSpace = true;
    }
    _applyRulesArchNode () {
        return;
    }
    _getParentedRules () {
        var parentedRules = super._getParentedRules();
        parentedRules.push({
            nodes: {
                methods: ['isJinja'],
            },
            permittedParents: {
                methods: ['isNotText'],
            }
        });
        return parentedRules;
    }
};
we3.addArchNode('JINJA', JINJA);


var JinjaPlugin = class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.dependencies = ['Arch', 'CodeView'];
    }

    /**
     * @overwrite
     */
    setEditorValue () {
        var value = this.dependencies.Arch.getValue();
        if (jinjaExp.test(value)) {
            this.dependencies.CodeView.active(value);
        }
    }
};

we3.addPlugin('Jinja', JinjaPlugin);

})();
