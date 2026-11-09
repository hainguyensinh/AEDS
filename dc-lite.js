/* dc-lite: a small standalone renderer for the exported .dc.html screens.
   Reads the <template id="dc-tpl"> markup and the <script data-dc-script> logic
   class, then renders them with React. Supports {{holes}}, sc-if, sc-for and
   on* event handlers, which is all these screens use. */
(function () {
  'use strict';
  var R = window.React, h = R.createElement;

  function DCLogic(props) { R.Component.call(this, props); this.state = this.state || {}; }
  DCLogic.prototype = Object.create(R.Component.prototype);
  DCLogic.prototype.constructor = DCLogic;
  window.DCLogic = DCLogic;

  var HOLE = /\{\{([^}]*)\}\}/g, WHOLE = /^\s*\{\{([^}]*)\}\}\s*$/;

  function lookup(scope, path) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return +path;
    if (/^(['"]).*\1$/.test(path)) return path.slice(1, -1);
    var parts = path.split('.');
    for (var i = scope.length - 1; i >= 0; i--) {
      var frame = scope[i];
      if (frame && Object.prototype.hasOwnProperty.call(frame, parts[0])) {
        var v = frame[parts[0]];
        for (var j = 1; j < parts.length; j++) v = v == null ? undefined : v[parts[j]];
        return v;
      }
    }
    return undefined;
  }
  function interp(str, scope) {
    var m = WHOLE.exec(str);
    if (m) return lookup(scope, m[1]);
    return str.replace(HOLE, function (_, p) { var v = lookup(scope, p); return v == null ? '' : String(v); });
  }

  var ATTR = { 'class': 'className', 'for': 'htmlFor', tabindex: 'tabIndex', readonly: 'readOnly', maxlength: 'maxLength',
    colspan: 'colSpan', rowspan: 'rowSpan', autocomplete: 'autoComplete', autofocus: 'autoFocus', srcset: 'srcSet',
    crossorigin: 'crossOrigin', contenteditable: 'contentEditable', spellcheck: 'spellCheck', inputmode: 'inputMode',
    novalidate: 'noValidate', enctype: 'encType', minlength: 'minLength', datetime: 'dateTime' };
  var EVENTS = {};
  ['Click', 'DoubleClick', 'Change', 'Input', 'Focus', 'Blur', 'KeyDown', 'KeyUp', 'KeyPress', 'Submit', 'MouseEnter',
    'MouseLeave', 'MouseDown', 'MouseUp', 'MouseOver', 'MouseOut', 'Scroll', 'Wheel', 'PointerDown', 'PointerUp', 'ContextMenu'
  ].forEach(function (e) { EVENTS['on' + e.toLowerCase()] = 'on' + e; });
  var BOOL = { disabled: 1, checked: 1, readOnly: 1, hidden: 1, multiple: 1, required: 1, selected: 1, open: 1, autoFocus: 1, noValidate: 1 };
  var TABLEISH = { TABLE: 1, TBODY: 1, THEAD: 1, TFOOT: 1, TR: 1, SELECT: 1, COLGROUP: 1 };
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function camel(s) { return s.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); }); }
  function parseStyle(css) {
    var out = {};
    String(css).split(';').forEach(function (decl) {
      var i = decl.indexOf(':');
      if (i < 0) return;
      var k = decl.slice(0, i).trim(), v = decl.slice(i + 1).trim();
      if (!k) return;
      out[k.indexOf('--') === 0 ? k : camel(k)] = v;
    });
    return out;
  }

  function renderNodes(nodes, scope, parentTag) {
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var r = renderNode(nodes[i], scope, parentTag, i);
      if (r == null) continue;
      if (Array.isArray(r)) out.push.apply(out, r); else out.push(r);
    }
    return out;
  }

  function renderNode(node, scope, parentTag, idx) {
    if (node.nodeType === 3) {
      var t = node.nodeValue;
      if (TABLEISH[parentTag] && !t.trim()) return null;
      if (t.indexOf('{{') < 0) return t;
      var v = interp(t, scope);
      return v == null || v === false || v === true ? '' : String(v);
    }
    if (node.nodeType !== 1) return null;
    var tag = node.tagName;
    if (tag === 'TEMPLATE' && node.hasAttribute('data-sc')) {
      var kind = node.getAttribute('data-sc');
      if (kind === 'if') {
        var cond = interp(node.getAttribute('value') || '', scope);
        return cond ? h(R.Fragment, { key: 'i' + idx }, renderNodes(node.content.childNodes, scope, parentTag)) : null;
      }
      if (kind === 'for') {
        var list = interp(node.getAttribute('list') || '', scope) || [];
        var as = node.getAttribute('as') || 'item';
        return h(R.Fragment, { key: 'f' + idx }, list.map(function (item, n) {
          var frame = { $index: n }; frame[as] = item;
          return h(R.Fragment, { key: n }, renderNodes(node.content.childNodes, scope.concat([frame]), parentTag));
        }));
      }
    }
    var isSvg = node.namespaceURI === SVG_NS;
    var name = isSvg ? node.tagName : tag.toLowerCase();
    var props = { key: 'e' + idx }, hasChange = false;
    for (var a = 0; a < node.attributes.length; a++) {
      var at = node.attributes[a], an = at.name, av = at.value;
      if (an.indexOf('hint-') === 0) continue;
      var val = av.indexOf('{{') >= 0 ? interp(av, scope) : av;
      if (EVENTS[an]) { if (EVENTS[an] === 'onChange' || EVENTS[an] === 'onInput') hasChange = true; if (typeof val === 'function') props[EVENTS[an]] = val; continue; }
      if (an === 'style') { props.style = typeof val === 'string' ? parseStyle(val) : val; continue; }
      var key = ATTR[an] || an;
      if (isSvg && an.indexOf('-') > 0 && an.indexOf('aria-') !== 0 && an.indexOf('data-') !== 0) key = camel(an);
      if (BOOL[key] && val === '') val = true;
      props[key] = val;
    }
    if (name === 'input' || name === 'textarea' || name === 'select') {
      if (!hasChange) {
        if ('value' in props) { props.defaultValue = props.value; delete props.value; }
        if ('checked' in props) { props.defaultChecked = !!props.checked; delete props.checked; }
      }
    }
    if (name === 'option' && 'selected' in props) delete props.selected;
    if (name === 'select' && !('defaultValue' in props) && !('value' in props)) {
      var opts = node.querySelectorAll('option');
      for (var o = 0; o < opts.length; o++) if (opts[o].hasAttribute('selected')) { props.defaultValue = opts[o].getAttribute('value') || opts[o].textContent; break; }
    }
    if (name === 'textarea') {
      if (!('defaultValue' in props) && !('value' in props)) props.defaultValue = interp(node.textContent, scope);
      return h(name, props);
    }
    var kids = renderNodes(node.childNodes, scope, tag);
    if (/^(input|img|br|hr|meta|link|source|col|area|wbr|embed|track|param)$/.test(name)) return h(name, props);
    return h.apply(null, [name, props].concat(kids));
  }

  function boot() {
    var tpl = document.getElementById('dc-tpl');
    var scriptEl = document.querySelector('script[data-dc-script]');
    var mount = document.getElementById('dc-root');
    if (!tpl || !mount) return;
    var props = {};
    try {
      var decl = JSON.parse(scriptEl && scriptEl.getAttribute('data-props') || '{}');
      Object.keys(decl).forEach(function (k) { if (k[0] !== '$' && decl[k] && 'default' in decl[k]) props[k] = decl[k]['default']; });
    } catch (e) { /* no props */ }
    var Logic = DCLogic;
    if (scriptEl) Logic = new Function('DCLogic', 'React', scriptEl.textContent + '\n;return Component;')(DCLogic, R);
    // Class syntax cannot be called without new, so build a real subclass.
    var Host = (new Function('Base', 'h', 'R', 'renderNodes', 'tpl',
      'return class Host extends Base { render() { var v = this.renderVals ? this.renderVals() || {} : {}; return h(R.Fragment, null, renderNodes(tpl.content.childNodes, [v], "DIV")); } };'))(Logic, h, R, renderNodes, tpl);
    window.ReactDOM.createRoot(mount).render(h(Host, props));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
