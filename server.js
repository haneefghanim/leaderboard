
// Dependencies
var express = require("express");
var logfmt = require("logfmt");
var redis = require('redis');
var url = require('url');

// Initialize app
var app = express();
app.use(logfmt.requestLogger());

// Connect to Redis DB
if (typeof process.env.REDISCLOUD_URL === 'undefined') {
	// Local environment
	var redisURL = {hostname : "127.0.0.1", port : "6379"};
	var redisClient = redis.createClient(redisURL.port, redisURL.hostname, {no_ready_check: true});
} else {
	// Production on Heroku
	var redisURL = url.parse(process.env.REDISCLOUD_URL);
	var redisClient = redis.createClient(redisURL.port, redisURL.hostname, {no_ready_check: true});
	redisClient.auth(redisURL.auth.split(":")[1]);
}

// Main route
app.get('/', function(req, res) {

	var slackCommand = '/leaderboard';
	var leaderboardsKey = "leaderboards";

	// Check for missing param
	// TODO: Switch over to using user ids, have a mapping b/w name and id
	if (typeof req.query.text === 'undefined' || typeof req.query.user_name === 'undefined') {
		res.send("Uh oh, something went wrong!");
		return;
	}

	// Initialize command array
	var commands = req.query.text.split(" ");
	var user = req.query.user_name;

	// Help command
	if (commands.length == 1 && commands[0] == "help") {
		var response = 	"*List of Leaderboard Commands:*\n" +
						">"+slackCommand + " create {game}\n" +
						">"+slackCommand + " delete {game}\n" +
						">"+slackCommand + " add {player} to {game}\n"+
						">"+slackCommand + " remove {player} from {game}\n"+
						">"+slackCommand + " {winner} beat {loser} at {game}\n" +
						">"+slackCommand + " display {game}\n" +
						">"+slackCommand + " help\n";

		res.send(response);
		return;
	}

	// CREATE
	if (commands.length == 2 && commands[0] == "create") {
		var gameName = commands[1];

		redisClient.exists(gameName, function (err, value) {
		    if (err) throw(err)
		    if (value == true) {
		    	res.send("Whoops, *" + gameName + "* leaderboard already exists.");
		    } else {
		    	redisClient.zadd(gameName, 1, user); // add user to new board
		    	redisClient.sadd(leaderboardsKey, gameName); // add board to list of boards
		    	res.send("Created leaderboard: *" + gameName + "*!");
		    }
		});
		return;
	}

	// DELETE
	if (commands.length == 2 && commands[0] == "delete") {
		var gameName = commands[1];

		redisClient.exists(gameName, function (err, value) {
		    if (err) throw(err)
		    if (value == true) {
		    	redisClient.del(gameName); // delete board
		    	redisClient.srem(leaderboardsKey, gameName); // remove board from list of boards
		    	res.send("Deleted leaderboard: *" + gameName + "*!");
		    } else {
		    	res.send("Whoops, *" + gameName + "* leaderboard does not exist.");
		    }
		});
		return;
	}

	// ADD PLAYER
	if (commands.length == 4 && commands[0] == "add" && commands[2] == "to") {
		var playerName = commands[1];
		var gameName = commands[3];

		redisClient.zrevrangebyscore([gameName, "+inf", "-inf", 'WITHSCORES'], function (err, list) {
			if (err) throw(err)
			if (list.length > 1) {
				var maxScore = parseInt(list[1]);
				// Check if already in list
				redisClient.zscore(gameName, playerName, function (err, score) {
					if (err) throw(err)
					if (score > 0) {
						res.send("Whoops, *" + playerName + "* is already in leaderboard *" + gameName +"*.");
					} else {
				    	redisClient.zadd(gameName, maxScore+1, playerName); // add user to board
				    	res.send("Added *" + playerName + "* to leaderboard *" + gameName + "*!");
					}
				});

			} else {
				res.send("Whoops, *" + gameName + "* leaderboard does not exist.");
			}
	    });
	    return;
	}

	// REMOVE PLAYER
	if (commands.length == 4 && commands[0] == "remove" && commands[2] == "from") {
		var playerName = commands[1];
		var gameName = commands[3];

		redisClient.zcard(gameName, function (err, length) {
			if (err) throw(err)
			if (length > 0) {
				// Check if already in list
				redisClient.zscore(gameName, playerName, function (err, score) {
					if (err) throw(err)
					if (score > 0) {
						redisClient.zrem(gameName, length+1, playerName); // remove user from board
				    	res.send("Removed *" + playerName + "* from leaderboard *" + gameName + "*!");
					} else {
				    	res.send("Whoops, *" + playerName + "* is not in leaderboard *" + gameName +"*.");

					}
				});

			} else {
				res.send("Whoops, *" + gameName + "* leaderboard does not exist.");
			}
	    });
	    return;
	}

	// DISPLAY BOARD
	if (commands.length == 2 && commands[0] == "display") {
		var gameName = commands[1];

		redisClient.exists(gameName, function (err, value) {
		    if (err) throw(err)
		    if (value == true) {
		    	redisClient.zrangebyscore([gameName, "-inf", "+inf"], function (err, list) {
		    		var response = "*"+gameName+" leaderboard:*\n";
		    		for (i = 0; i < list.length; i++) {
		    			var row = ">" + (i+1) + ") " + list[i] + "\n";
		    			response = response+row;
		    		}
		    		res.send(response);
	    	});
		    } else {
		    	res.send("Whoops, *" + gameName + "* leaderboard does not exist.");
		    }
		});
		return;
	}


	// PLAYER BEAT PLAYER
	if (commands.length == 5 && commands[1] == "beat" && commands[3] == "at") {
		var winner = commands[0];
		var loser = commands[2]
		var gameName = commands[4];

		redisClient.zrangebyscore([gameName, "-inf", "+inf"], function (err, list) {
			if (err) throw(err)
			if (list.length > 1) {
				// Check if players are in list
				var winnerIndex = list.indexOf(winner);
				var loserIndex = list.indexOf(loser);
				if (winnerIndex >= 0 && loserIndex >= 0) {
					// Rearrange the leaderboard
					if (winnerIndex > loserIndex) {
						// Remove winner from board
						list.splice(winnerIndex, 1);

						// Add winner above loser
						list.splice(loserIndex, 0, winner);

						// Update rankings in redis
						for (i = 0; i < list.length; i++) {
							redisClient.zadd(gameName, i+1, list[i]);
						}

						res.send("*" + winner + "* took position #"+(loserIndex+1)+" from *" + loser + "* in *"+ gameName + "*!");
					} else {
						// Don't rearrange
						res.send("*" + winner + "* defended position #"+(winnerIndex+1)+" against *" + loser + "* in *"+ gameName + "*!");
					}
				} else {
					res.send("Whoops, one or both of *" + winner + "* and *" + loser + "* are not in leaderboard *"+ gameName + "*.");
				}

			} else {
				res.send("Whoops, *" + gameName + "* leaderboard does not exist.");
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