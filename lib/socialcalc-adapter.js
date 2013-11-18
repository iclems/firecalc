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

    // HACK: sounds like SocialCalc.UpdateCellCSS has issues with vendor-spec? 
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
