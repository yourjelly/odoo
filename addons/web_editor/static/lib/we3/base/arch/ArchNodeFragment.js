(function () {
'use strict';

we3.ArchNodeFragment = class extends we3.ArchNode {
    applyRules () {
        this._applyRulesPropagation();
    }
    /**
     * @override
     */
    isEditable () {
        return true;
    }
    /**
     * @override
     */
    isElement () { return false; }
    isFragment () { return true; }
    isVirtual () { return true; }
    get type () {
        return 'FRAGMENT';
    }
    _triggerChange () {}
};

})();
