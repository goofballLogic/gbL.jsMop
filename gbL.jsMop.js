(function() {
	
	// VERSION: 0.14.0
	// License: MIT
	
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

	function indexOf(list, item) {
		if(list.indexOf) return list.indexOf(item);
		for(var i in list) {
			if(list[i]===item) return i;
		}
		return -1;
	}

	function argsToArr(args) {
		return Array.prototype.slice.apply(args);
	}

	function removeWiresForHandler(handler, handlerRegister) {
		var wires = handlerRegister.find(handler);
		for(var i = 0; i < wires.length; i++) {
			var wire = wires[i];
			wire.hub.removeWire(wire);
		}
		wires.length = 0;
	}

	function MethodDef(funcOwner, funcName, topics) {
		this.topics = topics;
		this.action = funcOwner[funcName];
		this.substitute = function(wrapper) { funcOwner[funcName] = wrapper; };
	}

	function findReceiveMethods(owner) {
		var ret = [];
		for(var propName in owner) {
			if(propName.length > 8 && propName.substr(0, 8) == "receive_" && typeof(owner[propName]) == "function") {
				ret.push(
					new MethodDef(owner, propName, propName.substr(8, propName.length - 8).split("_"))
				);
			}
		}
		var receives = owner.receive;
		if(receives && typeof(receives) == "object") {
			for(var ccName in receives) {
				ret.push(
					new MethodDef(receives, ccName, splitCamelCase(ccName))
				);
			}
		}
		return ret;
	}

	function findSendMethods(owner) {
		var ret = [];
		for(var propName in owner) {
			if(propName.length > 5 && propName.substr(0, 5) == "send_" && typeof(owner[propName]) == "function") {
				var topics = propName.substr(5, propName.length - 5).split("_");
				ret.push(new MethodDef(owner, propName, topics));
			}
		}
		var sends = owner.send;
		if(sends && typeof(sends) == "object") {
			for(var ccName in sends) {
				ret.push(
					new MethodDef(sends, ccName, splitCamelCase(ccName))
				);
			}
		}
		return ret;
	}

	function formatTopic(topic) {
		if(!topic || topic==="") return topic;
		if(casify(topic[1])>-1) return topic;
		if(topic.length==11) return topic;
		return topic[0].toLowerCase() + topic.substr(1, topic.length - 1);
	}

	function casify(ch) {
		if(/[A-Z]/.test(ch)) return 1;
		if(/[0-9]/.test(ch)) return 0;
		return -1;
	}

	function splitCamelCase(name) {
		var ret = [],
			topic = "";

		for(var i in name) {
			if(topic==="") {
				topic += name[i];
			} else {
				var lastCase = casify(topic.charAt(topic.length - 1)),
					thisCase = casify(name[i]),
					isSame = lastCase===thisCase,
					isCamelHump = (lastCase === 1) && (thisCase === -1) && (topic.length === 1);

				if(isSame || isCamelHump) {
					topic += name[i];
				} else {
					ret.push(formatTopic(topic));
					topic = name[i];
				}
			}
		}
		if(topic!=="") ret.push(formatTopic(topic));
		return ret;
	}

	function setReceiveFilters(owner, filter) {
		var actions = findReceiveMethods(owner);
		for(var i in actions) {
			actions[i].action.filter = filter;
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

	var HandlerRegister = function() {
		var handlers = [];
		var registrations = [];
		this.listHandlers = function() {
			return handlers.slice(0);
		};
		this.find = function(handler) {
			var i = indexOf(handlers, handler);
			if(i < 0) {
				handlers.push(handler);
				i = indexOf(handlers, handler);
				registrations[i] = [];
			}
			return registrations[i];
		};
		this.remove = function(handler) {
			var i = indexOf(handlers, handler);
			if(i > -1) {
				handlers.splice(i, 1);
				registrations.splice(i, 1);
			}
		};
	};

	// mop constructor

	jsMop.Mop = function() {
	
		var rootHub = new Hub("root"),
			handlerRegister = new HandlerRegister()
			;

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

				if(o && o.hasOwnProperty("bootstrap") && (o.bootstrap!==null)) {
					if(typeof(o.bootstrap)==="function") {
						o.bootstrap(mop);
					}
					if(typeof(o.bootstrap.init)==="function") {
						o.bootstrap.init(mop);
					}
				}

			}

			return mop;
		}

		function reset() {
			var handlerList = handlerRegister.listHandlers();
			for(var i in handlerList){
				mop.unregisterHandler(handlerList[i]);
			}
			return mop;
		}

		function registerObject(toRegister, objectName) {
			if(!toRegister.hasOwnProperty("receive_census"))
				toRegister.receive_census = function() { return objectName || toRegister.constructor.name; };

			var receiveActions = findReceiveMethods(toRegister);
			for(var ri in receiveActions) {
				var rAction = receiveActions[ri];
				mop.registerHandler(rAction.topics, rAction.action, toRegister, objectName);
			}

			var sendActions = findSendMethods(toRegister);
			for(var si in sendActions) {
				var sAction = sendActions[si];
				installSender(sAction.topics, sAction.action, toRegister, objectName, sAction.substitute);
			}

			if(toRegister.hasOwnProperty("bus")) {
				installBusUtils(toRegister.bus);
			}

			return mop;
		}

		function unregisterObject(toUnregister) {
			var rActions = findReceiveMethods(toUnregister);
			for(var ri in rActions) {
				mop.unregisterHandler(rActions[ri].action);
			}
			var sActions = findSendMethods(toUnregister);
			for(var si in sActions) {
				uninstallSender(sActions[si].action);
			}
			if(toUnregister.hasOwnProperty("bus")) {
				uninstallBusUtils(toUnregister.bus);
			}
			return mop;
		}

		function uninstallSender(sender) {
			var saftey = 100;
			while(sender.uninstall && typeof(sender.uninstall) === "function" && (saftey--)>0) {
				sender = sender.uninstall();
			}
		}

		function unregisterHandler(handler) {
			removeWiresForHandler(handler, handlerRegister);
			handlerRegister.remove(handler);
			return mop;
		}

		function uninstallBusUtils(utils) {
			var methods = [ "register", "unregister" ];
			for(var i = 0; i < methods.length; i++) {
				var method = methods[i];
				if(utils.hasOwnProperty(method) && "function" == typeof utils[method].uninstall) {
					utils[method].uninstall();
				}
			}
		}

		function installBusUtils(utils) {
			var registerMethod = new MethodDef(utils, "register", "register");
			var registerShim = function(toRegister, registrantName) {
				mop.register(toRegister, registrantName);
			};
			registerShim.uninstall = function() { registerMethod.substitute(registerMethod.action); };
			registerMethod.substitute(registerShim);
			
			var unregisterMethod = new MethodDef(utils, "unregister", "unregister");
			var unregisterShim = function(toUnregister) {
				mop.unregister(toUnregister);
			};
			unregisterShim.uninstall = function() { unregisterMethod.substitute(unregisterMethod.action); };
			unregisterMethod.substitute(unregisterShim);
		}

		function installSender(topicList, sender, owner, ownerName, substituteSender) {
			var subject = topicList.join(" ");
			if(topicList.length<1) throw("Incorrect sender - must have at least one topic");
			var sendShim = function() {
				var args = argsToArr(arguments);
				var a = mop.send.apply(owner, args).as(subject);
				var b = sender.apply(owner, args);
				return (a && b) ? [a, b] : (a || b);
			};
			sendShim.uninstall = function() {
				substituteSender(sender);
				return sender;
			};

			substituteSender(sendShim);
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

			var registration = handlerRegister.find(handler);
			registration.push(wire);

			if(mop.debug || mop.registerHandler.debug) console.log("Registered", ownerName || "anon.", topicListCopy, wire, hub);
			
			return mop;
		}

		function sendMessageLog(category, topics, args, receiver) {
			if(topics[0] == "_messageLog") return;
			mop.send({
				"topics" : topics,
				"payload" : args,
				"subject" : topics.join(" "),
				"receiver" : receiver,
				"category" : category
			}).as("_messageLog", category);
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
					sendMessageLog("received", node.topics, args, wire.ownername);
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

					sendMessageLog("sent", topics, settings.payload);

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
					
					if(received === 0) sendMessageLog("dropped", node.topics, settings.payload);

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

		function toJSON(thing) {
			var seen = [];
			return JSON.stringify(obj, function(key, val) {
				if (typeof val == "object") {
					if (seen.indexOf(val) >= 0) return undefined;
					seen.push(val);
				}
				return val;
			});
		}

		return mop;
	};

}());