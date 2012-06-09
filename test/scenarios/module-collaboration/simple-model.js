var mop;

exports.bootstrap = {
	init: function(jsmop) {
		(mop = jsmop)
			.register(new SimpleModel(), "Simple model");
	}
};

var SimpleModel = function() {

	var state = "";

	var populate = function(){
		state = "I am the model";
	};

	var summarise = function() {
		return state;
	};

	return {
		receive_model_populate:			populate,
		receive_model_report_request:	summarise
	};
};