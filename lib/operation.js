var firecalc = firecalc || { };

firecalc.Operation = (function () {
  'use strict';
  var utils = firecalc.utils;

  // Constructor for new operations.
  function Operation (type, data) {
    if (!this || this.constructor !== Operation) {
      // => function was called without 'new'
      return new Operation();
    }
    
    if (type && data) {
      this.type = type;
      this.data = data;
    }
  }

  Operation.prototype.equals = function (other) {
    return (this.type == other.type) && firecalc.utils.arraysEqual(this.data, other.data);
  };
  
  // Converts operation into a JSON value.
  Operation.prototype.toJSON = function () {
    return { t: this.type, o: this.data };
  };

  // Converts a plain JS object into an operation and validates it.
  Operation.fromJSON = function (ops) {
    return new Operation(ops.t, ops.o);
  };

  return Operation;
}());
