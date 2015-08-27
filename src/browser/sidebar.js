'use strict';

const {Deck} = require('./deck');

const CSS = `
  .container {
    height: 100vh;
    width: 20px;
    background: red;
  }
`;

const HTML = `
  <div class='container'>
  </div>
`;

const TAB_HTML = `
  <div>
  </div>
`;

function Sidebar() {
}

Sidebar.prototype = {
  init(parent) {
    parent.innerHTML = HTML;
    var style = document.createElement('style');
    style.setAttribute('scoped', 'scoped');
    style.textContent = CSS;
    parent.appendChild(style);
    this._parent = parent;
  },
}

exports.Sidebar = new Sidebar();

