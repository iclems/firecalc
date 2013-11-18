var firecalc = firecalc || { };

firecalc.EditorClient = (function () {
  'use strict';

  var Client = firecalc.Client;
  var Operation = firecalc.Operation;
  var Cursor = firecalc.Cursor;

  function OtherClient (id, editorAdapter) {
    this.id = id;
    this.editorAdapter = editorAdapter;

    this.li = document.createElement('li');
  }

  OtherClient.prototype.setColor = function (color) {
    this.color = color;
  };

  OtherClient.prototype.updateCursor = function (cursor) {
    this.removeCursor();
    this.cursor = cursor;
    this.mark = this.editorAdapter.setOtherCursor(
      cursor,
      this.color,
      this.id
    );
  };

  OtherClient.prototype.removeCursor = function () {
    if (this.mark) { this.mark.clear(); }
  };

  OtherClient.prototype.refreshCursor = function () {
    if (!this.cursor || !this.cursor.ecell) return;
    this.updateCursor(new Cursor(this.cursor.ecell));
  };

  function EditorClient (serverAdapter, editorAdapter) {
    Client.call(this);
    this.serverAdapter = serverAdapter;
    this.editorAdapter = editorAdapter;

    this.clients = { };

    var self = this;

    this.editorAdapter.registerCallbacks({
      operation: function (data) {
        self.applyClient(new Operation(data)); 
      },
      cursorActivity: function (cursor) { self.onCursorActivity(cursor); },
      cursorRefresh: function() {
        for (var clientId in self.clients) {
          self.getClientObject(clientId).refreshCursor();
        }
      }
    });

    this.serverAdapter.registerCallbacks({
      ack: function () { self.serverAck(); },
      retry: function() { self.serverRetry(); },
      operation: function (operation) {
        self.applyServer(operation);
      },
      checkpoint: function(a) {
        if (typeof a == 'function') {
          var snapshot = self.editorAdapter.getSnapshot();
          a(snapshot);
        } else if (typeof a == 'string') {
          self.editorAdapter.loadSnapshot(a);
        }
      },
      cursor: function (clientId, cursor, color) {
        if (self.serverAdapter.userId_ === clientId) return;
        var client = self.getClientObject(clientId);
        if (cursor) {
          client.setColor(color);
          client.updateCursor(Cursor.fromJSON(cursor));
        } else {
          client.removeCursor();
        }
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

  EditorClient.prototype.onChange = function (operation, inverse) {
    this.applyClient(operation);
  };

  EditorClient.prototype.onCursorActivity = function (cursor) {
    var oldCursor = this.cursor;
    this.cursor = cursor;
    if (oldCursor && this.cursor.equals(oldCursor)) { return; }
    this.sendCursor(this.cursor);
  };

  EditorClient.prototype.sendCursor = function (cursor) {
    if (this.state instanceof Client.AwaitingWithBuffer) { return; }
    this.serverAdapter.sendCursor(cursor);
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
