var jsmop = require("../gbL.jsMop"),
	expect = require("expect.js")
	;

describe("Given some receivers", function() {
	function Receiver() { }
	var r1 = new Receiver();
	var r2 = new Receiver();
	var r3 = new Receiver();
	var mop = new jsmop.Mop();
	describe("When they are registered and a census message is sent", function() {
		var census = mop.register(r1, "R1").register(r2).register(r3, "R3").send().as("census");
		it("They should respond", function() {
			expect(census).to.have.length(3);
		});
		it("They should respond with object name if specified", function() {
			expect(census).to.contain("R1");
			expect(census).to.contain("R3");
		});
		it("They should respond with constructor name if object name not specified", function() {
			expect(census).to.contain("Receiver");
		});
	});
});