
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

	var slackCommand = '/leaderboard';

	// Check for missing param
	if (typeof req.query.text === 'undefined') {
		res.send("Uh oh, something went wrong!");
	}

	// Initialize command array
	var commands = req.query.text.split(" ");

	// Help command
	if (commands.length == 1 && commands[0] == "help") {
		slackCommand = "_"+slackCommand+"_"; // formatting
		var response = 	"*List of Leaderboard Commands:*\n" +
						slackCommand + " create {game}\n" +
						slackCommand + " delete {game}\n" +
						slackCommand + " {player1} beat {player2} at {game}\n" +
						slackCommand + " add {player} to {game}\n"+
						slackCommand + " remove {player} from {game}\n"+
						slackCommand + " display {game}\n" +
						slackCommand + " help\n";

		res.send(response);
	}


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