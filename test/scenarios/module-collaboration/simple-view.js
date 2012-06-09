var mop;

exports.bootstrap = {
	init: function(jsmop) {
		(mop = jsmop)
			.register(new SimpleView(), "Simple view");
	}
};

var SimpleView = function() {

	var render = function(model) {
		mop.send("<pretty>" + model + "</pretty>").as("view output");
	};

	return {
		receive_model_for_view:			render
	};
};