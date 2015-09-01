const now = require('performance-now');

const {TabTree} = require('./deck2.js');

var tree = new TabTree();

tree.on('tree-layout-changed', () => {
  console.log('\ntree-layout-changed:');
  console.log(tree.toString());
});

tree.on('selected-tab-changed', () => {
  console.log('\nselected-tab-changed:');
  console.log(tree.toString());
});

var tab1 = tree.addTab({url:'google.com'});
var tab2 = tree.addTab({url:'yahoo.com', selected:true});
var tab3 = tree.addTab({url:'amazon.com'});

var s1 = tree.addTab({url:'google.com/s1', parentTab: tab1});
var s2 = tree.addTab({url:'google.com/s2', parentTab: tab1});
var s3 = tree.addTab({url:'google.com/s3', parentTab: tab1, selected: true});
var s4 =tree.addTab({url:'google.com/s4', parentTab: tab1});
var s5 = tree.addTab({url:'google.com/s5', parentTab: tab1});

var s21 = tree.addTab({url:'google.com/s21', parentTab: s2});
var s22 = tree.addTab({url:'google.com/s22', parentTab: s2});
var s23 = tree.addTab({url:'google.com/s23', parentTab: s2, selected: true});
var s24 = tree.addTab({url:'google.com/s24', parentTab: s2});
var s25 = tree.addTab({url:'google.com/s25', parentTab: s2});

// tree.dropTabAndMoveChildrenUp(s2);
tree.dropTabAndChildren(s2);
