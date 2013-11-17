var firecalc = firecalc || { };

firecalc.SocialCalcAdapter = (function () {
  'use strict';


  function SocialCalcAdapter(SocialCalc, Spreadsheet, userId) {
    
    var self = this;
    this.SocialCalc_ = SocialCalc;
    this.ss_ = Spreadsheet;
    this.userId_ = userId;
    
    SocialCalc.OrigDoPositionCalculations = SocialCalc.DoPositionCalculations;
    /*SocialCalc.DoPositionCalculations = function(){
      var ref$;
      SocialCalc.OrigDoPositionCalculations.apply(SocialCalc, arguments);
      if (typeof (ref$ = SocialCalc.Callbacks).broadcast === 'function') {
        ref$.broadcast('ask.ecell');
      }
    };*/
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
        self.trigger('execute', {
          cmdstr: cmdstr,
          saveundo: saveundo
        });
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
        self.trigger('ecell', {
          original: editor.ecell.coord,
          ecell: newcell
        });
        cell = SocialCalc.GetEditorCellElement(editor, editor.ecell.row, editor.ecell.col);
        delete highlights[editor.ecell.coord];
        if (editor.range2.hasrange && editor.ecell.row >= editor.range2.top && editor.ecell.row <= editor.range2.bottom && editor.ecell.col >= editor.range2.left && editor.ecell.col <= editor.range2.right) {
          highlights[editor.ecell.coord] = 'range2';
        }
        editor.UpdateCellCSS(cell, editor.ecell.row, editor.ecell.col);
        editor.SetECellHeaders('');
        editor.cellhandles.ShowCellHandles(false);
      } else {
        self.trigger('ecell', {
          ecell: newcell
        });
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

  SocialCalcAdapter.prototype.applyOperation = function(operation) {
    if (Array.isArray(operation)) {
      this.applyOperationToSocialCalc({ type: 'log', data: { log: operation } });
    } else {
      this.applyOperationToSocialCalc(operation);
    }
  };
  
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
          /* TODO: what should we do with that?
          if (data.original === editor.ecell.coord || data.ecell === editor.ecell.coord) {
            SocialCalc.Callbacks.broadcast('ecell', {
              to: data.user,
              ecell: editor.ecell.coord
            });
          }
          */
        }
        cr = SocialCalc.coordToCr(data.ecell);
        cell = SocialCalc.GetEditorCellElement(editor, cr.row, cr.col);
        if ((cell != null ? (ref$ = cell.element) != null ? ref$.className.search(find) : void 8 : void 8) === -1) {
          cell.element.className += peerClass;
        }
        break;
      case 'log':
/*        if (SocialCalc.hadSnapshot) {
          break;
        }
        SocialCalc.hadSnapshot = true;
        */
        if (data.snapshot) {
          parts = ss.DecodeSpreadsheetSave(data.snapshot);
        }
        if (parts && parts != null && parts.sheet) {
          ss.sheet.ResetSheet();
          ss.ParseSheetSave(data.snapshot.substring(parts.sheet.start, parts.sheet.end));
        }
        cmdstr = (function(){
          var i$, ref$, len$, results$ = [];
          for (i$ = 0, len$ = (ref$ = data.log).length; i$ < len$; ++i$) {
            line = ref$[i$];
            line = (typeof line == 'string') ? line : line.data.cmdstr;
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
        ss.context.sheetobj.ScheduleSheetCommands(data.cmdstr, data.saveundo, true);
        /*if (ss.currentTab === ((ref$ = ss.tabnums) != null ? ref$.graph : void 8)) {
          setTimeout(function(){
            return window.DoGraph(false, false);
          }, 100);
        }*/
        break;
    }
  };

  return SocialCalcAdapter;
}());
