var firecalc = firecalc || { };
firecalc.Cursor = (function () {
  'use strict';

  // A cursor has a `position` and a `selectionEnd`. Both are zero-based indexes
  // into the document. When nothing is selected, `selectionEnd` is equal to
  // `position`. When there is a selection, `position` is always the side of the
  // selection that would move if you pressed an arrow key.
  function Cursor (ecell, original) {
    this.ecell = ecell || null;
    this.original = original || null;
  }

  Cursor.fromJSON = function (obj) {
    return new Cursor(obj.ecell, obj.original);
  };

  Cursor.prototype.equals = function (other) {
    return this.ecell === other.ecell &&
      this.original === other.original;
  };

  // Return the more current cursor information.
  Cursor.prototype.compose = function (other) {
    return other;
  };

  return Cursor;

}());

