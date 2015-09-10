'use strict';

const EventEmitter = require('event-emitter');
const AllOff = require('event-emitter/all-off');
const {getFallback, getBestIcon} = require('../common/favicon');

const {RegisterKeyBindings} = require('../common/keybindings');
const OS = require('../common/os');

const IS_PRIVILEGED = !!HTMLIFrameElement.prototype.setVisible;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

const HOMEPAGE = 'http://mozilla.com';

const CSS = `

  iframe {
    border: 0;
    flex-grow: 1;
  }

  .tabiframe {
    display: flex;
    flex-grow: 1;
  }

  .tabiframe[hidden='true'] {
    display: none;
  }

`;


function TabTree(parentDOMNode) {
  EventEmitter(this);
  this._root = new TreeNode();

  this.onMozBrowserOpenWindow = this.onMozBrowserOpenWindow.bind(this);
  this.onMozBrowserOpenTab = this.onMozBrowserOpenTab.bind(this);
  this.onTabUpdate = this.onTabUpdate.bind(this);

  var style = document.createElement('style');
  style.setAttribute('scoped', 'scoped');
  style.textContent = CSS;
  parentDOMNode.appendChild(style);
  this._parentDOMNode = parentDOMNode;
  this.restoreSession();
  this._setupKeybindings();
}

exports.TabTree = TabTree;

TabTree.prototype = {

  toString: function() {
    var string = '';
    this._root.walk(n => {
      if (n.tab) {
        var depth = n.getDepth();
        var spaces = '';
        while (depth--) spaces += '   ';
        string += '\n' + (n.tab.selected ? '[*]' : '[ ]');
        string += spaces + n.tab.toString();
      }
    });
    return string;
  },

  get root() {
    return this._root;
  },

  saveSession: function() {
  },

  restoreSession: function() {
    // FIXME
    this.addTab({url: HOMEPAGE});
    return;
  },

  _getTreeNode: function(tab) {
    var node = this._root.find(n => n.tab === tab);
    if (!node) {
      throw new Error("Can't find node for tab");
    }
    return node;
  },

  onMozBrowserOpenWindow: function(iframeEvent, tab) {
    this.addTab({
      url: iframeEvent.detail.url,
      frameElement: iframeEvent.detail.frameElement,
      parentTab: tab,
      selected: true,
    });
  },

  onMozBrowserOpenTab: function(iframeEvent, tab) {
    this.addTab({
      url: iframeEvent.detail.url,
      frameElement: iframeEvent.detail.frameElement,
      parentTab: tab,
      selected: false,
    });
  },

  onTabUpdate: function(tab) {
    this.emit('tab-update', tab);
  },

  addTab: function(options={}) {

    var tab = new Tab(this._parentDOMNode, {
      frameElement: options.frameElement, // FIXME: test if frameElement actually works
    });
    
    var treeNode = new TreeNode(tab);

    var treeWasEmpty = this._root.children.length == 0;

    var treeParent = this._root;
    if (options.parentTab) {
      treeParent = this._getTreeNode(options.parentTab);
    }

    treeParent.appendChild(treeNode);

    tab.on('mozbrowseropenwindow', this.onMozBrowserOpenWindow);
    tab.on('mozbrowseropentab', this.onMozBrowserOpenTab);
    tab.on('tab-update', this.onTabUpdate);

    if (options.url) {
      tab.setLocation(options.url);
    }

    if (treeWasEmpty || options.selected) {
      this.selectTab(tab);
    } else {
      tab.selected = false;
    }

    this.emit('tree-layout-changed');

    return tab;
  },

  dropTabAndChildren: function(tab) {
    var node = this._getTreeNode(tab);

    // FIXME: should use getNextTab
    if (node.find(n => n.tab.selected)) {
      this.selectTab(node.lastNode().nextNode().tab);
    }

    node.detach();
    node.walk(n => {
      n.tab.destroy();
      n.tab = null;
    });
    this.emit('tree-layout-changed');
  },

  dropTabAndMoveChildrenUp: function(tab) {
    var node = this._getTreeNode(tab);
    if (node.isRoot()) {
      throw new Error("Can't drop root node");
    }

    if (tab.selected) {
      this.selectTab(node.nextNode().tab);
    }

    var count = node.children.length;
    for (var i = count - 1; i >= 0; i--) {
      var child = node.children[i];
      node.parent.appendChildAfter(child, node);
    }
    node.detach();
    node.tab = null;

    tab.destroy();

    this.emit('tree-layout-changed');
  },

  moveTabAndChildrenAfter: function(tab, prevTab) {
    var node = this._getTreeNode(tab);
    var prevNode = this._getTreeNode(prevTab);

    var isPrevTabInTab = node.find(n => n == prevNode);
    if (isPrevTabInTab) {
      throw new Error("Illegal move");
    }

    prevNode.parent.appendChildAfter(node, prevNode);
    this.emit('tree-layout-changed');
  },

  selectTab: function(tab) {
    var previouslySelected = this.getSelectedTab();
    if (previouslySelected === tab) {
      return;
    }
    if (previouslySelected) {
      previouslySelected.selected = false;
    }
    tab.selected = true;
    this.emit('selected-tab-changed');
  },

  selectNextTab: function() {
    var previouslySelected = this.getSelectedTab();
    this.selectTab(this.getNextTabAndLoop(previouslySelected));
  },

  selectPrevTab: function() {
    var previouslySelected = this.getSelectedTab();
    this.selectTab(this.getPreviousTabAndLoop(previouslySelected));
  },

  getFirstTab: function() {
    return this._root.children[0].tab;
  },

  getLastTab: function() {
    return this._root.lastNode().tab;
  },

  getPreviousTab: function(tab) {
    var node = this._getTreeNode(tab);
    var prevNode = node.prevNode();
    return prevNode ? prevNode.tab : null;
  },

  getPreviousTabAndLoop: function(tab) {
    var prevTab = this.getPreviousTab(tab);
    if (!prevTab) {
      prevTab = this.getLastTab();
    }
    return prevTab;
  },

  getNextTab: function(tab) {
    var node = this._getTreeNode(tab);
    var nextNode = node.nextNode();
    return nextNode ? nextNode.tab : null;
  },

  getNextTabAndLoop: function(tab) {
    var nextTab = this.getNextTab(tab);
    if (!nextTab) {
      nextTab = this.getFirstTab();
    }
    return nextTab;
  },

  getSelectedTab: function() {
    var node = this._root.find(n => n.tab && n.tab.selected);
    if (!node) {
      return null;
    }
    return node.tab;
  },

  _setupKeybindings: function() {
    RegisterKeyBindings(
      ['',              'Esc',        () => this.getSelectedTab().stop()],
      ['Ctrl',          'Tab',        () => this.selectNextTab()],
      ['Ctrl Shift',    'code:9',     () => this.selectPrevTab()]
    );

    if (OS == 'x11' || OS == 'win') {
      RegisterKeyBindings(
        ['Ctrl',          't',          () => this.addTab({selected: true})],
        ['Ctrl',          'r',          () => this.getSelectedTab().reload()],
        ['Alt',           'Left',       () => this.getSelectedTab().goBack()],
        ['Alt',           'Right',      () => this.getSelectedTab().goForward()],
        ['Ctrl',          'w',          () => this.dropTabAndMoveChildrenUp(this.getSelectedTab())],
        ['Ctrl Shift',    '+',          () => this.getSelectedTab().zoomIn()],
        ['Ctrl',          '=',          () => this.getSelectedTab().zoomIn()],
        ['Ctrl',          '-',          () => this.getSelectedTab().zoomOut()],
        ['Ctrl',          '0',          () => this.getSelectedTab().resetZoom()]
      );
    }

    if (OS == 'mac') {
      RegisterKeyBindings(
        ['Cmd',       't',          () => this.addTab({selected: true})],
        ['Cmd',       'r',          () => this.getSelectedTab().reload()],
        ['Cmd',       'Left',       () => this.getSelectedTab().goBack()],
        ['Cmd',       'Right',      () => this.getSelectedTab().goForward()],
        ['Cmd',       'w',          () => this.dropTabAndMoveChildrenUp(this.getSelectedTab())],
        ['Cmd Shift', '+',          () => this.getSelectedTab().zoomIn()],
        ['Cmd',       '=',          () => this.getSelectedTab().zoomIn()],
        ['Cmd',       '-',          () => this.getSelectedTab().zoomOut()],
        ['Cmd',       '0',          () => this.getSelectedTab().resetZoom()]
      );
    }
  },
}

/**               TAB                 **/


const IFRAME_EVENTS = [
  'mozbrowserasyncscroll', 'mozbrowserclose', 'mozbrowsercontextmenu',
  'mozbrowsererror', 'mozbrowsericonchange', 'mozbrowserloadend',
  'mozbrowserloadstart', 'mozbrowserlocationchange', 'mozbrowseropentab',
  'mozbrowseropenwindow', 'mozbrowsersecuritychange', 'mozbrowsershowmodalprompt',
  'mozbrowsertitlechange', 'mozbrowserusernameandpasswordrequired'
];


function Tab(parentDOMNode, options={}) {
  this._url = options.url;
  if (!parentDOMNode) {
    throw new Error('parentDOMNode required');
  }
  var div = document.createElement('div');
  parentDOMNode.appendChild(div);
  this._div = div;
  this._div.className = 'tabiframe';
  this._zoom = 1;
  this._userInput = '';
  this._clearTabtab();
  if (options.frameElement) {
    this._createInnerIframe(options.frameElement);
  }
  EventEmitter(this);
}

Tab.prototype = {

  toString: function() {
    return 'Tab: ' + this._url;
  },

  set selected(value) {
    this._selected = value;
    if (this._selected) {
      this._show();
    } else {
      this._hide();
    }
  },

  get selected() {
    return this._selected;
  },

  destroy: function() {
    if (this._innerIframe) {
      for (var eventName of IFRAME_EVENTS) {
        this._innerIframe.removeEventListener(eventName, this);
      }
    }
    this.treeNode = null;
    this._div.remove();
    AllOff(this);
  },

  _show() {
    this._div.removeAttribute('hidden');
    if (IS_PRIVILEGED && this._innerIframe) {
      this._innerIframe.setVisible(true);
    }
  },

  _hide() {
    this._div.setAttribute('hidden', 'true');
    if (IS_PRIVILEGED && this._innerIframe) {
      this._innerIframe.setVisible(false);
    }
  },

  setLocation(url) {
    this._location = url;
    if (!this._innerIframe) {
      this._createInnerIframe();
    }
    if (IS_PRIVILEGED) {
      this._innerIframe.src = url;
    } else {
      this._innerIframe.src = 'tab:,' + url;
    }
  },

  zoomIn() {
    this._zoom += 0.1;
    this._zoom = Math.min(MAX_ZOOM, this._zoom);
    this._applyZoom();
  },

  zoomOut() {
    this._zoom -= 0.1;
    this._zoom = Math.max(MIN_ZOOM, this._zoom);
    this._applyZoom();
  },

  resetZoom() {
    this._zoom = 1;
    this._applyZoom();
  },

  reload() {
    if (this._innerIframe) {
      this._innerIframe.reload();
    }
  },

  stop() {
    if (this._innerIframe) {
      this._innerIframe.stop();
    }
  },

  goBack() {
    if (this._innerIframe) {
      this._innerIframe.goBack();
    }
  },

  goForward() {
    if (this._innerIframe) {
      this._innerIframe.goForward();
    }
  },

  canGoBack() {
    return new Promise((resolve, reject) => {
      if (!this._innerIframe) {
        return resolve(false);
      }
      this._innerIframe.getCanGoBack().onsuccess = r => {
        return resolve(r.target.result);
      };
    });
  },

  canGoForward() {
    return new Promise((resolve, reject) => {
      if (!this._innerIframe) {
        return resolve(false);
      }
      this._innerIframe.getCanGoForward().onsuccess = r => {
        return resolve(r.target.result);
      };
    });
  },

  focus() {
    if (this._innerIframe) {
      this._innerIframe.focus();
    }
  },

  get empty() {
    return !this._innerIframe;
  },

  get userInput() {
    return this._userInput;
  },

  set userInput(val) {
    this._userInput = val;
  },

  get loading() {
    return this._loading;
  },

  get title() {
    return this._title;
  },

  get location() {
    return this._location;
  },

  get favicon() {
    return this._faviconURL || getFallback(this.location);
  },

  get securityState() {
    return this._securityState;
  },

  get securityExtendedValidation() {
    return this._securityExtendedValidation;
  },

  _createInnerIframe(iframe) {


    if (!iframe) {
      iframe = document.createElement('iframe');
    }

    iframe.setAttribute('mozbrowser', 'true');
    iframe.setAttribute('remote', 'true');
    iframe.setAttribute('mozallowfullscreen', 'true');
    iframe.setAttribute('tabindex', '-1');

    this._div.appendChild(iframe);

    for (var eventName of IFRAME_EVENTS) {
      iframe.addEventListener(eventName, this);
    }

    this._innerIframe = iframe;
    this._applyZoom();
  },

  _applyZoom() {
    if (this._innerIframe && IS_PRIVILEGED) {
      this._innerIframe.zoom(this._zoom);
    }
  },

  _clearTabtab() {
    this._loading = false;
    this._title = '';
    this._location = '';
    this._bestIcon = null;
    this._securityState = 'insecure';
    this._securityExtendedValidation = false;
  },

  handleEvent(e) {

    console.log('TABEVENT', e.type);

    var somethingChanged = true;

    switch (e.type) {
      case 'mozbrowserloadstart':
        this._clearTabtab();
        this._loading = true;
        break;
      case 'mozbrowserloadend':
        this._loading = false;
        break;
      case 'mozbrowsertitlechange':
        this._title = e.detail;
        break;
      case 'mozbrowserlocationchange':
        this.userInput = '';
        this._location = e.detail;
        break;
      case 'mozbrowsericonchange':
        var {bestIcon, faviconURL} = getBestIcon([e.detail, this._bestIcon]);
        this._faviconURL = faviconURL;
        this._bestIcon = bestIcon;
        break;
      case 'mozbrowsererror':
        this._loading = false;
        break;
      case 'mozbrowsersecuritychange':
        this._securityState = e.detail.state;
        this._securityExtendedValidation = e.detail.extendedValidation;
        break;
      default:
        somethingChanged = false;
    }

    if (somethingChanged) {
      this.emit('tab-update', this);
    }

    switch (e.type) {
      case 'mozbrowseropenwindow':
      case 'mozbrowseropentab':
        this.emit(e.type, e, this);
    }

  },

}


/**               A TREE STRUCTURE                **/


function TreeNode(tab) {
  this._parent = null;
  this._children = [];
  this.tab = tab;
}

TreeNode.prototype = {

  get _siblings() {
    if (!this._parent) {
      throw new Error("Can't get sibling of root node");
    }
    return this._parent.children;
  },

  get _selfIndex() {
    var siblings = this._siblings;
    return siblings.indexOf(this);
  },

  get parent() {
    return this._parent;
  },

  get children() {
    return this._children;
  },

  get root() {
    if (this._parent) {
      return this._parent.root;
    } else {
      return this;
    }
  },

  appendChild: function(node) {
    node.detach();
    this._children.push(node);   
    node._parent = this;
    return node;
  }, 

  appendChildAfter: function(node, sibling) {
    node.detach();
    var index = sibling._selfIndex;
    this._children.splice(index + 1, 0, node);
    node._parent = this;
    return node;
  },

  nextNode: function() {
    // FIXME ugly like hell
    var justPassedBy = false;
    return this.root.find(n => {
      if (justPassedBy) {
        return true;
      }
      if (n === this) {
        justPassedBy = true;
      }
    });
  },
  
  prevNode: function() {
    // FIXME ugly like hell
    var justPassedBy = false;
    return this.root.findReverse(n => {
      if (justPassedBy) {
        return true;
      }
      if (n === this) {
        justPassedBy = true;
      }
    });
  },

  isRoot: function() {
    return !this._parent;
  },

  getDepth: function() {
    if (this.isRoot()) {
      return 0;
    }
    return this._parent.getDepth() + 1;
  },

  walk: function(callback) {
    this.find(n => {
      callback(n);
      return false;
    });
  },

  find: function(findMethod) {
    if (findMethod(this)) {
      return this;
    }
    for (var child of this._children) {
      var ret = child.find(findMethod);
      if (ret) {
        return ret;
      }
    }
    return null;
  },

  findReverse: function(findMethod) {
    var count = this._children.length;
    for (var i = count - 1; i >= 0; i--) {
      var ret = this._children[i].findReverse(findMethod);
      if (ret) {
        return ret;
      }
    }
    if (findMethod(this)) {
      return this;
    }
    return null;
  },

  lastNode: function() {
    if (this._children.length == 0) {
      return this;
    }
    return this._children[this._children.length - 1].lastNode();
  },

  detach: function() {
    if (this._parent) {
      this._siblings.splice(this._selfIndex, 1);
      this._parent = null;
    }
    return this;
  },

}
