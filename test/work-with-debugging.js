var jsmop = require("../gbL.jsMop"),
	expect = require("expect.js")
	;

var mop = new jsmop.Mop();

describe("Given a hub with registered handlers", function() {

	var obj1 = {
		receive: { helloWorld : function(message) { } }
	};

	var obj2 = {
		send: {
			helloWorld: function(message) { },
			goodbyeWorld: function(message) { },
			sometimesWorld: function(message) { }
		}
	};

	var obj3 = {
		receive: { sometimesWorld: function(message) { } }
	};
	obj3.receive.sometimesWorld.filter = function(topics, payload) { return "magic" == payload[0]; };

	var log = [];

	mop.register(obj1, "obj 1");
	mop.register(obj2, "obj 2");
	mop.register(obj3, "obj 3");
	mop.registerHandler(["_messageLog"], function(detail) {
		log.push(JSON.parse(JSON.stringify(detail)));
	});

	describe("When a message is sent", function() {

		before(function() {
			log = [];
			obj2.send.helloWorld("hi there");
		});

		it("the message sending should be logged", function() {
			expect(log[0].category).to.eql("sent");
			expect(log[0].topics).to.eql(["hello", "world"]);
			expect(log[0].payload).to.eql([ "hi there" ]);
			expect(log[0].subject).to.eql("hello world");
		});

		it("the message receiving should be logged", function() {
			expect(log[1].category).to.eql("received");
			expect(log[1].topics).to.eql([ "hello", "world" ]);
			expect(log[1].payload).to.eql([ "hi there" ]);
			expect(log[1].subject).to.eql("hello world");
			expect(log[1].receiver).to.eql("obj 1");
		});

	});

	describe("When an unreceived message is sent", function() {

		before(function() {
			log = [];
			obj2.send.goodbyeWorld("yo momma");
		});

		it("the message drop should be logged", function() {
			expect(log[1].category).to.eql("dropped");
			expect(log[1].topics).to.eql([ "goodbye", "world" ]);
			expect(log[1].payload).to.eql([ "yo momma" ]);
			expect(log[1].subject).to.eql("goodbye world");
		});

	});

	describe("When a message which is unreceived due to filtering", function() {

		before(function() {
			log = [];
			obj2.send.sometimesWorld("not magic");
			obj2.send.sometimesWorld("magic");
		});

		it("one message drop should be logged", function() {
			expect(log[1].category).to.eql("dropped");
			expect(log[3].category).to.eql("received");
		});
	});

});