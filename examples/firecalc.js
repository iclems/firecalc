/*
 * firecalc
 *
 * Copyright 2013 Clement Wehrung
 * with code from ot.js (Copyright 2012-2013 Tim Baumann) and Michael Lehenbauer (Firepad)
 */

var Firecalc = (function() {
var firecalc = firecalc || { };
firecalc.utils = { };

firecalc.utils.arraysEqual = function(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length != b.length) return false;

  // If you don't care about the order of the elements inside
  // the array, you should sort both arrays here.

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

firecalc.utils.makeEventEmitter = function(clazz, opt_allowedEVents) {
  clazz.prototype.allowedEvents_ = opt_allowedEVents;

  clazz.prototype.on = function(eventType, callback, context) {
    this.validateEventType_(eventType);
    this.eventListeners_ = this.eventListeners_ || { };
    this.eventListeners_[eventType] = this.eventListeners_[eventType] || [];
    this.eventListeners_[eventType].push({ callback: callback, context: context });
  };

  clazz.prototype.off = function(eventType, callback) {
    this.validateEventType_(eventType);
    this.eventListeners_ = this.eventListeners_ || { };
    var listeners = this.eventListeners_[eventType] || [];
    for(var i = 0; i < listeners.length; i++) {
      if (listeners[i].callback === callback) {
        listeners.splice(i, 1);
        return;
      }
    }
  };

  clazz.prototype.trigger =  function(eventType /*, args ... */) {
    this.eventListeners_ = this.eventListeners_ || { };
    var listeners = this.eventListeners_[eventType] || [];
    for(var i = 0; i < listeners.length; i++) {
      listeners[i].callback.apply(listeners[i].context, Array.prototype.slice.call(arguments, 1));
    }
  };

  clazz.prototype.validateEventType_ = function(eventType) {
    if (this.allowedEvents_) {
      var allowed = false;
      for(var i = 0; i < this.allowedEvents_.length; i++) {
        if (this.allowedEvents_[i] === eventType) {
          allowed = true;
          break;
        }
      }
      if (!allowed) {
        throw new Error('Unknown event "' + eventType + '"');
      }
    }
  };
};

firecalc.utils.elt = function(tag, content, attrs) {
  var e = document.createElement(tag);
  if (typeof content === "string") {
    firecalc.utils.setTextContent(e, content);
  } else if (content) {
    for (var i = 0; i < content.length; ++i) { e.appendChild(content[i]); }
  }
  for(var attr in (attrs || { })) {
    e.setAttribute(attr, attrs[attr]);
  }
  return e;
};

firecalc.utils.setTextContent = function(e, str) {
  e.innerHTML = "";
  e.appendChild(document.createTextNode(str));
};


firecalc.utils.on = function(emitter, type, f, capture) {
  if (emitter.addEventListener) {
    emitter.addEventListener(type, f, capture || false);
  } else if (emitter.attachEvent) {
    emitter.attachEvent("on" + type, f);
  }
};

firecalc.utils.off = function(emitter, type, f, capture) {
  if (emitter.removeEventListener) {
    emitter.removeEventListener(type, f, capture || false);
  } else if (emitter.detachEvent) {
    emitter.detachEvent("on" + type, f);
  }
};

firecalc.utils.preventDefault = function(e) {
  if (e.preventDefault) {
    e.preventDefault();
  } else {
    e.returnValue = false;
  }
};

firecalc.utils.stopPropagation = function(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  } else {
    e.cancelBubble = true;
  }
};

firecalc.utils.stopEvent = function(e) {
  firecalc.utils.preventDefault(e);
  firecalc.utils.stopPropagation(e);
};

firecalc.utils.stopEventAnd = function(fn) {
  return function(e) {
    fn(e);
    firecalc.utils.stopEvent(e);
    return false;
  };
};

firecalc.utils.trim = function(str) {
  return str.replace(/^\s+/g, '').replace(/\s+$/g, '');
};

firecalc.utils.assert = function assert (b, msg) {
  if (!b) {
    throw new Error(msg || "assertion error");
  }
};

firecalc.utils.log = function() {
  if (typeof console !== 'undefined' && typeof console.log !== 'undefined') {
    var args = ['firecalc:'];
    for(var i = 0; i < arguments.length; i++) {
      args.push(arguments[i]);
    }
    console.log.apply(console, args);
  }
};

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


var firecalc = firecalc || { };

firecalc.Operation = (function () {
  'use strict';
  var utils = firecalc.utils;
  var OPERATIONS_JOIN_CHAR = '\n';

  // Constructor for new operations.
  function Operation (data) {
    if (!this || this.constructor !== Operation) {
      // => function was called without 'new'
      return new Operation(data);
    }
    
    this.data = data || '';
  }

  Operation.prototype.equals = function (other) {
    return this.data == other.data;
  };
  
  Operation.prototype.compose = function(other) {
    var prepend = this.data ? (this.data + OPERATIONS_JOIN_CHAR) : '';
    return new Operation(prepend+other.data);
  };
  
  Operation.prototype.getDistinctOperations = function() {
    return this.data.split(OPERATIONS_JOIN_CHAR).map(function(op_data) {
      return new Operation(op_data);
    });
  };
  
  // Transform takes two operations A and B that happened concurrently and
  // produces two operations A' and B' (in an array) such that
  // `apply(apply(S, A), B') = apply(apply(S, B), A')`. This function is the
  // heart of OT.
  // As we can't fully support OT right now, let's take into account the fact
  // that operation1 is oustanding, operation2 received
  
  Operation.transform = function (operation1, operation2) {
    // TODO: handle this, it's totally wrong to just ignore it...
    return [operation1, operation2];
/*
    var operation1prime = new TextOperation();
    var operation2prime = new TextOperation();
    var ops1 = operation1.clone().ops, ops2 = operation2.clone().ops;
    var i1 = 0, i2 = 0;
    var op1 = ops1[i1++], op2 = ops2[i2++];
    while (true) {
      // At every iteration of the loop, the imaginary cursor that both
      // operation1 and operation2 have that operates on the input string must
      // have the same position in the input string.

      if (typeof op1 === 'undefined' && typeof op2 === 'undefined') {
        // end condition: both ops1 and ops2 have been processed
        break;
      }

      // next two cases: one or both ops are insert ops
      // => insert the string in the corresponding prime operation, skip it in
      // the other one. If both op1 and op2 are insert ops, prefer op1.
      if (op1 && op1.isInsert()) {
        operation1prime.insert(op1.text, op1.attributes);
        operation2prime.retain(op1.text.length);
        op1 = ops1[i1++];
        continue;
      }
      if (op2 && op2.isInsert()) {
        operation1prime.retain(op2.text.length);
        operation2prime.insert(op2.text, op2.attributes);
        op2 = ops2[i2++];
        continue;
      }

      if (typeof op1 === 'undefined') {
        throw new Error("Cannot transform operations: first operation is too short.");
      }
      if (typeof op2 === 'undefined') {
        throw new Error("Cannot transform operations: first operation is too long.");
      }

      var minl;
      if (op1.isRetain() && op2.isRetain()) {
        // Simple case: retain/retain
        var attributesPrime = TextOperation.transformAttributes(op1.attributes, op2.attributes);
        if (op1.chars > op2.chars) {
          minl = op2.chars;
          op1.chars -= op2.chars;
          op2 = ops2[i2++];
        } else if (op1.chars === op2.chars) {
          minl = op2.chars;
          op1 = ops1[i1++];
          op2 = ops2[i2++];
        } else {
          minl = op1.chars;
          op2.chars -= op1.chars;
          op1 = ops1[i1++];
        }

        operation1prime.retain(minl, attributesPrime[0]);
        operation2prime.retain(minl, attributesPrime[1]);
      } else if (op1.isDelete() && op2.isDelete()) {
        // Both operations delete the same string at the same position. We don't
        // need to produce any operations, we just skip over the delete ops and
        // handle the case that one operation deletes more than the other.
        if (op1.chars > op2.chars) {
          op1.chars -= op2.chars;
          op2 = ops2[i2++];
        } else if (op1.chars === op2.chars) {
          op1 = ops1[i1++];
          op2 = ops2[i2++];
        } else {
          op2.chars -= op1.chars;
          op1 = ops1[i1++];
        }
      // next two cases: delete/retain and retain/delete
      } else if (op1.isDelete() && op2.isRetain()) {
        if (op1.chars > op2.chars) {
          minl = op2.chars;
          op1.chars -= op2.chars;
          op2 = ops2[i2++];
        } else if (op1.chars === op2.chars) {
          minl = op2.chars;
          op1 = ops1[i1++];
          op2 = ops2[i2++];
        } else {
          minl = op1.chars;
          op2.chars -= op1.chars;
          op1 = ops1[i1++];
        }
        operation1prime['delete'](minl);
      } else if (op1.isRetain() && op2.isDelete()) {
        if (op1.chars > op2.chars) {
          minl = op2.chars;
          op1.chars -= op2.chars;
          op2 = ops2[i2++];
        } else if (op1.chars === op2.chars) {
          minl = op1.chars;
          op1 = ops1[i1++];
          op2 = ops2[i2++];
        } else {
          minl = op1.chars;
          op2.chars -= op1.chars;
          op1 = ops1[i1++];
        }
        operation2prime['delete'](minl);
      } else {
        throw new Error("The two operations aren't compatible");
      }
    }

    return [operation1prime, operation2prime];
    */
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

var firecalc = firecalc || { };

firecalc.FirebaseAdapter = (function (global) {
  var Operation = firecalc.Operation;
  var utils = firecalc.utils;

  // Save a checkpoint every X edits.
  var CHECKPOINT_FREQUENCY = 30;

  function FirebaseAdapter (ref, userId, userColor) {
    this.ref_ = ref;
    this.ready_ = false;
    this.firebaseCallbacks_ = [];
    this.zombie_ = false;
    this.document_ = new Operation();

    // The next expected revision.
    this.revision_ = 0;

    // This is used for two purposes:
    // 1) On initialization, we fill this with the latest checkpoint and any subsequent operations and then
    //      process them all together.
    // 2) If we ever receive revisions out-of-order (e.g. rev 5 before rev 4), we queue them here until it's time
    //    for them to be handled. [this should never happen with well-behaved clients; but if it /does/ happen we want
    //    to handle it gracefully.]
    this.pendingReceivedRevisions_ = { };

    this.setUserId(userId);
    this.setColor(userColor);

    var self = this;
    this.firebaseOn_(ref.root().child('.info/connected'), 'value', function(snapshot) {
      if (snapshot.val() === true) {
        self.initializeUserData_();
      }
    }, this);

    // Avoid triggering any events until our callers have had a chance to attach their listeners.
    setTimeout(function() {
      self.monitorHistory_();
    }, 0);

    // Once we're initialized, start tracking users' cursors.
    this.on('ready', function() {
      self.monitorCursors_();
    });

  }
  utils.makeEventEmitter(FirebaseAdapter, ['ready', 'cursor', 'operation', 'ack', 'retry', 'checkpoint']);

  FirebaseAdapter.prototype.dispose = function() {
    this.removeFirebaseCallbacks_();

    this.userRef_.child('cursor').remove();
    this.userRef_.child('color').remove();

    this.ref_ = null;
    this.document_ = null;
    this.zombie_ = true;
  };

  FirebaseAdapter.prototype.setUserId = function(userId) {
    if (this.userRef_) {
      // clean up existing data.
      this.userRef_.child('cursor').remove();
      this.userRef_.child('cursor').onDisconnect().cancel();
      this.userRef_.child('color').remove();
      this.userRef_.child('color').onDisconnect().cancel();
    }

    this.userId_ = userId;
    this.userRef_ = this.ref_.child('users').child(userId);

    this.initializeUserData_();
  };

  FirebaseAdapter.prototype.isHistoryEmpty = function() {
    assert(this.ready_, "Not ready yet.");
    return this.revision_ === 0;
  };

  FirebaseAdapter.prototype.sendOperation = function (operation, cursor) {
    var self = this;

    // If we're not ready yet, do nothing right now, and trigger a retry when we're ready.
    if (!this.ready_) {
      this.on('ready', function() {
        self.trigger('retry');
      });
      return;
    }

    // Convert revision into an id that will sort properly lexicographically.
    var revisionId = revisionToId(this.revision_);

    function doTransaction(revisionId, revisionData) {
      self.ref_.child('history').child(revisionId).transaction(function(current) {
        if (current === null) {
          return revisionData;
        }
      }, function(error, committed) {
        if (error) {
          if (error.message === 'disconnect') {
            if (self.sent_ && self.sent_.id === revisionId) {
              // We haven't seen our transaction succeed or fail.  Send it again.
              setTimeout(function() {
                doTransaction(revisionId, revisionData);
              }, 0);
            }
          } else {
            utils.log('Transaction failure!', error);
            throw error;
          }
        }
      }, /*applyLocally=*/false);
    }

    this.sent_ = { id: revisionId, op: operation };
    doTransaction(revisionId, { a: self.userId_, o: operation.toJSON() });
  };

  FirebaseAdapter.prototype.sendCursor = function (obj) {
    this.userRef_.child('cursor').set(obj);
    this.cursor_ = obj;
  };

  FirebaseAdapter.prototype.setColor = function(color) {
    this.userRef_.child('color').set(color);
    this.color_ = color;
  };

  FirebaseAdapter.prototype.registerCallbacks = function(callbacks) {
    for (var eventType in callbacks) {
      this.on(eventType, callbacks[eventType]);
    }
  };

  FirebaseAdapter.prototype.initializeUserData_ = function() {
    this.userRef_.child('cursor').onDisconnect().remove();
    this.userRef_.child('color').onDisconnect().remove();

    this.sendCursor(this.cursor_ || null);
    this.setColor(this.color_ || null);
  };

  FirebaseAdapter.prototype.monitorCursors_ = function() {
    var usersRef = this.ref_.child('users'), self = this;
    var user2Callback = { };

    function childChanged(childSnap) {
      var userId = childSnap.name();
      var userData = childSnap.val();
      self.trigger('cursor', userId, userData.cursor, userData.color);
    }

    this.firebaseOn_(usersRef, 'child_added', childChanged);
    this.firebaseOn_(usersRef, 'child_changed', childChanged);

    this.firebaseOn_(usersRef, 'child_removed', function(childSnap) {
      var userId = childSnap.name();
      self.firebaseOff_(childSnap.ref(), 'value', user2Callback[userId]);
      self.trigger('cursor', userId, null);
    });
  };

  FirebaseAdapter.prototype.monitorHistory_ = function() {
    var self = this;
    // Get the latest checkpoint as a starting point so we don't have to re-play entire history.
    this.ref_.child('checkpoint').once('value', function(s) {
      if (self.zombie_) { return; } // just in case we were cleaned up before we got the checkpoint data.
      var revisionId = s.child('id').val(),  op = s.child('o').val(), author = s.child('a').val();
      // Checkpoint found
      if (op != null && revisionId != null && author !== null) {
        self.loadCheckpoint_(op);
        self.checkpointRevision_ = revisionFromId(revisionId);
        self.monitorHistoryStartingAt_(self.checkpointRevision_ + 1);
      } else {
        self.checkpointRevision_ = 0;
        self.monitorHistoryStartingAt_(self.checkpointRevision_);
      }
    });
  };

  FirebaseAdapter.prototype.monitorHistoryStartingAt_ = function(revision) {
    var historyRef = this.ref_.child('history').startAt(null, revisionToId(revision));
    var self = this;

    setTimeout(function() {
      self.firebaseOn_(historyRef, 'child_added', function(revisionSnapshot) {
        var revisionId = revisionSnapshot.name();
        self.pendingReceivedRevisions_[revisionId] = revisionSnapshot.val();
        if (self.ready_) {
          self.handlePendingReceivedRevisions_();
        }
      });

      historyRef.once('value', function() {
        self.handleInitialRevisions_();
      });
    }, 0);
  };

  FirebaseAdapter.prototype.handleInitialRevisions_ = function() {
    assert(!this.ready_, "Should not be called multiple times.");
    
    // Ignore the checkpoint and compose all subsequent revisions into a single operation to apply at once.
    this.revision_ = this.checkpointRevision_ ? this.checkpointRevision_+1 : 0;
    var revisionId = revisionToId(this.revision_), pending = this.pendingReceivedRevisions_;
    while (pending[revisionId] != null) {
      var revision = this.parseRevision_(pending[revisionId]);
      if (!revision) {
        // If a misbehaved client adds a bad operation, just ignore it.
        utils.log('Invalid operation.', this.ref_.toString(), revisionId, pending[revisionId]);
      } else {
        this.document_ = this.document_.compose(revision.operation);
      }

      delete pending[revisionId];
      this.revision_++;
      revisionId = revisionToId(this.revision_);
    }

    this.trigger('operation', this.document_);

    this.ready_ = true;
    var self = this;
    setTimeout(function() {
      self.trigger('ready');
    }, 0);
  };

  FirebaseAdapter.prototype.handlePendingReceivedRevisions_ = function() {
    var pending = this.pendingReceivedRevisions_;
    var revisionId = revisionToId(this.revision_);
    var triggerRetry = false;
    while (pending[revisionId] != null) {
      this.revision_++;

      var revision = this.parseRevision_(pending[revisionId]);
      if (!revision) {
        // If a misbehaved client adds a bad operation, just ignore it.
        utils.log('Invalid operation.', this.ref_.toString(), revisionId, pending[revisionId]);
      } else {
        this.document_ = this.document_.compose(revision.operation);
        if (this.sent_ && revisionId === this.sent_.id) {
          // We have an outstanding change at this revision id.
          if (this.sent_.op.equals(revision.operation) && revision.author === this.userId_) {
            // This is our change; it succeeded.
            if (this.revision_ % CHECKPOINT_FREQUENCY === 0) {
              this.saveCheckpoint_();
            }
            this.sent_ = null;
            this.trigger('ack');
          } else {
            // our op failed.  Trigger a retry after we're done catching up on any incoming ops.
            triggerRetry = true;
            this.trigger('operation', revision.operation);
          }
        } else {
          this.trigger('operation', revision.operation);
        }
      }
      delete pending[revisionId];

      revisionId = revisionToId(this.revision_);
    }

    if (triggerRetry) {
      this.sent_ = null;
      this.trigger('retry');
    }
  };

  FirebaseAdapter.prototype.parseRevision_ = function(data) {
    // We could do some of this validation via security rules.  But it's nice to be robust, just in case.
    if (typeof data !== 'object') { return null; }
    if (typeof data.a !== 'string' || typeof data.o !== 'object') { return null; }
    var op = null;
    try {
      op = Operation.fromJSON(data.o);
    }
    catch (e) {
      return null;
    }

    return { author: data.a, operation: op }
  };

  FirebaseAdapter.prototype.loadCheckpoint_ = function(data) {
    this.trigger('checkpoint', data);
  };

  FirebaseAdapter.prototype.saveCheckpoint_ = function() {
    var self = this;
    this.trigger('checkpoint', function(data) {
      self.ref_.child('checkpoint').set({
        a: self.userId_,
        o: data,
        id: revisionToId(self.revision_ - 1) // use the id for the revision we just wrote.
      });
    });
  };

  FirebaseAdapter.prototype.firebaseOn_ = function(ref, eventType, callback, context) {
    this.firebaseCallbacks_.push({ref: ref, eventType: eventType, callback: callback, context: context });
    ref.on(eventType, callback, context);
    return callback;
  };

  FirebaseAdapter.prototype.firebaseOff_ = function(ref, eventType, callback, context) {
    ref.off(eventType, callback, context);
    for(var i = 0; i < this.firebaseCallbacks_.length; i++) {
      var l = this.firebaseCallbacks_[i];
      if (l.ref === ref && l.eventType === eventType && l.callback === callback && l.context === context) {
        this.firebaseCallbacks_.splice(i, 1);
        break;
      }
    }
  };

  FirebaseAdapter.prototype.removeFirebaseCallbacks_ = function() {
    for(var i = 0; i < this.firebaseCallbacks_.length; i++) {
      var l = this.firebaseCallbacks_[i];
      l.ref.off(l.eventType, l.callback, l.context);
    }
    this.firebaseCallbacks_ = [];
  };

  // Throws an error if the first argument is falsy. Useful for debugging.
  function assert (b, msg) {
    if (!b) {
      throw new Error(msg || "assertion error");
    }
  }

  // Based off ideas from http://www.zanopha.com/docs/elen.pdf
  var characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  function revisionToId(revision) {
    if (revision === 0) {
      return 'A0';
    }

    var str = '';
    while (revision > 0) {
      var digit = (revision % characters.length);
      str = characters[digit] + str;
      revision -= digit;
      revision /= characters.length;
    }

    // Prefix with length (starting at 'A' for length 1) to ensure the id's sort lexicographically.
    var prefix = characters[str.length + 9];
    return prefix + str;
  }

  function revisionFromId(revisionId) {
    assert (revisionId.length > 0 && revisionId[0] === characters[revisionId.length + 8]);
    var revision = 0;
    for(var i = 1; i < revisionId.length; i++) {
      revision *= characters.length;
      revision += characters.indexOf(revisionId[i]);
    }
    return revision;
  }

  return FirebaseAdapter;
}());

var firecalc = firecalc || { };
firecalc.Client = (function () {
  'use strict';

  // Client constructor
  function Client () {
    this.state = synchronized_; // start state
  }

  Client.prototype.setState = function (state) {
    this.state = state;
  };

  // Call this method when the user changes the document.
  Client.prototype.applyClient = function (operation) {
    this.setState(this.state.applyClient(this, operation));
  };

  // Call this method with a new operation from the server
  Client.prototype.applyServer = function (operation) {
    this.setState(this.state.applyServer(this, operation));
  };

  Client.prototype.serverAck = function () {
    this.setState(this.state.serverAck(this));
  };
  
  // Transforms a cursor position from the latest known server state to the
  // current client state. For example, if we get from the server the
  // information that another user's cursor is at position 3, but the server
  // hasn't yet received our newest operation, an insertion of 5 characters at
  // the beginning of the document, the correct position of the other user's
  // cursor in our current document is 8.
  Client.prototype.transformCursor = function (cursor) {
    return this.state.transformCursor(cursor);
  };
  
  Client.prototype.serverRetry = function() {
    this.setState(this.state.serverRetry(this));
  };

  // Override this method.
  Client.prototype.sendOperation = function (operation) {
    throw new Error("sendOperation must be defined in child class");
  };

  // Override this method.
  Client.prototype.applyOperation = function (operation) {
    throw new Error("applyOperation must be defined in child class");
  };


  // In the 'Synchronized' state, there is no pending operation that the client
  // has sent to the server.
  function Synchronized () {}
  Client.Synchronized = Synchronized;

  Synchronized.prototype.applyClient = function (client, operation) {
    // When the user makes an edit, send the operation to the server and
    // switch to the 'AwaitingConfirm' state
    client.sendOperation(operation);
    return new AwaitingConfirm(operation);
  };

  Synchronized.prototype.applyServer = function (client, operation) {
    // When we receive a new operation from the server, the operation can be
    // simply applied to the current document
    client.applyOperation(operation);
    return this;
  };

  Synchronized.prototype.serverAck = function (client) {
    throw new Error("There is no pending operation.");
  };

  Synchronized.prototype.serverRetry = function(client) {
    throw new Error("There is no pending operation.");
  };

  // Nothing to do because the latest server state and client state are the same.
  Synchronized.prototype.transformCursor = function (cursor) { return cursor; };

  // Singleton
  var synchronized_ = new Synchronized();


  // In the 'AwaitingConfirm' state, there's one operation the client has sent
  // to the server and is still waiting for an acknowledgement.
  function AwaitingConfirm (outstanding) {
    // Save the pending operation
    this.outstanding = outstanding;
  }
  Client.AwaitingConfirm = AwaitingConfirm;

  AwaitingConfirm.prototype.applyClient = function (client, operation) {
    // When the user makes an edit, don't send the operation immediately,
    // instead switch to 'AwaitingWithBuffer' state
    return new AwaitingWithBuffer(this.outstanding, operation);
  };

  AwaitingConfirm.prototype.applyServer = function (client, operation) {
    // This is another client's operation. Visualization:
    //
    //                   /\
    // this.outstanding /  \ operation
    //                 /    \
    //                 \    /
    //  pair[1]         \  / pair[0] (new outstanding)
    //  (can be applied  \/
    //  to the client's
    //  current document)
    var pair = operation.constructor.transform(this.outstanding, operation);
    client.applyOperation(pair[1]);
    return new AwaitingConfirm(pair[0]);
  };

  AwaitingConfirm.prototype.serverAck = function (client) {
    // The client's operation has been acknowledged
    // => switch to synchronized state
    return synchronized_;
  };

  AwaitingConfirm.prototype.serverRetry = function (client) {
    client.sendOperation(this.outstanding);
    return this;
  };

  AwaitingConfirm.prototype.transformCursor = function (cursor) {
    return cursor.transform(this.outstanding);
  };

  // In the 'AwaitingWithBuffer' state, the client is waiting for an operation
  // to be acknowledged by the server while buffering the edits the user makes
  function AwaitingWithBuffer (outstanding, buffer) {
    // Save the pending operation and the user's edits since then
    this.outstanding = outstanding;
    this.buffer = buffer;
  }
  Client.AwaitingWithBuffer = AwaitingWithBuffer;

  AwaitingWithBuffer.prototype.applyClient = function (client, operation) {
    // Compose the user's changes onto the buffer
    var newBuffer = this.buffer.compose(operation);
    return new AwaitingWithBuffer(this.outstanding, newBuffer);
  };

  AwaitingWithBuffer.prototype.applyServer = function (client, operation) {
    // Operation comes from another client
    //
    //                       /\
    //     this.outstanding /  \ operation
    //                     /    \
    //                    /\    /
    //       this.buffer /  \* / pair1[0] (new outstanding)
    //                  /    \/
    //                  \    /
    //          pair2[1] \  / pair2[0] (new buffer)
    // the transformed    \/
    // operation -- can
    // be applied to the
    // client's current
    // document
    //
    // * pair1[1]
    var transform = operation.constructor.transform;
    var pair1 = transform(this.outstanding, operation);
    var pair2 = transform(this.buffer, pair1[1]);
    client.applyOperation(pair2[1]);
    return new AwaitingWithBuffer(pair1[0], pair2[0]);
  };

  AwaitingWithBuffer.prototype.serverRetry = function (client) {
    // Merge with our buffer and resend.
    var outstanding = this.outstanding.compose(this.buffer);
    client.sendOperation(outstanding);
    return new AwaitingConfirm(outstanding);
  };

  AwaitingWithBuffer.prototype.serverAck = function (client) {
    // The pending operation has been acknowledged
    // => send buffer
    client.sendOperation(this.buffer);
    return new AwaitingConfirm(this.buffer);
  };

  AwaitingWithBuffer.prototype.transformCursor = function (cursor) {
    return cursor.transform(this.outstanding).transform(this.buffer);
  };

  return Client;

}());

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

var firecalc = firecalc || { };

firecalc.SocialCalcAdapter = (function () {
  'use strict';
  
  var Operation = firecalc.Operation;
  var Cursor = firecalc.Cursor;
  
  var CursorStyleProperties = ['boxShadow','webkitBoxShadow','MozBoxShadow'];
  var CursorStyleInset = 2;

  function SocialCalcAdapter(SocialCalc, Spreadsheet, userId) {
    
    var self = this;
    this.SocialCalc_ = SocialCalc;
    this.ss_ = Spreadsheet;
    this.userId_ = userId;

    window.addEventListener('resize', function() {
      setTimeout(self.ss_.DoOnResize.bind(self.ss_), 0);
    });

    SocialCalc.OrigUpdateCellCSS = SocialCalc.UpdateCellCSS;
    SocialCalc.UpdateCellCSS = function(editor, cell, row, col) {
      if (!cell) return;
      var save = {};
      for (var i = 0; i < CursorStyleProperties.length; i++) {
        var styleProperty = CursorStyleProperties[i];
        if (typeof cell.element.style[styleProperty] !== undefined) {
          save[styleProperty] = cell.element.style[styleProperty];
        }
      }
      SocialCalc.OrigUpdateCellCSS.apply(SocialCalc, arguments);
      for (var k in save) {
        cell.element.style[k] = save[k];
      }
    };
    
    SocialCalc.OrigDoPositionCalculations = SocialCalc.DoPositionCalculations;
    SocialCalc.DoPositionCalculations = function(){
      var ref$;
      SocialCalc.OrigDoPositionCalculations.apply(SocialCalc, arguments);
      self.trigger('cursorRefresh');
    };
    SocialCalc.hadSnapshot = false;
    SocialCalc.OrigSizeSSDiv = SocialCalc.SizeSSDiv;
    SocialCalc.SizeSSDiv = function(spreadsheet){
      if (!(spreadsheet != null && spreadsheet.parentNode)) {
        return;
      }
      return SocialCalc.OrigSizeSSDiv(spreadsheet);
    };
    SocialCalc.Sheet.prototype.ScheduleSheetCommands = function(){
      return SocialCalc.ScheduleSheetCommands.apply(SocialCalc, [this].concat([].slice.call(arguments)));
    };
    SocialCalc.OrigScheduleSheetCommands = SocialCalc.ScheduleSheetCommands;
    SocialCalc.ScheduleSheetCommands = function(sheet, cmdstr, saveundo, isRemote){
      var ref$;
      cmdstr = cmdstr.replace(/\n\n+/g, '\n');
      if (!/\S/.test(cmdstr)) {
        return;
      }
      if (!isRemote && cmdstr !== 'redisplay' && cmdstr !== 'recalc') {
        self.trigger('operation', cmdstr);
      }
      return SocialCalc.OrigScheduleSheetCommands(sheet, cmdstr, saveundo, isRemote);
    };
    SocialCalc.MoveECell = function(editor, newcell){
      var highlights, ref$, cell, f;
      highlights = editor.context.highlights;
      if (editor.ecell) {
        if (editor.ecell.coord === newcell) {
          return newcell;
        }
        self.trigger('cursorActivity', new Cursor(newcell, editor.ecell.coord));
        cell = SocialCalc.GetEditorCellElement(editor, editor.ecell.row, editor.ecell.col);
        delete highlights[editor.ecell.coord];
        if (editor.range2.hasrange && editor.ecell.row >= editor.range2.top && editor.ecell.row <= editor.range2.bottom && editor.ecell.col >= editor.range2.left && editor.ecell.col <= editor.range2.right) {
          highlights[editor.ecell.coord] = 'range2';
        }
        editor.UpdateCellCSS(cell, editor.ecell.row, editor.ecell.col);
        editor.SetECellHeaders('');
        editor.cellhandles.ShowCellHandles(false);
      } else {
        self.trigger('cursorActivity', new Cursor(newcell));
      }
      newcell = editor.context.cellskip[newcell] || newcell;
      editor.ecell = SocialCalc.coordToCr(newcell);
      editor.ecell.coord = newcell;
      cell = SocialCalc.GetEditorCellElement(editor, editor.ecell.row, editor.ecell.col);
      highlights[newcell] = 'cursor';
      for (f in editor.MoveECellCallback) {
        editor.MoveECellCallback[f](editor);
      }
      editor.UpdateCellCSS(cell, editor.ecell.row, editor.ecell.col);
      editor.SetECellHeaders('selected');
      for (f in editor.StatusCallback) {
        editor.StatusCallback[f].func(editor, 'moveecell', newcell, editor.StatusCallback[f].params);
      }
      if (editor.busy) {
        editor.ensureecell = true;
      } else {
        editor.ensureecell = false;
        editor.EnsureECellVisible();
      }
      return newcell;
    };
  }

  SocialCalcAdapter.prototype.registerCallbacks = function (cb) {
    this.callbacks = cb;
  };

  SocialCalcAdapter.prototype.trigger = function (event) {
    var args = Array.prototype.slice.call(arguments, 1);
    var action = this.callbacks && this.callbacks[event];
    if (action) { action.apply(this, args); }
  };
  
  SocialCalcAdapter.prototype.getSnapshot = function() {
    return this.ss_.CreateSpreadsheetSave();
  };

  SocialCalcAdapter.prototype.loadSnapshot = function(data) {
    var parts = this.ss_.DecodeSpreadsheetSave(data);
    if (parts && parts != null && parts.sheet) {
      this.ss_.sheet.ResetSheet();
      this.ss_.ParseSheetSave(data.substring(parts.sheet.start, parts.sheet.end));
    }
  };

  SocialCalcAdapter.prototype.applyOperation = function(operation) {
    var operations = Array.isArray(operation) ? operation : [operation];
    this.executeOperations(operations);
  };
  
  SocialCalcAdapter.prototype.executeOperations = function(operations) {
    var line, cmdstr = (function(){
      var i$, len$, results$ = [];
      for (i$ = 0, len$ = operations.length; i$ < len$; ++i$) {
        line = operations[i$];
        if (typeof line != 'string') {
          line = line.data;
          if (!line) continue;
        }
        if (!/^re(calc|display)$/.test(line)) {
          results$.push(line);
        }
      }
      return results$;
    }.call(this)).join('\n');
    if (cmdstr.length) {
      var refreshCmd = 'recalc';
      this.ss_.context.sheetobj.ScheduleSheetCommands(cmdstr + "\n" + refreshCmd + "\n", true, true);
    } else {
      this.ss_.context.sheetobj.ScheduleSheetCommands("recalc\n", false, true);
    }
  };
  
  SocialCalcAdapter.prototype.updateCellElementStyleWithUsers = function(el, users) {
    if (!el || !users) return;
    var styles = [], i = 1;
    for (var userId in users) {
      var color = users[userId];
      styles.push('inset 0 0 0 ' + CursorStyleInset*i + 'px ' + color);
      i++;
    }
    var style = styles.join(',');
    for (var i = 0; i < CursorStyleProperties.length; i++) {
      var styleProperty = CursorStyleProperties[i];
      if (typeof el.style[styleProperty] !== undefined) {
        el.style[styleProperty] = style;
      }
    }
  };
    
  SocialCalcAdapter.prototype.addCursorToCellWithColor = function(cell, color, clientId) {
    if (!cell || !cell.element) return;
    var el = cell.element;
    el.users = el.users || {};
    if (el.users[clientId]) return;
    el.users[clientId] = color;
    this.updateCellElementStyleWithUsers(el, el.users);
  };

  SocialCalcAdapter.prototype.removeCursorFromCellWithColor = function(cell, clientId) {
    if (!cell || !cell.element) return;
    var el = cell.element;
    el.users = el.users || {};
    if (el.users[clientId]) {
      delete el.users[clientId];
      this.updateCellElementStyleWithUsers(el, el.users);
    }
  };
  
  SocialCalcAdapter.prototype.setOtherCursor = function (cursor, color, clientId) {
    var editor = this.ss_.editor;
    var peerClass = clientId;
    var find = new RegExp(peerClass, 'g');
    var origCR, origCell, cr, cell, ref$;
    if (cursor.original) {
      origCR = SocialCalc.coordToCr(cursor.original);
      origCell = SocialCalc.GetEditorCellElement(editor, origCR.row, origCR.col);
      this.removeCursorFromCellWithColor(origCell, clientId);
      if (cursor.original === editor.ecell.coord || cursor.ecell === editor.ecell.coord) {
        this.trigger('cursorActivity', new Cursor(editor.ecell.coord));
      }
    }
    cr = SocialCalc.coordToCr(cursor.ecell);
    cell = SocialCalc.GetEditorCellElement(editor, cr.row, cr.col);
    this.addCursorToCellWithColor(cell, color, clientId);
    return { clear: this.removeCursorFromCellWithColor.bind(this, cell, clientId) };
  };
  
  /*
  SocialCalcAdapter.prototype.applyOperationToSocialCalc = function(operation) {
    var user, ref$, ecell, peerClass, find, cr, cell, origCR, origCell, parts, cmdstr, line, refreshCmd;
    var SocialCalc = SocialCalc || this.SocialCalc_;
    var ss = this.ss_, editor = ss.editor, data = operation.data;
    switch (operation.type) {
      case 'ecells':
        for (user in ref$ = data.ecells) {
          ecell = ref$[user];
          if (user === this.userId_) {
            continue;
          }
          peerClass = " " + user + " defaultPeer";
          find = new RegExp(peerClass, 'g');
          cr = SocialCalc.coordToCr(ecell);
          cell = SocialCalc.GetEditorCellElement(editor, cr.row, cr.col);
          if ((cell != null ? cell.element.className.search(find) : void 8) === -1) {
            cell.element.className += peerClass;
          }
        }
        break;
      case 'ecell':
        // TODO: this is the cursor implementation
        return;
        peerClass = " " + data.user + " defaultPeer";
        find = new RegExp(peerClass, 'g');
        if (data.original) {
          origCR = SocialCalc.coordToCr(data.original);
          origCell = SocialCalc.GetEditorCellElement(editor, origCR.row, origCR.col);
          origCell.element.className = origCell.element.className.replace(find, '');
          if (data.original === editor.ecell.coord || data.ecell === editor.ecell.coord) {
            SocialCalc.Callbacks.broadcast('ecell', {
              to: data.user,
              ecell: editor.ecell.coord
            });
          }
        }
        cr = SocialCalc.coordToCr(data.ecell);
        cell = SocialCalc.GetEditorCellElement(editor, cr.row, cr.col);
        if ((cell != null ? (ref$ = cell.element) != null ? ref$.className.search(find) : void 8 : void 8) === -1) {
          cell.element.className += peerClass;
        }
        break;
      case 'log':
        cmdstr = (function(){
          var i$, ref$, len$, results$ = [];
          if (!data.log) return results$;
          for (i$ = 0, len$ = (ref$ = data.log).length; i$ < len$; ++i$) {
            line = ref$[i$];
            if (typeof line != 'string') {
              line = line.data;
              if (!line) continue;
            }
            if (!/^re(calc|display)$/.test(line)) {
              results$.push(line);
            }
          }
          return results$;
        }.call(this)).join('\n');
        if (cmdstr.length) {
          refreshCmd = 'recalc';
          ss.context.sheetobj.ScheduleSheetCommands(cmdstr + "\n" + refreshCmd + "\n", true, true);
        } else {
          ss.context.sheetobj.ScheduleSheetCommands("recalc\n", false, true);
        }
        break;
      case 'recalc':
        if (data.force) {
          SocialCalc.Formula.SheetCache.sheets = {};
          if (ss != null) {
            ss.sheet.recalconce = true;
          }
        }
        if (data.snapshot) {
          parts = ss.DecodeSpreadsheetSave(data.snapshot);
        }
        if (parts != null && parts.sheet) {
          SocialCalc.RecalcLoadedSheet(data.room, data.snapshot.substring(parts.sheet.start, parts.sheet.end), true);
          ss.context.sheetobj.ScheduleSheetCommands("recalc\n", false, true);
        } else {
          SocialCalc.RecalcLoadedSheet(data.room, '', true);
        }
        break;
      case 'execute':
        ss.context.sheetobj.ScheduleSheetCommands(data, true, true);
        if (ss.currentTab === ((ref$ = ss.tabnums) != null ? ref$.graph : void 8)) {
          setTimeout(function(){
            return window.DoGraph(false, false);
          }, 100);
        }
        break;
    }
  };*/

  return SocialCalcAdapter;
}());

var firecalc = firecalc || { };

firecalc.Firecalc = (function(global) {
  var FirebaseAdapter = firecalc.FirebaseAdapter;
  var SocialCalcAdapter = firecalc.SocialCalcAdapter;
  var EditorClient = firecalc.EditorClient;
  var utils = firecalc.utils;
  var SocialCalc = (window && window.SocialCalc) || global.SocialCalc;

  function Firecalc(ref, place, options) {
    if (!(this instanceof Firecalc)) { return new Firecalc(ref, place, options); }

    if (!SocialCalc) {
      throw new Error('Couldn\'t find SocialCalc');
    }

    this.ss_ = new SocialCalc.SpreadsheetControl();
    if (this.ss_.tabs) {
      this.ss_.tabnums.graph = this.ss_.tabs.length;
    }
    if (typeof this.ss_.InitializeSpreadsheetViewer === 'function') {
      this.ss_.InitializeSpreadsheetViewer(place, 0, 0, 0);
    }
    if (typeof this.ss_.InitializeSpreadsheetControl === 'function') {
      this.ss_.InitializeSpreadsheetControl(place, 0, 0, 0);
    }
    if (typeof this.ss_.ExecuteCommand === 'function') {
      this.ss_.ExecuteCommand('redisplay', '');
    }
    /*if (typeof this.ss_.ExecuteCommand === 'function') {
      this.ss_.ExecuteCommand('set sheet defaulttextvalueformat text-wiki');
    }*/


    // Provide an easy way to get the firecalc instance associated with this CodeMirror instance.
    this.ss_.firecalc = this;

    this.options_ = options || { };

    var userId = (options && options.userId) || ref.push().name();
    var userColor = (options && options.userColor) || colorFromUserId(userId);

    this.firebaseAdapter_ = new FirebaseAdapter(ref, userId, userColor);
    this.ssAdapter_ = new SocialCalcAdapter(SocialCalc, this.ss_, userId);
    this.client_ = new EditorClient(this.firebaseAdapter_, this.ssAdapter_);

    var self = this;
    this.firebaseAdapter_.on('ready', function() {
      self.ready_ = true;
      self.trigger('ready');
    });
  }

  utils.makeEventEmitter(Firecalc);

  Firecalc.prototype.dispose = function() {
    this.zombie_ = true; // We've been disposed.  No longer valid to do anything.
    this.ss_.firecalc = null;
    this.firebaseAdapter_.dispose();
  };

  Firecalc.prototype.setUserId = function(userId) {
    this.firebaseAdapter_.setUserId(userId);
  };

  Firecalc.prototype.setUserColor = function(color) {
    this.firebaseAdapter_.setColor(color);
  };

  Firecalc.prototype.isHistoryEmpty = function() {
    this.assertReady_('isHistoryEmpty');
    return this.firebaseAdapter_.isHistoryEmpty();
  };

  Firecalc.prototype.assertReady_ = function(funcName) {
    if (!this.ready_) {
      throw new Error('You must wait for the "ready" event before calling ' + funcName + '.');
    }
    if (this.zombie_) {
      throw new Error('You can\'t use a Firecalc after calling dispose()!');
    }
  };

  function colorFromUserId (userId) {
    var a = 1;
    for (var i = 0; i < userId.length; i++) {
      a = 17 * (a+userId.charCodeAt(i)) % 360;
    }
    var hue = a/360;

    return hsl2hex(hue, 1, 0.85);
  }

  function rgb2hex (r, g, b) {
    function digits (n) {
      var m = Math.round(255*n).toString(16);
      return m.length === 1 ? '0'+m : m;
    }
    return '#' + digits(r) + digits(g) + digits(b);
  }

  function hsl2hex (h, s, l) {
    if (s === 0) { return rgb2hex(l, l, l); }
    var var2 = l < 0.5 ? l * (1+s) : (l+s) - (s*l);
    var var1 = 2 * l - var2;
    var hue2rgb = function (hue) {
      if (hue < 0) { hue += 1; }
      if (hue > 1) { hue -= 1; }
      if (6*hue < 1) { return var1 + (var2-var1)*6*hue; }
      if (2*hue < 1) { return var2; }
      if (3*hue < 2) { return var1 + (var2-var1)*6*(2/3 - hue); }
      return var1;
    };
    return rgb2hex(hue2rgb(h+1/3), hue2rgb(h), hue2rgb(h-1/3));
  }

  return Firecalc;
})(this);
return firecalc.Firecalc; })();