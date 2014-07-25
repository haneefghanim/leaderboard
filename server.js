
// Dependencies
var express = require("express");
var logfmt = require("logfmt");
var redis = require('redis');
var url = require('url');

// Initialize app
var app = express();
var redisURL = url.parse(process.env.REDISCLOUD_URL);
var redisClient = redis.createClient(redisURL.port, redisURL.hostname, {no_ready_check: true});
redisClient.auth(redisURL.auth.split(":")[1]);
app.use(logfmt.requestLogger());

// Main route
app.get('/', function(req, res) {

	// Check for missing param
	if (typeof req.query.text === 'undefined') {
		res.send("Uh oh, something went wrong!");
	}

	// Initialize command array
	var commands = req.query.text.split(" ");
	res.send(commands);
});

app.get('/redis', function (req, res) {
	redisClient.set('foo', 'Redis is working!');
	redisClient.get('foo', function (err, reply) {
	     res.send(reply.toString());
	});
});


// Listen - starting up server
var port = Number(process.env.PORT || 5000);
app.listen(port, function() {
  console.log("Listening on " + port);
});