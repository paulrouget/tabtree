'use strict';

const h = require('virtual-dom/h');
const diff = require('virtual-dom/diff');
const patch = require('virtual-dom/patch');
const createElement = require('virtual-dom/create-element');

const CSS = `

  .container {
    width: 120px;
    display: flex;
    height: 100vh;
    background: #0A3741;
    color: #596E75;
    flex-direction: column;
    -moz-window-dragging: drag;
  }

  .tab {
    display: flex;
    lineHeight: 14px;
    fontWeight: lighter;
    padding: 6px;
    cursor: default;
    border-bottom: 0.5px solid #022B36;
    white-space: nowrap;
  }

  .tab:hover {
    background-color: #022B36;
  }

  .tab.selected {
    background: #022B36;
    color: #FDF7E5;
  }

  .favicon {
    image-rendering: -moz-crisp-edges;
    width: 16px;
    height: 16px;
    flex-shrink: 0px;
  }

  .title {
    font-size: 10px;
    flex-grow: 1;
    margin: 0 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 16px;
  }

  .close {
    font-family: FontIon;
    text-align: center;
    vertical-align: middle;
    flex-shrink: 0;
    width: 16px;
    line-height: 16px;
  }

  .spinner {
    flex-shrink: 0;
    font-family: FontIon;
    width: 16px;
    line-height: 16px;
    text-align: center;
    color: #86981C;
    animation-name: spinner;
    animation-duration: 500ms;
    animation-iteration-count: infinite;
    animation-timing-function: linear;
  }

  @keyframes spinner {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @font-face {
    font-family: 'FontIon';
    src: url('./css/ionicons.woff');
    font-weight: normal;
    font-style: normal;
  }

`;

var gTabtree = null;
var tree = null;
var rootNode = null;

function init(parent, tabtree) {
  gTabtree = tabtree;
  var vstyle = h('style', {scroped: true}, CSS);
  var style = createElement(vstyle);
  parent.appendChild(style);
  tree = render();
  rootNode = createElement(tree);
  parent.appendChild(rootNode);
  tabtree.on('tree-layout-changed', scheduleDOMUpdate);
  tabtree.on('selected-tab-changed', scheduleDOMUpdate);
  tabtree.on('tab-update', scheduleDOMUpdate);
}

function render() {
  var children = [];
  gTabtree.root.walk(n => {
    if (!n.tab) return; // root
    var tab = n.tab;

    var title =
      tab.empty ? 'New tab' :
      tab.title ? tab.title :
      tab.loading ? 'Loading…' :
      tab.location;

    children.push(h('div.tab', {
      className: tab.selected ? ' selected' : '',
      style: { 
        paddingLeft: `${n.getDepth() * 10}px`,
      }
    }, [
      tab.loading ?
        h('div.spinner', '\uf29C') :
        h('img.favicon', {src: tab.favicon, alt: ''}),
      h('span', {className: 'title'}, title),
    ]));
  });
  return h('div.container', children);
}

var DOMUpdateScheduled = false;
function scheduleDOMUpdate() {
  if (!DOMUpdateScheduled) {
    window.requestAnimationFrame(function() {
      var s0 = window.performance.now();
      DOMUpdateScheduled = false;
      var newTree = render();
      var patches = diff(tree, newTree);
      tree = newTree;
      rootNode = patch(rootNode, patches);
      var s1 = window.performance.now();
      // console.log("rendering: " + Math.round(s1 - s0) + "ms");
    });
    DOMUpdateScheduled = true;
  }
}

exports.init = init;
