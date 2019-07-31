(function () {
'use strict';

const regex = we3.utils.regex.TestManagerPlugin = {};

const rangeCollapsedMarker = regex.rangeCollapsedMarker = '\u25C6'; // ◆
const rangeStartMarker = regex.rangeStartMarker = '\u25B6'; // ▶
const rangeEndMarker = regex.rangeEndMarker = '\u25C0'; // ◀

regex.range = new RegExp('(' + rangeStartMarker + '|' + rangeEndMarker + '|' + rangeCollapsedMarker + ')', 'g');
regex.rangeToCollapsed = new RegExp(rangeStartMarker + rangeEndMarker, 'g');
regex.other = '[^' + rangeStartMarker + '' + rangeEndMarker + ']*';
regex.rangeCollapsed = new RegExp('^(' + regex.other + ')(' + rangeCollapsedMarker + ')(' + regex.other + ')$');
regex.rangeNotCollapsed = new RegExp('^(' + regex.other + ')(' + rangeStartMarker + ')?(' + regex.other + ')(' + rangeEndMarker + ')?(' + regex.other + ')$');
regex.space = /\u00A0/g;
regex.invisible = /\uFEFF/g;

})();

