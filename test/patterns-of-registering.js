var jsMop = require("../gbL.jsMop"),
	expect = require("expect.js")
	;

(function() {

	function Object1(received) {
		var I = { bus : {}, send: {}, receive: {} };

		var obj2 = null;

		I.bus.register = function() { };

		I.send.helloWorld = function(message) { };
		I.receive.spawn = buildObject2;
		I.receive.unspawn = unregisterObject2;

		return I;

		function buildObject2() {
			// create object
			obj2 = new Object2(received);
			I.bus.register(obj2, "Object 2");
			// send message
			I.send.helloWorld("hi");
		}

		function unregisterObject2() {
			console.log("Unregistering");
			I.bus.unregister(obj2);
		}

	}

	function Object2(received) {
		this.receive = {
			"helloWorld" : function(message) { received.push(message); }
		};
	}

	describe("Given registered object with register member", function() {

		var mop = new jsMop.Mop();
		var received = [];
		var obj1 = new Object1(received);
		mop.register(obj1, "Object 1");

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

					expect(received.length).to.equal(0); // would be 1 if "register" was not unregistered, or 2 if both "register" and "send" were not unregistered.

				});

			});

		});

	});

	describe("Given registered object with register member", function() {

		var mop = new jsMop.Mop();
		var received = [];
		var obj1 = new Object1(received);
		mop.register(obj1, "Object 1");

		describe("When object receives message to spawn object2", function() {

			mop.send().as("spawn");
		
			describe("and when it receives message to unspawn object2", function() {

				mop.send().as("unspawn");

				it("object2 should no longer receive hello worlds", function() {

					received = [];
					mop.send("hi 3").as("hello world");

					expect(received.length).to.equal(0);

				});

			});

		});

	});

})();