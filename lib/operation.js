var firecalc = firecalc || { };

firecalc.Operation = (function () {
  'use strict';
  var utils = firecalc.utils;

  // Constructor for new operations.
  function Operation (data) {
    if (!this || this.constructor !== Operation) {
      // => function was called without 'new'
      return new Operation();
    }
    
    this.data = data || '';
  }

  Operation.prototype.equals = function (other) {
    return this.data == other.data;
  };
  
  Operation.prototype.compose = function(other) {
    var prepend = this.data ? (this.data+'\n') : '';
    return new Operation(prepend+other.data);
  };
  
  // Converts operation into a JSON value.
  Operation.prototype.toJSON = function () {
    return { d: this.data };
  };

  // Converts a plain JS object into an operation and validates it.
  Operation.fromJSON = function (ops) {
    return new Operation(ops.d);
  };

  return Operation;
}());
