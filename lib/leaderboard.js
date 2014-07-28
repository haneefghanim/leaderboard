var redis = require('redis');

/**
* Leaderboard model, interacts with the underlying redis data
**/
function Leaderboard(redisHost, redisPort, redisAuth) {
	this.redisHost 	= redisHost;
	this.redisPort 	= redisPort;
	this.redisAuth 	= redisAuth;
	this.client 	= redis.createClient(redisPort, redisHost, {no_ready_check: true});
	this.leaderKey 	= "leaderboards";
	if (typeof redisAuth !== 'undefined') {
		this.client.auth(redisAuth);
	}

	// Redis error checking
	this.client.on("error", function (err) {
	    console.log("Redis error:  " + err);
	});

	return this;
}

/**
* Create game, return callback with success/failure
**/
Leaderboard.prototype.create = function(board, user, callback) {
	// Reserved keyword
	if (board == this.leaderKey) {
		callback(false, "Whoops, *" + board + "* is a reserved key word.");
		return;
	}

	var self = this;
	this.client.exists(board, function (err, value) {
	    if (err) throw(err)
	    if (value == true) {
	    	callback(false, "Whoops, *" + board + "* leaderboard already exists.");
	    } else {
	    	self.client.zadd(board, 1, user); // add user to new board
	    	self.client.sadd(self.leaderKey, board); // add board to list of boards
	    	callback(true, "Created leaderboard: *" + board + "*!");
	    }
	});
};

/**
* Deletes game, return callback with success/failure
**/
Leaderboard.prototype.delete = function(board, callback) {
	var self = this;
	this.client.exists(board, function (err, value) {
		if (err) throw(err)
		if (value == true) {
			self.client.del(board); // delete board
			self.client.srem(self.leaderKey, board); // remove board from list of boards
			callback(true, "Deleted leaderboard: *" + board + "*!");
		} else {
			callback(false, "Whoops, *" + board + "* leaderboard does not exist.");
		}
	});
};

/**
* Adds user to a leaderboard, return callback with success/failure
**/
Leaderboard.prototype.addUserToBoard = function(board, user, callback) {
	var self = this;
	this.client.zrevrangebyscore([board, "+inf", "-inf", 'WITHSCORES'], function (err, list) {
		if (err) throw(err)
		if (list.length > 1) {
			var maxScore = parseInt(list[1]);
			// Check if already in list
			self.client.zscore(board, user, function (err, score) {
				if (err) throw(err)
				if (score > 0) {
					callback(false, "Whoops, *" + user + "* is already in leaderboard *" + board +"*.");
				} else {
			    	self.client.zadd(board, maxScore+1, user); // add user to board
			    	callback(true, "Added *" + user + "* to leaderboard *" + board + "*!");
				}
			});

		} else {
			callback(false, "Whoops, *" + board + "* leaderboard does not exist.");
		}
    });
};

/**
* Removes user from a leaderboard, return callback with success/failure
**/
Leaderboard.prototype.removeUserFromBoard = function(board, user, callback) {
	var self = this;
	this.client.zcard(board, function (err, length) {
		if (err) throw(err)
		if (length > 0) {
			// Check if already in list
			self.client.zscore(board, user, function (err, score) {
				if (err) throw(err)
				if (score > 0) {
					self.client.zrem(board, length+1, user); // remove user from board
			    	callback(true, "Removed *" + user + "* from leaderboard *" + board + "*!");
				} else {
			    	callback(false, "Whoops, *" + user + "* is not in leaderboard *" + board +"*.");

				}
			});

		} else {
			callback(false, "Whoops, *" + board + "* leaderboard does not exist.");
		}
    });
};

/**
* Displays all leaderboards, return callback with success/failure
**/
Leaderboard.prototype.showAll = function(callback) {
	this.client.smembers(this.leaderKey, function (err, list) {
		var response = "*All leaderboards:*\n";
		for (i = 0; i < list.length; i++) {
			var row = ">" + list[i] + "\n";
			response = response+row;
		}
		callback(true, response);
	});
};

/**
* Displays users in a single leaderboard, return callback with success/failure
**/
Leaderboard.prototype.display = function (board, callback) {
	var self = this;
	this.client.exists(board, function (err, value) {
	    if (err) throw(err)
	    if (value == true) {
	    	self.client.zrangebyscore([board, "-inf", "+inf"], function (err, list) {
	    		var response = "*"+board+" leaderboard:*\n";
	    		for (i = 0; i < list.length; i++) {
	    			var row = ">" + (i+1) + ") " + list[i] + "\n";
	    			response = response+row;
	    		}
	    		callback(true, response);
    	});
	    } else {
	    	callback(false, "Whoops, *" + board + "* leaderboard does not exist.");
	    }
	});
};

/**
* Takes winner and loser of a game, rearranges leaderboard, return callback
**/
Leaderboard.prototype.win = function(board, winner, loser, callback) {
	var self = this;
	this.client.zrangebyscore([board, "-inf", "+inf"], function (err, list) {
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
						self.client.zadd(board, i+1, list[i]);
					}

					callback(true, "*" + winner + "* took position number "+(loserIndex+1)+" from *" + loser + "* in *"+ board + "*!");
				} else {
					// Don't rearrange
					callback(true, "*" + winner + "* defended position number "+(winnerIndex+1)+" against *" + loser + "* in *"+ board + "*!");
				}
			} else {
				callback(false, "Whoops, one or both of *" + winner + "* and *" + loser + "* are not in leaderboard *"+ board + "*.");
			}

		} else {
			callback(false, "Whoops, *" + board + "* leaderboard does not exist.");
		}
    });
};

// Export Leaderboard
module.exports = Leaderboard;