var jsmop = require("../gbL.jsMop"),
	expect = require("expect.js")
	;

var mop = new jsmop.Mop();

describe("Given a registered objects with handlers", function() {

	var SubjectModule = function() {

		var subject1 = {
			receive_general_abuse : function(abuse) { return "You gave me " + abuse + ", I return love"; }
		};

		var subject2 = {
			receive_general_abuse : function(abuse) { return "You gave me " + abuse + ", I return hate"; }
		};

		this.bootstrap = {
			init: function(mop) { mop.register(subject1).register(subject2); }
		};
	};
	module.exports.subjectModel = new SubjectModule();
	mop.boot(module.exports);

	describe("When a message is sent with matching subject", function() {
		var returns = mop.send("hate").as("general abuse");

		it("Should return an array of all the returns", function() {
			expect(returns).to.have.length(2);
			expect(returns).to.contain("You gave me hate, I return love");
			expect(returns).to.contain("You gave me hate, I return hate");
		});
	});
});