// Constructor
function Slack(bar) {
  // always initialize all instance properties
  this.bar = bar;
  this.baz = 'baz'; // default value
}
// class methods
Slack.prototype.fooBar = function() {

};
// export the class
module.exports = Slack;