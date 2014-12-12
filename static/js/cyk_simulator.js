<script type="text/javascript">
    
    function array_index_of(a, e) {
      if (a != null) {
        for (var i = 0; i < a.length; ++i) {
          if (a[i] == e)
            return i;
        }
      }
      return -1;
    }
    
    function merge_arrays(a, b) {
      for (var i = 0; i < b.length; ++i) {
        if (array_index_of(a, b[i]) == -1) {
          a.push(b[i]);
        }
      }
    }
    
    function Grammar(grammar) {
      this._terminal_rules = new Array();
      this._non_terminal_rules = new Array();
      
      var re_rule = /^(\w+)\s*->\s*(\w+)(?:\s+(\w+))?\s*\.?$/;
      grammar = grammar.split(/\r?\n/);
      
      for (var i = 0; i < grammar.length; ++i) {
        var r = grammar[i];
        if (r.length == 0)
          continue;
        var a = re_rule.exec(r);
        if (a == null)
          throw "bad rule syntax: " + r;
        
        if (a[3]) {
          var new_rule = new Array(a[1], a[2], a[3]);
          this._non_terminal_rules.push(new_rule);
          if (this._s == null)
            this._s = new String(a[1]);
        }
        else
        {
          var new_rule = new Array(a[1], a[2]);
          this._terminal_rules.push(new_rule);
        }
      }
      
      this.start_symbol = function() { return this._s; }
      
      this.left_hand_sides = function(s) {
        var res = new Array();
        for (var i = 0; i < this._terminal_rules.length; ++i) {
          var r = this._terminal_rules[i];
          if (r[1] == s)
            res.push(r[0]);
        }
        return res;
      }
      
      this.left_hand_sides2 = function(s, t) {
        var res = new Array();
        for (var i = 0; i < this._non_terminal_rules.length; ++i) {
          var r = this._non_terminal_rules[i];
          if (r[1] == s && r[2] == t)
            res.push(r[0]);
        }
        return res;
      }
      
      return this;
    }
    
    function tokenize_sentence(sentence) {
      var s = sentence.split(/\s+/);
      return s;
    }
    
    function allocate_chart(N) {
      var c = new Array(N + 1);
      c[0] = new Array(N);
      for (var i = 1; i <= N; ++i) {
        c[i] = new Array(N - (i - 1));
      }
      return c;
    }
    
    function cky_offline(grammar, sentence, eh) {
      var G = new Grammar(grammar);
      var S = tokenize_sentence(sentence);
      var N = S.length;
      var C = allocate_chart(N);
      
      eh.start(S);
      
      for (var j = 0; j < N; ++j) {
        eh.active_cell_changed(0, j);
        C[0][j] = G.left_hand_sides(S[j]);
        eh.cell_updated(0, j, C[0][j]);
      }
      
      for (var i = 1; i < N; ++i) {
        for (var j = 0; j < N - i; ++j) {
          var nt = C[i][j];
          
          eh.active_cell_changed(i, j);
          
          for (var k = i - 1; k >= 0; --k) {
            var nts1 = C[k][j];
            var nts2 = C[i - k - 1][j + k + 1];
            
            eh.attempt_match(k, j, i - k - 1, j + k + 1);
            
            if (nts1 != null && nts2 != null) {
              for (var ii = 0; ii < nts1.length; ++ii) {
                var nt1 = nts1[ii];
                
                for (var jj = 0; jj < nts2.length; ++jj) {
                  var nt2 = nts2[jj];
                  var rhss = G.left_hand_sides2(nt1, nt2);
                  if (rhss == 0 || rhss.length == 0)
                    continue;
                  if (nt == null) {
                    nt = new Array();
                    C[i][j] = nt;
                  }
                  
                  merge_arrays(nt, rhss);
                  eh.found_match(k, j, i - k - 1, j + k + 1);
                  eh.cell_updated(i, j, nt);
                }
              }
            }
          }
        }
      }
      
      var accepted = array_index_of(C[N - 1][0], G.start_symbol()) != -1;
      eh.end(accepted);
      return accepted;
    }

    </script>
    
    <script>
    
    var COLOR_NORMAL_CELL   = "#FFFFCC";
    var COLOR_ACTIVE_CELL   = "red";
    var COLOR_TEST_CELL     = "gray";
    var COLOR_MATCH_CELL    = "blue";
    var COLOR_UPDATE_CELL   = "pink";
    
    var UPDATE_INTERVAL = 100;
    var _update_actions = new Array();
    var _update_action_idx = 0;
    
    var _active_cell = [-1,-1];
    var _context_cells = [-1,-1,-1,-1];
    
    var _update_timer_id = -1;
    
    var _is_animation_running = false;
    
    
    function paint_cell(i, j, color) {
      var cell = entry2cell(i, j);
      cell.bgColor = color;
    }
    
    function dump_object(o) {
      var s = "";
      for (var p in o) { s += p + ":" + o[p] + ";  "; }
      alert(s);
    }
    
    function update_ui() {
      if (_update_action_idx == _update_actions.length) {
        clearInterval(_update_timer_id);
        _update_action_idx = 0;
        _is_animation_running = false;
        window.status = "Animation done. Click on the chart to restart";
        return;
      }
      var action = _update_actions[_update_action_idx++];
      if (action == "--")
        return; // sleep for a while
      eval(action);
    }
    
    function set_entry_content(i, j, content) {
      var cell = entry2cell(i, j);
      cell.innerHTML = content;
    }
    
    function entry2cell(i, j) {
      return tchart.rows.item(tchart.rows.length - 1 - i).cells.item(j);
    }
    
    function do_parse() {
      var cky_event_handler = new Object();
      
      cky_event_handler.start = function(s) {
        create_chart(s);
        set_sentence(s);
        cky_input.style.display = "none";
        cky_output.style.display = "block";
        cky_output.focus();
      }
      
      cky_event_handler.end = function(accepted) {
        var s = "paint_cell("+_context_cells[0]+","+_context_cells[1]+",COLOR_NORMAL_CELL);";
        s += "paint_cell("+_context_cells[2]+","+_context_cells[3]+",COLOR_NORMAL_CELL);";
        s += "paint_cell("+_active_cell[0]+","+_active_cell[1]+",COLOR_NORMAL_CELL);";
        
        _update_actions.push(s);
        _update_action_idx = 0;
        
        pause_resume_animation();
      }
      
      cky_event_handler.cell_updated = function(i, j, content) {
        _update_actions.push("paint_cell("+i+","+j+",COLOR_ACTIVE_CELL);" + 
          "set_entry_content("+i+","+j+",\""+content +"\");");
        _update_actions.push("--");
        _update_actions.push("--");
        _update_actions.push("--");
        _update_actions.push("--");
      }
      
      cky_event_handler.active_cell_changed = function(i, j) {
        var s = "";
        if (_context_cells[0] != -1) {
          s += "paint_cell("+_context_cells[0]+","+_context_cells[1]+",COLOR_NORMAL_CELL);";
          s += "paint_cell("+_context_cells[2]+","+_context_cells[3]+",COLOR_NORMAL_CELL);";
        }
        if (_active_cell[0] != -1) {
          s += "paint_cell("+_active_cell[0]+","+_active_cell[1]+",COLOR_NORMAL_CELL);";
        }
        s += "paint_cell("+i+","+j+",COLOR_ACTIVE_CELL);";
        _active_cell[0] = i;
        _active_cell[1] = j;
        _update_actions.push(s);
      }
      
      cky_event_handler.attempt_match = function(i, j, k, l) {
        var s = "";
        if (_context_cells[0] != -1) {
          s += "paint_cell("+_context_cells[0]+","+_context_cells[1]+",COLOR_NORMAL_CELL);";
          s += "paint_cell("+_context_cells[2]+","+_context_cells[3]+",COLOR_NORMAL_CELL);";
        }
        s += "paint_cell("+i+","+j+",COLOR_TEST_CELL);";
        s += "paint_cell("+k+","+l+",COLOR_TEST_CELL);";
        _update_actions.push(s);
        _context_cells[0] = i;
        _context_cells[1] = j;
        _context_cells[2] = k;
        _context_cells[3] = l;
      }
      
      cky_event_handler.found_match = function(i, j, k, l) {
        var s = "";
        s += "paint_cell("+i+","+j+",COLOR_MATCH_CELL);";
        s += "paint_cell("+k+","+l+",COLOR_MATCH_CELL);";
        s += "paint_cell("+_active_cell[0]+","+_active_cell[1]+",COLOR_MATCH_CELL);";
        _update_actions.push(s);
        _update_actions.push("--");
        _update_actions.push("--");
      }
      
      try {
        cky_offline(idgram.value, idsen.value, cky_event_handler);
      }
      catch (e) {
        alert(e);
        return;
      }
    }
    
    function create_chart(s) {
      var n = s.length;
      var tb = tchart.firstChild;
      if (tb == null || typeof(tb) == 'undefined') {
        tb = document.createElement("TBODY");
        tchart.appendChild(tb);
      }
      
      for (var i = 0; i < n; ++i) {
        var row = document.createElement("TR");
        tb.appendChild(row);
        for (var j = 0; j <= i; ++j) {
          var cell = document.createElement("TD");
          row.appendChild(cell);
          
          cell.setAttribute("width", (1 / n) * 100.00 + "%");
          cell.setAttribute("align", "center");
          cell.setAttribute("bgColor", COLOR_NORMAL_CELL);
          cell.innerHTML = "&nbsp;";
        }
      }
    }
    
    function set_sentence(s) {
      var n = s.length;      
      var tb = tsentence.firstChild;
      if (tb == null || typeof(tb) == 'undefined') {
        tb = document.createElement("TBODY");
        tsentence.appendChild(tb);
      }
      var row = document.createElement("TR");
      tb.appendChild(row);
      
      for (var i = 0; i < n; ++i) {
        var cell = document.createElement("TD");
        row.appendChild(cell);
        cell.setAttribute("width", (1 / n) * 100.00 + "%");
        cell.setAttribute("align", "center");
        cell.innerHTML = s[i];
      }
    }
    
    function delete_chart() {
      cky_input.style.display = "block";
      cky_output.style.display = "none";
      
      clearInterval(_update_timer_id);
      _update_actions = new Array();
      
      tchart.removeChild(tchart.firstChild);
      tsentence.removeChild(tsentence.firstChild);
    }
    
    function clear_chart() {
      var cells = tchart.getElementsByTagName("TD");
      for (var i = 0; i < cells.length; ++i) {
        cells[i].innerHTML = "&nbsp;";
      }
    }
    
    function pause_resume_animation() {
      if (_is_animation_running) {
        clearInterval(_update_timer_id);
        window.status = "Animation paused. Click on the chart to resume";
      }
      else {
        if (_update_action_idx == 0)
          clear_chart();
        _update_timer_id = setInterval("update_ui()", UPDATE_INTERVAL);
        window.status = "Animation running. Click on the chart to pause";
      }
      _is_animation_running = !_is_animation_running;
    }
    
    function chart_key_handler(event) {
      switch (event.keyCode) {
        case 0x0D:  // enter
        case 0x20:  // space
          pause_resume_animation();
          break;
        case 0x1B: // escape
          delete_chart();
          window.status = "";
          _is_animation_running = false;
          clearInterval(_update_timer_id);
          break;
        default:
          return false; // give the other handlers chance to process the event
      }
      return true;
    }
    
    </script>