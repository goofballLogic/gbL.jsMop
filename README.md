
# gbL.jsMop

## Preamble
http://www.purl.org/stefan_ram/pub/doc_kay_oop_en

## Sending messages
When I think about OO, I think of objects like individual biological cells, which can communicate by emitting messages which can be absorbed by nearby cells.

This is a bit different than the normal paradigm in most C-like languages - javascript, C#, Java etc.

Where, in normal javascript, I would write

    listView.render(viewData);
    
I would really rather do something like

    send.renderViewList(viewData);

and have this message picked up by the appropriate view. It means I don't have to retain a reference to the receiving object(s), and it fits the biological model more closely.

In the recipient, I would like to specify messages I will receive. Something like

    receive.renderView(viewData);
    
However, this kind of paradigm doesn't really exist at a native level in javascript. You can simulate this kind of thing in many ways, including things like the Observer pattern, Bus architectures and Blackboard patterns/architectures.

I wanted something simple, flexible, but also something that worked with a minimum of effort. So I write the gbL.jsMop script as a workaround.

## tl;dr / Show me the money

Here we create a <code>mop</code> object, and create+register a <code>Controller</code> object and two <code>View</code> objects. Then I send a "show names" message through the <code>mop</code> which is received by the <code>Controller</code>. The <code>Controller</code> then processes the data into a view model and sends a "render view list" message. The "List" <code>View</code> object receives this message and renders itself using the view model sent by the <code>Controller</code>.

    var mop = new gbL.jsMop()
    	.register(new Controller(), "List controller")
    	.register(new View("List"), "List view")
    	.register(new View("AnOther"), "AnOther view")
    	;
    	
	var data = [
		{ name: "Jessie" },
		{ name: "Imran" }
	];
	
	// send a message directly from the mop just for test purposes
	mop.send(data).as("show names");
	
    function Controller() {
    
    	var I = { send: function() {}, receive: {} };
		
		// messages I send
		I.send.renderViewList = function(viewData){};
		
		// messages I receive
		I.receive.showNames = function(items) {
			var viewData = generateNameListViewModel(items);
			I.send.renderViewList(viewData);
		};
		
		return I;
		
		function generateNameListViewModel(items) {
			. . .
		}
    }
    
	function View(viewName) {
	
		var I = { receive: {} };
		
		// messages I receive
		I.receive.renderView = function(viewData) {
			renderSelf(viewData);
		}
		// ... but only messages ending with my name
		I.receive.renderView.filter = function(topics, data) {
			return topics[topics.length] === viewName;
		}
		
		return I;
		
		function renderSelf(viewData) {
			. . .
		}
	}
 
## Modular design
I also want to be able to divide my code up into dependency-free units. I don't want my constructor functions for each class of object to reference each other at design time any more than I want my objects to reference each other at run-time….

So I added the bootstrap pattern. For example:

main.js

	var mop = new gbL.jsMop().boot({
		"View factory" : require("./viewFactory"),
		"List controller" : require("./listController"),
	});
	
viewFactory.js

    module.exports.init = function(mop) {
    	mop.register(new ViewFactory(mop), "View factory");
    };
    
	function ViewFactory(mop) {
		var I = { receive: {} };
		
		// messages I receive
		I.receive.buildView = function(viewName) {
			var view = new View(viewName);
			mop.register(view, viewName + " view");
		};
		
		return I;
	}

	function View(viewName) {
		. . .
	}

listController.js

	module.exports.init = function(mop) {	
		mop.register(new Controller(), "List controller");
	}
	
    function Controller() {
    
    	var I = { send: function() {}, receive: {} };
		
		// messages I send
		I.send.buildView = function(){};
		I.send.renderViewList = function(viewData){};
		
		// messages I receive
		I.receive.showNames = function(items) {
			ensureListView();
			var viewData = generateNameListViewModel(items);
			I.send.renderViewList(viewData);
		};
		
		return I;
		
		function ensureListView() {
			I.send.buildView("List");
			ensureListView = function() { }; // naughty
		}
		
		function generateNameListViewModel(items) {
			. . .
		}
    }


## Environment
Designed to work specifically in the browser, or in Node, but should work in most CommonJS environments.

## Running/Building tests
####Without a browser (mocha)
You will need to

    npm install mocha
    npm install expect.js

and then

    make test

####In the browser
Just browse to 

    test-browser/browserTests.html

####Building (and opening) the browser tests
You will need to

    npm install browserify

and then

    make browser-test


# Up-to-date example (if below==tl;dr)

The constructor is divided into two sections:

1. Define the messages received and/or sent
2. Define business logic in functions
 
Below the sections are divided by the line "return I;"

    function Controller() {
    
		// I will both send and receive messages
		var I = { receive: {}, send: {} };
		
		// the "render view" message - intended for registered Views to receive
		I.send.renderView = function(viewName, data, res){};
		
		// the "model update request" message - intended for the model
		I.send.modelUpdateRequest = function(command){};
		
		// the router creates this message on receiving GET /documentList
		I.receive.GETdocumentList = function(req, res) {
        	listDocuments(function(data) {
        		I.send.renderView("document-list", data, res);
        	});
        };
		
		return I;
		
		function listDocuments(callback) {
			// send a "list-documents" command to the model
			I.send.modelUpdateRequest("list-documents", function(domain) {
				callback(domain.documents);
			});
		}
    }

An object of this type can be registered as normal:

    var mop = new gbL.jsMop();
    mop.register(new ns.Controller(), "Documents controller");
    mop.register(new ns.ListDocumentsView(), "List documents view");
    mop.reigster(new ns.DomainCommandProcessor(), "Command interface for the domain");

or, using the bootstrap pattern (see below):

    new gbL.jsMop().boot({
        "controller" : require("./controllers/Controller.js"),
        "documents view" : require("./views/ListDocuments.js"),
        "domain command processor" : require("./model/CommandProcessor.js")
    });
    
For this to work, Controller.js would have to include the bootstrapping code which allows modules to initialise themselves and register objects. It would end up looking something like:

    module.exports.bootstrap = function(mop) {
    	mop.register(new Controller(), "Documents controller");
    };

	function Controller() {
		. . . code (as above) goes here . . .
	}


# tl;dr

### No, really - I mean it. tl;dr

# Version specific notes
Unless otherwise indicated, the material in the Pervious Versions section still applies

## New in version 0.9.7

Tuesday, 20 November 2012
Version 0.9.7

### New pattern of registering receive and send messages
The principle change in this version is a new facility to receive and send which allows a slightly cleaner syntax. It also encourages you to declare the messages you will send ahead-of-time.

#### "Interface" concept
Objects can now simulate declaration of an interface using the revealing module pattern. Often you will see this:

    function Controller() {
    
		var I = {
			// public members here
		};
    
		return I;
		
		// private functions here
		
    }
    
#### Receiving and sending
An object wishing to receive and/or send should now declare a receive and or send attribute:

    function Controller() {
    
		var I = {
			receive: {
				// messages to receive here
			},
			send: {
				//messages to send here
			}
		}
		
		return I;
		
		// private functions here
    }

#### No more underscoring
Messages in these receive and send attributes should be declared using simple camel casing

e.g.

    this.receive_add_commit_message = function(stuff) {
    	// do something with the stuff received
    };

should now be written as

	this.receive.addCommitMessage = function(stuff) {
		// do something with the stuff received
	};

#### Collect senders at the top
To make debugging easier, declare your senders at the top as (usually) empty functions:

e.g.

    this.send.addCommitMessage = function(stuff){};
    
after the object is registered, will send a message with subject "add commit message". The inclusion of parameters in the empty function definition is useful as documentation. In addition, you can add your own action which will be called after the message is sent.

e.g.

    this.send.addCommitMessage = function(stuff) {
    	log("A commit message has been sent");
    };
    
## Base Version - 0.9.3
Sunday, 10 June 2012  
Version 0.9.3  

## Examples
Example usage can be found in the /test/scenarios folder.

### Basic usage

####First step is to spin up a hub for the messages:

    var mop = new gbL.jsMop.Mop();

or

    var mop = new require("gbL-jsMop").Mop();

####Sending

Then, to send a message:

    mop.send("Hello world").as("test");

which sends a message with subject __*test*__ and payload of __*Hello world*__.

####Receiving
If I am an object wanting to receive this sort of message, I would include a method named __receive_test__:

    var receiver = {
        receive_test: function(data) {
            console.log(data);
        }
    };

and I would register with the hub to receive messages:

    mop.register(receiver, "My first receiver");

#####_or_

if I don't wish to register as an object, I can regsiter a call back function:

    mop.registerHandler("test", function(data) {
        console.log(data);
    });

##Debugging
There are a few tools to help with debugging message passing. For analysis of registered objects and handlers, just send a census message:

	var registered = mop.send().as("census");
	console.log("Registered receivers: " + registered.join(", ");
	
You may also wish to turn on console logging by using:

	mop.debug = true;
	
or

	mop.send.debug = true;

##Bootstrapping modules
Say you have a set of modules which contain objects wishing to participate in message exchange through a given mop. 

For example, in Node, you might have a console-logger.js:

	(function(context) {
		
		var mop;
		
		context.bootstrap = function(initMop) {
			mop = initMop;
			initMop.Register(loggingSingleton, "Console logger");
		}
		
		var loggingSingleton = new function() {
			return {
				receive_log: function(data) {
					var label = mop.topics.slice(1).join(" ");
					console.log(label, data);
				}
			};
		}();
		
	})(module.exports);
	
and then as part of bootstrapping, include the console-logger:

	var mop = new require("gbL-jsMop").Mop();
	mop.boot({
		"logger": require("console-logger"),
		"worker": require("important-worker-module"),
		"another": require("another-important-worker-module")
	});

which will mean that e.g. the following will print my friend's name to the console:

	mop.send("Lisa Jue Bishop").as("log the name of my dear friend");
	
#####Or
In the browser, you might have a ticker object:

	(function(context) {
		var mop;
		
		context.Ticker = {
			bootstrap: function(jsMop) {
				mop = jsMop;
				mop.register(new Ticker(), "Ticker");
			}
		};
		
		function Ticker() {
			// private state and behaviours
			var cancelled = false;
			function tick() {
				mop.send().as("tick");
				if(!cancelled) setTimeout(100, tick);
			}
			// message receivers
			return {
				receive_cancel_ticker: function() {
					cancelled = true;
				}
			}
		}
		
	})(gbL.Stocks || { gbL.Stocks = {} });

which you could then boot as so:

	var mop = new gbL.jsMop.Mop();
	mop.boot({
		"ticker": gbL.Stocks.Ticker,
		"symbol-list": gbL.Stocks.SymbolLister
	});
	
which will cause <code>tick</code> messages to be sent until:

	mop.send().as("cancel ticker");
	
is sent.
	
##Further patterns

####Partial subject match
If you want to accept messages about a more general subject than those specified for the messages, you can receive messages which match the start of the subject:

    function HelloListener() {
    	this.receive_hello = function() {
    		console.log(mop.subject);
    	};
    }

would receive:

	mop.send().as("hello world");
	
but would also receive:

	mop.send().as("hello heaven");
	mop.send().as("hello hell");

####Filtering messages
If you want to filter the messages received for a given subject, you can attaching a filtering function, like so:

    function BeerWatcher() {
    	this.receive_important_notification = function(notification) {
    		console.log("CRITICAL: " + notification);
    	};
    	this.receive_important_notification.filter = function(topics, data)
    	{
    		// only interested in notifications mentioning beer in their subject
    		return ~topics.join(" ").indexOf("beer");
    	};
    }

####Filtering lots of handlers
If you have an object which only wants to receive messages which mention a specific ID, you can:

	function CalculationNode(nodeId, calculationStrategy) {
		// private state and behaviour
		var parameters, lastResult;
		function reset(preserveResult) { 
			parameters = [];
			preserveResult || lastResult = null; 
		}
		function execute() {
			return (lastResult = calculationStrategy.apply(this, parameters));
		}
		reset();
		
		// message receivers
		this.receive_reset_parameters = function() {
			reset(true);
		};
		this.receive_parameterise = function() {
			for(var i in arguments) parameters.push(arguments[i]);
		};
		this.receive_calculate = function() {
			mop.send(execute()).as("result for node " + nodeId);
		};

		mop.setReceiveFilters(this, function(topics, data) {
			// all the above, only for messages about this node (by Id)
			return ~topics.indexOf("node " + nodeId);
		});
		
		// unfiltered receivers
		this.receive_global_reset = function() {
			reset();
		};
		this.receive_return_results = function() {
			return new function() { this[nodeId] = lastResult; };
		}
	}

####Adapter
You may wish to use an adapter to send and receive messages, especially when you want to mix the message-passing paradigm with calling methods directly. For example, using the revealing module pattern, you might do something like:

    function ServiceAgent() {

        var configuration = null;
		var fetched = [];
		
        function saveConfiguration(config) {
            configuration = $(config).clone();
        }
        
		function dataGet(toGet) {
			return mop
				.send(configuration.baseUrl, toGet)
				.as("ajax GET");
		}
		
		function injestData(data) {
			fetched.push(data);
		}
		
        // inner facet (mop adapter)
        mop.register({
        	receive_configuration: saveConfiguration,
        	receive_data_received: injestData,
        }, "Service Agent");
        
		// outer facet (revealed methods)
        return {
            listOrders: function() {
            	var data = null;
            	if(dataGet("orders")) data = fetched.pop();
            	return data;
           	}
        };
    }

An object constructed by this function will expect to collaborate with
 - An object whose responsibility is to broadcast configuration (sending messages with subject "configuration")
 - An object whose responsibility is to make AJAX calls (receiving subjects beginning with "ajax", and sending back the data with subject "data received")

And it exposes a method which can be called directly as so:

    var serviceAgent = new ServiceAgent();
    var orders = serviceAgent.listOrders();
    

