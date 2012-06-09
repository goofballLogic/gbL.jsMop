var jsmop = require("../../../gbL.jsMop"),
	expect = require("expect.js")
	;

var mop = new jsmop.Mop();

describe("Given an MVC", function() {
	
	var outputs = [];
	module.receive_view_output = function(output) { outputs.push(output); };
	
	mop
		.boot({
			model: require("./simple-model"),
			view: require("./simple-view"),
			controller: require("./simple-controller")
		})
		.register(module); // to receive view output

	describe("When I send GET report", function() {
		mop.send().as("GET report");

		it("Should return a report view", function() {
			expect(outputs).to.contain("<pretty>I am the model</pretty>");
		});
	});
});