var https = require('https');

/**
* Leaderboard model, interacts with the underlying redis data
**/
function Slack(apiKey) {
  this.apiKey = apiKey;
  return this;
}

/**
* Fetches list of all users
**/
Slack.prototype.getUsers = function(method, success, error) {
	// TODO
};

/**
* Sends a message to a specific Slack channel
**/
Slack.prototype.sendToChannel = function(channel, message) {
	this.request("chat.postMessage", "channel="+encodeURI(channel)+"&text="+encodeURI(message));
};

/**
* Internal helper to send Slack API calls
**/
Slack.prototype.request = function(method, arguments, success, error) {
  	var options = {
		  hostname: 'slack.com',
		  port: 443,
		  path: '/api/'+method+"?username=leaderbot&token="+encodeURI(this.apiKey)+"&"+arguments, // kinda hacky, should pass in obj
		  method: 'GET'
	};

	console.log('/api/'+method+"?username=leaderbot&token="+encodeURI(this.apiKey)+"&"+arguments)

	var req = https.request(options, function(res) {
		res.setEncoding('utf8');
		res.on('data', function(body) {
			if (typeof success !== 'undefined') {
				success(body, res.statusCode, res.headers);
			}
		});
	});
	
	req.end();

	req.on('error', function(e) {
		if (typeof error !== 'undefined') {
			error(e);
		}
	});
};

// export the class
module.exports = Slack;