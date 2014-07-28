
// Dependencies
var express = require("express");
var logfmt = require("logfmt");
var url = require('url');
var leaderboardLib = require("./lib/leaderboard.js");
var slackLib = require("./lib/slack.js");

// Initialize app
var app = express();
app.use(logfmt.requestLogger());

// Initialize leaderboard
var leaderboard;
if (typeof process.env.REDISCLOUD_URL === 'undefined') {
	// Local environment
	leaderboard = new leaderboardLib("127.0.0.1", "6379");
} else {
	// Production on Heroku
	var redisURL = url.parse(process.env.REDISCLOUD_URL);
	leaderboard = new leaderboardLib(redisURL.hostname, redisURL.port, redisURL.auth.split(":")[1]);
}

// Initialize slack model - need to define SLACK_API_TOKEN as an env variable
var slack = new slackLib(process.env.SLACK_API_TOKEN);

// Main route
app.get('/', function(req, res) {

	var slackCommand = '/leaderboard';
	var slackChannel = "C024GR3KC";

	// Check for missing param
	// TODO: Switch over to using user ids, have a mapping b/w name and id
	if (typeof req.query.text === 'undefined' || typeof req.query.user_name === 'undefined') {
		res.send("Uh oh, something went wrong!");
		return;
	}

	// Initialize command array
	var commands = req.query.text.split(" ");
	var user = req.query.user_name;
	var quiet = false;

	// Quiet switch: does not announce events to Slack
	if (commands[commands.length-1] == "--quiet") {
		commands.pop();
		quiet = true;
	}

	// Help command
	if (commands.length == 1 && commands[0] == "help") {
		var response = 	"*List of Leaderboard Commands:*\n" +
						">"+slackCommand + " create {game}\n" +
						">"+slackCommand + " delete {game}\n" +
						">"+slackCommand + " add {player} to {game}\n"+
						">"+slackCommand + " remove {player} from {game}\n"+
						">"+slackCommand + " {winner} beat {loser} at {game}\n" +
						">"+slackCommand + " show {game}\n" +
						">"+slackCommand + " list\n" +
						">"+slackCommand + " help\n\n"+
						"PS: You can add *--quiet* to the end of a command, in order to not broadcast it.\n"+
						"You can also use */lb* as a shorthand for */leaderboard*\n";

		res.send(response);
		return;
	}

	var autoMessage = "\n_What is this? Type */leaderboard help* for more information!_"

	// Create command: create {board}
	if (commands.length == 2 && commands[0] == "create") {
		leaderboard.create(commands[1], user, function (success, msg) {
			res.send(msg);
			if (success && !quiet) {
				slack.sendToChannel(slackChannel, msg+autoMessage);
			}
		});
		return;
	}

	// Delete command: delete {board}
	if (commands.length == 2 && commands[0] == "delete") {
		leaderboard.delete(commands[1], function (success, msg) {
			res.send(msg);
			if (success && !quiet) {
				slack.sendToChannel(slackChannel, msg+autoMessage);
			}
		});
		return;
	}

	// Add user to board command: add {user} to {board}
	if (commands.length == 4 && commands[0] == "add" && commands[2] == "to") {
		leaderboard.addUserToBoard(commands[3], commands[1], function (success, msg) {
			res.send(msg);
			if (success && !quiet) {
				slack.sendToChannel(slackChannel, msg+autoMessage);
			}
		});
	    return;
	}

	// Remove user from board command: remove {user} from {board}
	if (commands.length == 4 && commands[0] == "remove" && commands[2] == "from") {
		leaderboard.removeUserFromBoard(commands[3], commands[1], function (success, msg) {
			res.send(msg);
			if (success && !quiet) {
				slack.sendToChannel(slackChannel, msg+autoMessage);
			}
		});
	    return;
	}

	// Show all boards command: list
	if (commands.length == 1 && commands[0] == "list") {
    	leaderboard.showAll(function (success, msg) {
    		res.send(msg);
    	});
		return;
	}

	// Display board command: show {board}
	if (commands.length == 2 && commands[0] == "show") {
		leaderboard.display(commands[1], function (success, msg) {
			res.send(msg);
		});
		return;
	}

	// Player won command: {winner} beat {loser} at {board}
	if (commands.length == 5 && commands[1] == "beat" && commands[3] == "at") {
		leaderboard.win(commands[4], commands[0], commands[2], function(success, msg) {
			res.send(msg);
			if (success && !quiet) {
				slack.sendToChannel(slackChannel, msg+autoMessage);
			}
		});
		return;
	}

	res.send("Invalid command!  Type */leaderboard help* to see list of commands.");
});

// Attaching server to port
var port = Number(process.env.PORT || 5000);
app.listen(port, function() {
  console.log("Listening on " + port);
});