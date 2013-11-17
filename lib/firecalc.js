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