(function() {
	
	// namespace and exports
	var jsMop = (typeof(module) == "undefined") ?
		((window.gbL = window.gbL || {}).jsMop = {}) :
		module.exports;

	// statics
	function first(list, matchTest) {
		for(var i = 0; i < list.length; i++) {
			if (matchTest(list[i])) return list[i];
		}
		return null;
	}

	function argsToArr(args) {
		return Array.prototype.slice.apply(args);
	}

	function removeWiresForHandler(handler, handlerRegister) {
		if(!handlerRegister.hasOwnProperty(handler)) return;
		var wires = handlerRegister[handler].wires;
		for(var i = 0; i < wires.length; i++) {
			var wire = wires[i];
			wire.hub.removeWire(wire);
		}
		handlerRegister[handler].wires = [];
	}

	function findReceiveMethodProperties(owner) {
		var ret = [];
		for(var propName in owner) {
			if(propName.length > 8 && propName.substr(0, 8) == "receive_" && typeof(owner[propName]) == "function") {
				ret.push(propName);
			}
		}
		return ret;
	}

	function setReceiveFilters(owner, filter) {
		var actions = findReceiveMethodProperties(owner);
		for(var i in actions) {
			var propName = actions[i];
			owner[propName].filter = filter;
		}
	}

	// utility constructors
	var Hub = function(topic, parent) {
		this.topic = topic;
		this.wires = [];
		this.hubs = [];
		this.parent = parent;
		this.firstChildHubOfTopic = function(topic) {
			return first(this.hubs, function(h) { return h.topic == topic; });
		};
		this.removeWire = function(wire) {
			var i = this.wires.indexOf(wire);
			this.wires.splice(i, 1);
		};
		this.toString = function() {
			return "[ Hub: " + topic + " ]";
		};
	};

	var Wire = function(handler, owner, hub, ownername) {
		this.handler = handler;
		this.owner = owner;
		this.hub = hub;
		this.ownername = ownername;
		this.toString = function() {
			return "[ Wire: " + this.ownername + " ]";
		};
	};

	
	// mop constructor

	jsMop.Mop = function() {
	
		var rootHub = new Hub("root"),
			handlerRegister = {};

		// revealed members
		var mop = {
			// boot a mop from a context in order to autoregister handlers for topics
			boot: boot,
			// reset a mop which unregisters all handlers
			reset: reset,
			// register an object, which autoregisters all its handlers
			register: registerObject,
			// unregistrer an object, which unregisters all its handlers
			unregister: unregisterObject,
			// unregister a handler
			unregisterHandler: unregisterHandler,
			// register a handler
			registerHandler: registerHandler,
			// send a message
			send: send,
			// set up filters on all handlers for a given object
			setReceiveFilters: setReceiveFilters,
			// do something within the context of temporarily registered objects
			withRegistered: registrationClosure
		};

		// closure specific constructors
		var NavigationState = function(newSubject, newTopics) {
			this.subject = mop.subject;
			this.topics = mop.topics;
			mop.subject = newSubject;
			mop.topics = newTopics;
			this.undo = function() {
				mop.subject = this.subject;
				mop.topics = this.topics;
			};
		};

		// private members
		function boot(context) {
			for(var oname in context){
				var o = context[oname];
				if(o!==null && o.hasOwnProperty("bootstrap") && (o.bootstrap!==null)) {
					if(typeof(o.bootstrap.init)==="function") {
						o.bootstrap.init(mop);
					}
				}
			}

			return mop;
		}

		function reset() {
			var handlerList = [];
			for(var key in handlerRegister) handlerList.push(key);
			for(var i in handlerList){
				mop.unregisterHandler(handlerList[i]);
			}
			return mop;
		}

		function registerObject(toRegister, objectName) {
			if(!toRegister.hasOwnProperty("receive_census"))
				toRegister.receive_census = function() { return objectName || toRegister.constructor.name; };

			var actions = findReceiveMethodProperties(toRegister);
			for(var i in actions) {
				var propName = actions[i],
					topicList = propName.substr(8).split("_");
				mop.registerHandler(topicList.slice(0), toRegister[propName], toRegister, objectName);
			}
			return mop;
		}

		function unregisterObject(toUnregister) {
			for(var oname in toUnregister) {
				if(oname.length > 8 && oname.substr(0, 8) == "receive_") {
					var handler = toUnregister[oname];
					mop.unregisterHandler(handler);
				}
			}
			return mop;
		}

		function unregisterHandler(handler) {
			removeWiresForHandler(handler, handlerRegister);
			delete handlerRegister[handler];
			return mop;
		}

		function registerHandler(topicList, handler, owner, ownerName) {
			if(typeof(topicList) == "function") throw("Incorrect call to RegisterHandler. Should be: topicList, handler, [owner, [objectName]]");
			if(!topicList.shift) {
				topicList = topicList.split(" ");
			}
			// if necessary remove "global" hub prefix
			if (topicList.length > 0 && topicList[0] == "global") topicList.shift();
			// if necessary, create an owner
			owner = owner || {};

			var hub = rootHub,
				topicListCopy = topicList.slice(0);

			while(topicList.length > 0) {
				var topic = topicList.shift(),
					nhub = hub.firstChildHubOfTopic(topic);
				if (nhub === null) {
					nhub = new Hub(topic, hub);
					hub.hubs.push(nhub);
				}
				
				hub = nhub;
			}

			var wire =  new Wire(handler, owner, hub, ownerName);

			hub.wires.push(wire);

			if(typeof(handlerRegister[handler])=="undefined") handlerRegister[handler] = { hubs: [], wires: [] };
			var register = handlerRegister[handler] || { hubs: [], wires: [] };
			handlerRegister[handler] = register;
			register.hubs.push(hub);
			register.wires.push(wire);

			if(mop.debug || mop.registerHandler.debug) console.log("Registered", objectName || "anon.", topicListCopy, wire, hub);
			
			return mop;
		}

		function sendWires(node, returned, received) {

			for(var i = 0; i < node.hub.wires.length; i++)
			{
				var navState = new NavigationState(node.subject, node.topics),
					wire = node.hub.wires[i],
					accepted = true,
					response = null,
					args = Array.prototype.slice.call(node.payload)
					;
				
				if(typeof(wire.handler.filter) == "function") {
					accepted = wire.handler.filter.call(wire.owner, node.topics, args);
					if(mop.debug || mop.send.debug) console.log(wire.toString(), "filter returned: ", accepted);
				}
				
				if(accepted) {
					if(mop.debug || mop.send.debug) console.log(node.hub.toString(), wire.toString(), node.topics, args);
					response = wire.handler.apply(wire.owner, args);
				}

				received++;
				if(response!==null) returned.push(response);
				navState.undo();
			}

			return received;
		}

		function send() {

			var settings = {
				payload: Array.prototype.slice.call(arguments),
				forArray: false
			};

			var ret = {
				forList: function() {
					settings.forArray = true;
					return this;
				},

				withSubject: function() {

					var topics;
					if(arguments.length==1)
						topics = arguments[0].split(" ");
					else
						topics = Array.prototype.slice.call(arguments);

					var ret = [],
						received = 0,
						node = {
							hub: rootHub,
							topics: topics.slice(0),
							subject: topics.join(" "),
							payload: settings.payload
						},
						topic = topics.shift()
						;
					
					received = sendWires.call(this, node, ret, received);

					while(node.hub!==null && typeof(topic) != "undefined") {
						node.hub = node.hub.firstChildHubOfTopic(topic);
						if(node.hub!==null) {
							received = sendWires.call(this, node, ret, received);
						}
						topic = topics.shift();
					}

					if((mop.debug || mop.send.debug || mop.debug_dropped) && received===0) console.log("Unreceived", node.topics);
						
					if(!settings.forArray && ret.length === 1) ret = ret[0];
			
					return ret;
				}

			};

			ret.as = ret.withSubject;

			return ret;

		}

		function registrationClosure() {
			var args = Array.prototype.slice.call(arguments);
			var callback = args.pop();
			if(typeof(callback)!="function") return;
			for(var iRegister in args) registerObject(args[iRegister]);
			var toRethrow = null;
			try {
				callback();
			} catch(e) {
				toRethrow = e;
			}
			for(var iUnregister in args) unregisterObject(args[iUnregister]);
			if(toRethrow!==null) throw(toRethrow);
		}

		return mop;
	};

}());