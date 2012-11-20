var jsMop = require("../gbL.jsMop"),
	expect = require("expect.js")
	;

(function() {

	describe("Given module with bootstrap object", function() {

		var mop = new jsMop.Mop();
		var bootCalls = [];
		var module = {
			bootstrap: { init: function() { bootCalls.push(arguments[0]); } }
		};

		describe("When booted", function() {

			mop.boot({
				"module with bootstrap object" : module
			});

			it("Should have received a bootstrap call", function() {

				expect(bootCalls).to.eql([ mop ]);

			});
		});
	});

})();

(function() {

	describe("Given module with bootstrap function", function() {

		var mop = new jsMop.Mop();
		var bootCalls = [];
		var module = {
			bootstrap: function() { bootCalls.push(arguments[0]); }
		};

		describe("When booted", function() {

			mop.boot({
				"module with bootstrap object" : module
			});

			it("Should have received a bootstrap call", function() {

				expect(bootCalls).to.eql([ mop ]);

			});
		});
	});


})();