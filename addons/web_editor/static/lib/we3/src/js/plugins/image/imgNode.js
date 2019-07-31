(function () {
'use strict';

class ImgNode extends we3.getArchNode('Media') {
    isImg () {
        return true;
    }
    isInline () {
        return true;
    }
    get type () {
        return 'img';
    }
}

we3.addArchNode('img', ImgNode);

})();
