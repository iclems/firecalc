var firecalc = firecalc || { };

firecalc.EditorClient = (function () {
  'use strict';

  var Client = firecalc.Client;
  var Operation = firecalc.Operation;

  function OtherClient (id, editorAdapter) {
    this.id = id;
    this.editorAdapter = editorAdapter;
  }

  OtherClient.prototype.setColor = function (color) {
    this.color = color;
  };

  function EditorClient (serverAdapter, editorAdapter) {
    Client.call(this);
    this.serverAdapter = serverAdapter;
    this.editorAdapter = editorAdapter;

    this.clients = { };

    var self = this;

    this.editorAdapter.registerCallbacks({
      execute: function (data) {
        var op = new Operation('execute', data);
        self.applyClient(op); 
      },
      ecell: function (data) { 
        // TODO: this is the local cursor move
        return;
      }
    });

    this.serverAdapter.registerCallbacks({
      ack: function () { self.serverAck(); },
      retry: function() { self.serverRetry(); },
      operation: function (operation) {
        self.applyServer(operation);
      },
      checkpoint: function(callback) {
        if (!callback) return;
        var snapshot = self.editorAdapter.getSnapshot();
        callback(snapshot);
      }
    });
  }

  inherit(EditorClient, Client);

  EditorClient.prototype.getClientObject = function (clientId) {
    var client = this.clients[clientId];
    if (client) { return client; }
    return this.clients[clientId] = new OtherClient(
      clientId,
      this.editorAdapter
    );
  };

  EditorClient.prototype.onChange = function (textOperation, inverse) {
    this.applyClient(textOperation);
  };

  EditorClient.prototype.sendOperation = function (operation) {
    this.serverAdapter.sendOperation(operation);
  };

  EditorClient.prototype.applyOperation = function (operation) {
    this.editorAdapter.applyOperation(operation);
  };

  // Set Const.prototype.__proto__ to Super.prototype
  function inherit (Const, Super) {
    function F () {}
    F.prototype = Super.prototype;
    Const.prototype = new F();
    Const.prototype.constructor = Const;
  }

  function last (arr) { return arr[arr.length - 1]; }

  return EditorClient;
}());
