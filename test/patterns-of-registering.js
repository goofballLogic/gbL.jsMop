var jsMop = require("../gbL.jsMop"),
	expect = require("expect.js")
	;

(function() {

	describe("Given registered object with register member", function() {

		var mop = new jsMop.Mop();

		var obj1 = function() {
			var I = { register : function() { }, send: {}, receive: {} };
			I.send.helloWorld = function(message) { };
			I.receive.spawn = buildObject2;
			return I;

			function buildObject2() {
				// create object
				I.register(new Object2(), "Object 2");
				// send message
				I.send.helloWorld("hi");
			}
		}();

		mop.register(obj1, "Object 1");

		var received = [];
		function Object2() {
			this.receive = {
				"helloWorld" : function(message) { received.push(message); }
			};
		}

		describe("When object receives message to spawn object2", function() {

			mop.send().as("spawn");

			it("it should create the object, register it and exchange a hello world message", function() {

				expect(received.length).to.equal(1);
				expect(received[0]).to.equal("hi");

			});

			describe("and when object1 is uninstalled", function() {

				mop.unregister(obj1);

				it("it should no longer be able to register objects", function() {

					received = [];
					obj1.receive.spawn();
					mop.send("hi 2").as("hello world");

					expect(received.length).to.equal(1); // would be two if "register" was not unregistered, or three if both "register" and "send" were not unregistered.

				});

			});

		});

	});

})();