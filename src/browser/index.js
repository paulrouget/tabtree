'use strict';

const CSS = `
    * {
      -moz-user-select: none;
    }

    body {
      height: 100vh;
    }

    @font-face {
      font-family: 'FontIon';
      src: url('ionicons.woff');
      font-weight: normal;
      font-style: normal;
    }

    body {
      display: flex;
      margin: 0;
      font-family: "Helvetica", sans-serif;
      font-size: 12px;
    }

    .box, .hbox, .vbox, .spacer {
      display: flex;
      flex-basis: 0;
    }

    .hbox { flex-flow: row }

    .vbox { flex-flow: column }

    .flex1 { flex-grow: 1 }
    .flex2 { flex-grow: 2 }
    .flex3 { flex-grow: 3 }
    .flex4 { flex-grow: 4 }
    .flex5 { flex-grow: 5 }
    .flex6 { flex-grow: 6 }
    .flex7 { flex-grow: 7 }
    .flex8 { flex-grow: 8 }
    .flex9 { flex-grow: 9 }

    .alignStart    { align-items: flex-start }
    .alignCenter   { align-items: center }
    .alignEnd      { align-items: flex-end }
    .alignBaseline { align-items: flex-baseline }
    .alignStretch  { align-items: flex-stretch }

    .packStart  { justify-content: flex-start }
    .packCenter { justify-content: center }
    .packEnd    { justify-content: flex-end }

  </style>
`;

const HTML = `
  <div class='hbox flex1'>
    <div id='sidebar1'></div>
    <div class='vbox flex1'>
      <div class='vbox' id='toolbox1'></div>
      <div class='box flex1' id='deck'></div>
      <div class='vbox' id='toolbox2'></div>
    </div>
    <div id='sidebar2'></div>
  </div>
`;

const style = document.createElement('style');
style.textContent = CSS;
document.head.appendChild(style);
document.body.innerHTML = HTML;

const {TabTree} = require('./tabtree');
var tree = new TabTree(document.querySelector('#deck'));

const Sidebar = require('./sidebar');
Sidebar.init(document.querySelector('#sidebar2'), tree);
