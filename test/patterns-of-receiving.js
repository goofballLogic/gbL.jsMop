var jsmop = require("../gbL.jsMop"),
	expect = require("expect.js"),
	expectExtensions = require("../util/expect-ext.js")
	;

var mop = new jsmop.Mop();

describe("Given an receiver", function() {

	mop.register({
		receive_subject_one : function(subjects, topicLists) {
			subjects.push(mop.subject);
			topicLists.push(mop.topics);
		},
		receive_subject_two : function(subjects, topicLists) {
			subjects.push(mop.subject);
			topicLists.push(mop.topics);
			mop.send(subjects, topicLists).as("subject three");
			subjects.push(mop.subject);
			topicLists.push(mop.topics);
		},
		receive_subject_three: function(subjects, topicLists) {
			subjects.push(mop.subject);
			topicLists.push(mop.topics);
		}
	});

	describe("When a message is received", function() {
		var subjects = [];
		var topicLists = [];

		mop.send(subjects, topicLists).as("subject one");

		it("Should have access to the matched subject", function() {
			expect(subjects).to.contain("subject one");
		});

		it("Should have access to the list of topics", function() {
			expect(topicLists).to.containEql([ "subject", "one"]);
		});
	});

	describe("When receiving a message results in the same object receiving a different message", function() {
		var subjects = [];
		var topicLists = [];

		mop.send(subjects, topicLists).as("subject two");

		it("Should have the correct subject/topics upon return of control to the handler for the first message", function() {
			expect(subjects).to.have.length(3);
			expect(topicLists).to.have.length(3);
			expect(subjects[2]).to.be("subject two");
			expect(topicLists[2]).to.eql(["subject", "two"]);
		});

	});
});

describe("Given a receive property", function() {

	var received = [];

	mop.reset().register({
		receive: {
			subjectOne : function(thing) {
				received.push(["subject one", thing]);
			},
			subjectTwo : function(thing) {
				received.push(["subject two", thing]);
			},
			ABCis42YearsOld: function(thing) {
				received.push(["ABC is 42 years old", thing]);
			}
		}
	});

	describe("When a matching message is sent", function() {
		mop.send("hello").as("subject one");

		it("Should have been received", function() {
			expect(received[0]).to.eql([ "subject one", "hello" ]);
		});
	});

	describe("When a message with stupidly complex subject is sent", function() {
		mop.send("hi").as("ABC is 42 years old");

		it("Should have been received", function() {
			expect(received[1]).to.eql(["ABC is 42 years old", "hi"]);
		});
	});
});

describe("Given an object which has a handler filter", function() {

	var thingStore = {
		things: [],
		receive_things: function(thing) {
			this.things.push(thing);
		}
	};

	thingStore.receive_things.filter = function(topics, data) {
		// no night-time things please:
		if(topics.slice(-1)=="night") return false;
		// nothing scary please:
		if(data[0].substr(0, 5)=="Scary") return false;
		return true;
	};

	mop.reset().register(thingStore);
	
	describe("When a message with non-matching topic is sent", function() {
		mop.send("bunny").as("things that go bump in the night");

		it("Should not receive the message", function() {
			expect(thingStore.things).to.not.contain("bunny");
		});
	});

	describe("When a message is sent with a non-matching message", function() {
		mop.send("Scary bunny").as("things that go bump in the day");

		it("Should not receive the message", function() {
			expect(thingStore.things).to.not.contain("Scary bunny");
		});
	});

	describe("When a matching message is sent", function() {
		mop.send("Vampire").as("things that go bump in the witching hour");

		it("Should receive the message", function() {
			expect(thingStore.things).to.contain("Vampire");
		});
	});
});

describe("Given a message handler which only returns one result", function() {
	
	mop.reset().registerHandler("some random message", function() { return 42; });

	describe("When I send it receives a message", function() {
		var result = mop.send().as("some random message");

		it("Should return the result as a plain value", function() {
			expect(result).to.be(42);
		});
	});

	describe("But when I request a list return", function() {
		var result = mop.send().forList().as("some random message");

		it("Should return an array with the one item", function() {
			expect(result).to.have.length(1);
		});
	});
});

describe("Given a receive", function() {
	var received = null, filterReceived = null;
	var receivingFunction = function() { received = arguments; };
	receivingFunction.filter = function(topics, data) { filterReceived = arguments; return true; };
	mop.reset().registerHandler("some random message", receivingFunction);
	describe("When I send nothing", function() {
		mop.send().as("some random message");
		it("should receive no arguments", function() {
			expect(received).to.be.empty();
		});

		it("filter should receive no data", function() {
			expect(filterReceived[1]).to.be.empty();
		});
	});
});