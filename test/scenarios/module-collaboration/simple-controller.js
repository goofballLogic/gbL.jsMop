var mop;

module.exports = {
	bootstrap : {
		init: function(jsmop) {
			mop = jsmop
				.register(new Controller(), "Simple controller");
		}
	}
};

var Controller = function() {

	var getMethod = function() {
		var route = mop.topics;
		route.shift();
		if(route.length<1) return;
		var action = route[0];
		switch(action) {
			case "report":
				mop.send().as("model populate");
				var report = mop.send().as("model report request");
				mop.send(report).as("model for view");
				break;
			case "jslint":
				// is annoying
				break;
			default:
				throw "[simple-controller] ERROR: Unknown action";
		}
	};

	return {
		receive_GET : getMethod
	};
};