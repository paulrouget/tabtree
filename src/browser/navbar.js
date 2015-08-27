/**
 * navbar.js
 *
 * Code handling the navigation bar. The navigation bar includes
 * the back/forward/stop/reload buttons, the url bar and the search
 * bar.
 *
 */

'use strict';

const {UrlHelper} = require('./urlhelper');
const {Deck} = require('deck');
const {RegisterKeyBindings} = require('keybindings');

var html = `
  <div class='alignCenter'>
    <style scoped>
      :scope {
        border: 4px solid red;
      }
      button {
        -moz-appearance: none;
        border: 3px solid green;
      }
    </style>
    <div class='button back-button' title='Go back one page'></div>
    <div class='button forward-button' title='Go forward one page'></div>
    <div class='button reload-button' title='Reload current page'></div>
    <div class='button stop-button' title='Stop loading this page'></div>
    <div class='hbox urlbar flex1 alignCenter'>
      <div class='identity'></div>
      <input placeholder='Search or enter address' class='urlinput' flex='1'>
    </div>
  </div>
`;

const Widget = function() {}

Widget.prototype.init = (parent) => {

  var urlTemplate = 'https://search.yahoo.com/search?p={searchTerms}';

  parent.innerHTML = html;
  var navbar = parent.firstChild;

  var urlbar = navbar.querySelector('.urlbar');
  var urlinput = navbar.querySelector('.urlinput');
  var backButton = navbar.querySelector('.back-button')
  var forwardButton = navbar.querySelector('.forward-button')
  var reloadButton = navbar.querySelector('.reload-button');
  var stopButton = navbar.querySelector('.stop-button');

  backButton.onclick = () => Deck.getSelected().goBack();
  forwardButton.onclick = () => Deck.getSelected().goForward();
  reloadButton.onclick = () => Deck.getSelected().reload();
  stopButton.onclick = () => Deck.getSelected().stop();

  urlinput.addEventListener('focus', () => {
    urlinput.select();
    urlbar.classList.add('focus');
  })

  urlinput.addEventListener('blur', () => {
    urlbar.classList.remove('focus');
  })

  urlinput.addEventListener('keypress', (e) => {
    if (e.keyCode == 13) {
      UrlInputChanged()
    }
  });

  urlinput.addEventListener('input', () => {
    Deck.getSelected().userInput = urlinput.value;
  });

  var mod = window.OS == 'osx' ? 'Cmd' : 'Ctrl';

  RegisterKeyBindings(
    [mod,    'l',   () => {
      urlinput.focus();
      urlinput.select();
    }]
  );

  function UrlInputChanged() {
    var text = urlinput.value;
    var url = PreprocessUrlInput(text);
    var tabIframe = Deck.getSelected();
    tabIframe.setLocation(url);
    tabIframe.focus();
  }

  Deck.on('select', OnTabSelected);

  var lastSelectedTab = null;

  var events = [
    'mozbrowserloadstart',
    'mozbrowserloadend',
    'mozbrowserlocationchange',
    'mozbrowsererror',
    'mozbrowsersecuritychange',
  ];

  function OnTabSelected() {
    var selectedTabIframe = Deck.getSelected();
    if (lastSelectedTab) {
      for (var e of events) {
        lastSelectedTab.off(e, UpdateTab);
      }
    }
    lastSelectedTab = selectedTabIframe;
    if (selectedTabIframe) {
      if (!selectedTabIframe.location) {
        urlinput.focus();
        urlinput.select();
      }
      for (var e of events) {
        lastSelectedTab.on(e, UpdateTab);
      }
      UpdateTab(null, null, selectedTabIframe);
    }
  }

  OnTabSelected();

  function UpdateTab(eventName, event, tabIframe) {
    if (tabIframe != Deck.getSelected()) {
      return;
    }

    if (tabIframe.loading) {
      navbar.classList.add('loading');
    } else {
      navbar.classList.remove('loading');
    }

    if (tabIframe.userInput) {
      urlinput.value = tabIframe.userInput;
    } else if (tabIframe.location) {
      urlinput.value = UrlHelper.trim(tabIframe.location);
    } else if (eventName === null) {
      urlinput.value = '';
    }

    if (!window.IS_PRIVILEGED) {
      return;
    }

    if (tabIframe.securityState == 'secure') {
      navbar.classList.add('ssl');
      navbar.classList.toggle('sslev', tabIframe.securityExtendedValidation);
    } else {
      navbar.classList.remove('ssl');
      navbar.classList.remove('sslev');
    }

    tabIframe.canGoBack().then(canGoBack => {
      // Make sure iframe is still selected
      if (tabIframe != Deck.getSelected()) {
        return;
      }
      if (canGoBack) {
        backButton.classList.remove('disabled');
      } else {
        backButton.classList.add('disabled');
      }
    });

    tabIframe.canGoForward().then(canGoForward => {
      // Make sure iframe is still selected
      if (tabIframe != Deck.getSelected()) {
        return;
      }
      if (canGoForward) {
        forwardButton.classList.remove('disabled');
      } else {
        forwardButton.classList.add('disabled');
      }
    });
  };

  function PreprocessUrlInput(input) {
    if (UrlHelper.isNotURL(input)) {
      return urlTemplate.replace('{searchTerms}', encodeURIComponent(input));
    }

    if (!UrlHelper.hasScheme(input)) {
      input = 'http://' + input;
    }

    return input;
  };
}
