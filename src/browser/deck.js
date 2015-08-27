'use strict';

const {EventEmitter} = require('../common/eventemitter');
const {RegisterKeyBindings} = require('../common/keybindings');
const {OS} = require('../common/os');

const IS_PRIVILEGED = !!HTMLIFrameElement.prototype.setVisible;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

const HOMEPAGE = 'http://paulrouget.com';

const CSS = `

  iframe {
    border: 0;
    flex-grow: 1;
  }

  .tabiframe {
    display: flex;
    flex-grow: 1;
  }

  .tabIframe[hidden='true'] {
    display: none;
  }

`;

function Deck() {
  // FIXME: needed for events. Ugly.
  this.onMozBrowserOpenWindow = this.onMozBrowserOpenWindow.bind(this);
  this.onMozBrowserOpenTab = this.onMozBrowserOpenTab.bind(this);
  this.saveSession = this.saveSession.bind(this);
}

Deck.prototype = {

  _selectIndex: -1,

  _tabIframeArray: [],

  init(parent) {
    var style = document.createElement('style');
    style.setAttribute('scoped', 'scoped');
    style.textContent = CSS;
    parent.appendChild(style);
    this._parent = parent;
    this.restoreSession();
    this._setupKeybindings();
  },

  saveSession() {
    var session = this._tabIframeArray.map(t => t.location);
    window.localStorage.session = JSON.stringify(session);
  },

  restoreSession() {
    var session = [];
    try {
      // session = JSON.parse(window.localStorage.session);
    } catch (e) {}

    if (Array.isArray(session) && session.length > 0) {
      for (var url of session) {
        this.add({url});
      }
    } else {
      this.add({url: HOMEPAGE});
    }
  },

  onMozBrowserOpenWindow(type, event) {
    // FIXME: use frameElement
    this.add({
      url: event.detail.url,
      frameElement: event.detail.frameElement,
    });
  },

  onMozBrowserOpenTab(type, event) {
    // FIXME: use frameElement
    this.add({
      url: event.detail.url,
      frameElement: event.detail.frameElement,
      select: false,
    });
  },

  add(options={}) {
    var tabIframe = new TabIframe({
      parent: this._parent,
      frameElement: options.frameElement, // FIXME: test if that actually works
    });

    this._tabIframeArray.push(tabIframe);

    tabIframe.on('mozbrowseropenwindow', this.onMozBrowserOpenWindow);
    tabIframe.on('mozbrowseropentab', this.onMozBrowserOpenTab);
    tabIframe.on('mozbrowserlocationchange', this.saveSession);

    if (options.url) {
      tabIframe.setLocation(options.url);
    }

    if (options.select || this._selectIndex < 0) {
      this.select(tabIframe);
    } else {
      tabIframe.hide();
    }

    this.emit('tab-added', {tabIframe: tabIframe});

    this.saveSession();

    return tabIframe;
  },

  remove(tabIframe) {
    var index = this._tabIframeArray.indexOf(tabIframe);
    if (index < 0) {
      throw new Error('Unknown tabIframe');
    }

    if (this._tabIframeArray.length == 1) {
      throw new Error('Deck has only one tabiframe');
    }

    if (index == this.this._selectIndex) {
      var newSelectIndex;
      if (index == this._tabIframeArray.length - 1) {
        newSelectIndex = index - 1;
      } else {
        newSelectIndex = index + 1;
      }
      this.select(this._tabIframeArray[newSelectIndex]);
    }

    if (this._selectIndex > index) {
      this._selectIndex--;
    }

    this._tabIframeArray.splice(index, 1);

    tabIframe.off('mozbrowseropenwindow', this.onMozBrowserOpenWindow);
    tabIframe.off('mozbrowseropentab', this.onMozBrowserOpenTab);
    tabIframe.off('mozbrowserlocationchange', this.saveSession);

    tabIframe.remove();


    this.saveSession();

    this.emit('tab-removed', {tabIframe});
  },

  select(tabIframe) {
    var index = this._tabIframeArray.indexOf(tabIframe);
    if (index < 0) {
      throw new Error('Unknown tabiframe');
    }

    if (index == this._selectIndex) {
      // already selected
      return;
    }

    tabIframe.willBeVisibleSoon();

    var previouslySelectTabIframe = this._tabIframeArray[this._selectIndex];
    if (previouslySelectTabIframe) {
      this.emit('tab-unselect', {tabIframe: previouslySelectTabIframe});
    }

    this._selectIndex = index;

    this.emit('tab-selected', {tabIframe});

    // Do the actual switch
    // FIXME: is RFA really needed?
    window.requestAnimationFrame(() => {
      if (previouslySelectTabIframe) {
        previouslySelectTabIframe.hide();
      }
      tabIframe.show();
    });
  },

  selectNext() {
    var newSelectIndex = this._selectIndex + 1;
    if (newSelectIndex == this._tabIframeArray.length) {
      newSelectIndex = 0;
    }
    this.select(this._tabIframeArray[newSelectIndex]);
  },

  selectPrevious() {
    var newSelectIndex = this._selectIndex - 1;
    if (newSelectIndex < 0) {
      newSelectIndex = this._tabIframeArray.length - 1;
    }
    this.select(this._tabIframeArray[newSelectIndex]);
  },

  getSelected() {
    return this._tabIframeArray[this._selectIndex];
  },

  getCount() {
    return this._tabIframeArray.length;
  },

  _setupKeybindings() {
    RegisterKeyBindings(
      ['',              'Esc',        () => this.getSelected().stop()],
      ['Ctrl',          'Tab',        () => this.selectNext()],
      ['Ctrl Shift',    'code:9',     () => this.selectPrevious()],
      ['',              'F5',         () => this.getSelected().reload()]
    );

    if (OS == 'x11' || OS == 'win') {
      RegisterKeyBindings(
        ['Ctrl',          't',          () => this.add({select: true})],
        ['Ctrl',          'r',          () => this.getSelected().reload()],
        ['Alt',           'Left',       () => this.getSelected().goBack()],
        ['Alt',           'Right',      () => this.getSelected().goForward()],
        ['Ctrl',          'w',          () => this.remove(this.getSelected())],
        ['Ctrl Shift',    '+',          () => this.getSelected().zoomIn()],
        ['Ctrl',          '=',          () => this.getSelected().zoomIn()],
        ['Ctrl',          '-',          () => this.getSelected().zoomOut()],
        ['Ctrl',          '0',          () => this.getSelected().resetZoom()]
      );
    }

    if (OS == 'mac') {
      RegisterKeyBindings(
        ['Cmd',       't',          () => this.add({select: true})],
        ['Cmd',       'r',          () => this.getSelected().reload()],
        ['Cmd',       'Left',       () => this.getSelected().goBack()],
        ['Cmd',       'Right',      () => this.getSelected().goForward()],
        ['Cmd',       'w',          () => this.remove(this.getSelected())],
        ['Cmd Shift', '+',          () => this.getSelected().zoomIn()],
        ['Cmd',       '=',          () => this.getSelected().zoomIn()],
        ['Cmd',       '-',          () => this.getSelected().zoomOut()],
        ['Cmd',       '0',          () => this.getSelected().resetZoom()]
      );
    }
  },
}

EventEmitter.decorate(Deck.prototype);

Deck.prototype[Symbol.iterator] = function*() {
  for (var tabIframe of this._tabIframeArray) {
    yield tabIframe;
  }
}

exports.Deck = new Deck();

function TabIframe(options={}) {
  if (!options.parent) {
    throw new Error('parent option required');
  }
  var div = document.createElement('div');
  div.className = 'tabiframe';
  options.parent.appendChild(div);
  this._div = div;
  this._zoom = 1;
  this._userInput = '';
  this._clearTabData();
  if (options.frameElement) {
    this._createInnerIframe(options.frameElement);
  }
  EventEmitter.decorate(this);
}

TabIframe.prototype = {

  remove() {
    this._div.remove();
  },

  setLocation(url) {
    if (!this._innerIframe) {
      this._createInnerIframe();
    }
    if (IS_PRIVILEGED) {
      this._innerIframe.src = url;
    } else {
      this._innerIframe.src = 'data:,' + url;
    }
  },

  willBeVisibleSoon() {
    if (IS_PRIVILEGED && this._innerIframe) {
      this._innerIframe.setVisible(true);
    }
  },

  show() {
    this._div.removeAttribute('hidden');
    if (IS_PRIVILEGED && this._innerIframe) {
      this._innerIframe.setVisible(true);
    }
    this.emit('visible');
  },

  hide() {
    this._div.setAttribute('hidden', 'true');
    if (IS_PRIVILEGED && this._innerIframe) {
      this._innerIframe.setVisible(false);
    }
    this.emit('hidden');
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
    return this._favicon;
  },

  get securityState() {
    return this._securityState;
  },

  get securityExtendedValidation() {
    return this._securityExtendedValidation;
  },

  _createInnerIframe(iframe) {

    const IFRAME_EVENTS = [
      'mozbrowserasyncscroll', 'mozbrowserclose', 'mozbrowsercontextmenu',
      'mozbrowsererror', 'mozbrowsericonchange', 'mozbrowserloadend',
      'mozbrowserloadstart', 'mozbrowserlocationchange', 'mozbrowseropentab',
      'mozbrowseropenwindow', 'mozbrowsersecuritychange', 'mozbrowsershowmodalprompt',
      'mozbrowsertitlechange', 'mozbrowserusernameandpasswordrequired'
    ];


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

  _clearTabData() {
    this._loading = false;
    this._title = '';
    this._location = '';
    this._favicon = '';
    this._securityState = 'insecure';
    this._securityExtendedValidation = false;
  },

  handleEvent(e) {

    var somethingChanged = true;

    switch (e.type) {
      case 'mozbrowserloadstart':
        this._clearTabData();
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
        this._favicon = e.detail.href;
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

    // Forward event
    this.emit(e.type, e, this);
  },
}
