var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var res = mod._cached ? mod._cached : mod();
    return res;
}

require.paths = [];
require.modules = {};
require.extensions = [".js",".coffee"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = x + '/package.json';
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key)
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

require.define = function (filename, fn) {
    var dirname = require._core[filename]
        ? ''
        : require.modules.path().dirname(filename)
    ;
    
    var require_ = function (file) {
        return require(file, dirname)
    };
    require_.resolve = function (name) {
        return require.resolve(name, dirname);
    };
    require_.modules = require.modules;
    require_.define = require.define;
    var module_ = { exports : {} };
    
    require.modules[filename] = function () {
        require.modules[filename]._cached = module_.exports;
        fn.call(
            module_.exports,
            require_,
            module_,
            module_.exports,
            dirname,
            filename
        );
        require.modules[filename]._cached = module_.exports;
        return module_.exports;
    };
};

if (typeof process === 'undefined') process = {};

if (!process.nextTick) process.nextTick = (function () {
    var queue = [];
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;
    
    if (canPost) {
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);
    }
    
    return function (fn) {
        if (canPost) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        }
        else setTimeout(fn, 0);
    };
})();

if (!process.title) process.title = 'browser';

if (!process.binding) process.binding = function (name) {
    if (name === 'evals') return require('vm')
    else throw new Error('No such module')
};

if (!process.cwd) process.cwd = function () { return '.' };

if (!process.env) process.env = {};
if (!process.argv) process.argv = [];

require.define("path", function (require, module, exports, __dirname, __filename) {
function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

});

require.define("/package.json", function (require, module, exports, __dirname, __filename) {
module.exports = {"main":"gbL.jsMop.js"}
});

require.define("/gbL.jsMop.js", function (require, module, exports, __dirname, __filename) {
(function() {
	
	// VERSION: 0.9.3
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
});

require.define("/node_modules/expect.js/package.json", function (require, module, exports, __dirname, __filename) {
module.exports = {"main":"./expect"}
});

require.define("/node_modules/expect.js/expect.js", function (require, module, exports, __dirname, __filename) {

(function (global, module) {

  if ('undefined' == typeof module) {
    var module = { exports: {} }
      , exports = module.exports
  }

  /**
   * Exports.
   */

  module.exports = expect;
  expect.Assertion = Assertion;

  /**
   * Exports version.
   */

  expect.version = '0.1.2';

  /**
   * Possible assertion flags.
   */

  var flags = {
      not: ['to', 'be', 'have', 'include', 'only']
    , to: ['be', 'have', 'include', 'only', 'not']
    , only: ['have']
    , have: ['own']
    , be: ['an']
  };

  function expect (obj) {
    return new Assertion(obj);
  }

  /**
   * Constructor
   *
   * @api private
   */

  function Assertion (obj, flag, parent) {
    this.obj = obj;
    this.flags = {};

    if (undefined != parent) {
      this.flags[flag] = true;

      for (var i in parent.flags) {
        if (parent.flags.hasOwnProperty(i)) {
          this.flags[i] = true;
        }
      }
    }

    var $flags = flag ? flags[flag] : keys(flags)
      , self = this

    if ($flags) {
      for (var i = 0, l = $flags.length; i < l; i++) {
        // avoid recursion
        if (this.flags[$flags[i]]) continue;

        var name = $flags[i]
          , assertion = new Assertion(this.obj, name, this)
  
        if ('function' == typeof Assertion.prototype[name]) {
          // clone the function, make sure we dont touch the prot reference
          var old = this[name];
          this[name] = function () {
            return old.apply(self, arguments);
          }

          for (var fn in Assertion.prototype) {
            if (Assertion.prototype.hasOwnProperty(fn) && fn != name) {
              this[name][fn] = bind(assertion[fn], assertion);
            }
          }
        } else {
          this[name] = assertion;
        }
      }
    }
  };

  /**
   * Performs an assertion
   *
   * @api private
   */

  Assertion.prototype.assert = function (truth, msg, error) {
    var msg = this.flags.not ? error : msg
      , ok = this.flags.not ? !truth : truth;

    if (!ok) {
      throw new Error(msg);
    }

    this.and = new Assertion(this.obj);
  };

  /**
   * Check if the value is truthy
   *
   * @api public
   */

  Assertion.prototype.ok = function () {
    this.assert(
        !!this.obj
      , 'expected ' + i(this.obj) + ' to be truthy'
      , 'expected ' + i(this.obj) + ' to be falsy');
  };

  /**
   * Assert that the function throws.
   *
   * @param {Function|RegExp} callback, or regexp to match error string against
   * @api public
   */

  Assertion.prototype.throwError =
  Assertion.prototype.throwException = function (fn) {
    expect(this.obj).to.be.a('function');

    var thrown = false
      , not = this.flags.not

    try {
      this.obj();
    } catch (e) {
      if ('function' == typeof fn) {
        fn(e);
      } else if ('object' == typeof fn) {
        var subject = 'string' == typeof e ? e : e.message;
        if (not) {
          expect(subject).to.not.match(fn);
        } else {
          expect(subject).to.match(fn);
        }
      }
      thrown = true;
    }

    if ('object' == typeof fn && not) {
      // in the presence of a matcher, ensure the `not` only applies to
      // the matching.
      this.flags.not = false; 
    }

    var name = this.obj.name || 'fn';
    this.assert(
        thrown
      , 'expected ' + name + ' to throw an exception'
      , 'expected ' + name + ' not to throw an exception');
  };

  /**
   * Checks if the array is empty.
   *
   * @api public
   */

  Assertion.prototype.empty = function () {
    var expectation;

    if ('object' == typeof this.obj && null !== this.obj && !isArray(this.obj)) {
      if ('number' == typeof this.obj.length) {
        expectation = !this.obj.length;
      } else {
        expectation = !keys(this.obj).length;
      }
    } else {
      if ('string' != typeof this.obj) {
        expect(this.obj).to.be.an('object');
      }

      expect(this.obj).to.have.property('length');
      expectation = !this.obj.length;
    }

    this.assert(
        expectation
      , 'expected ' + i(this.obj) + ' to be empty'
      , 'expected ' + i(this.obj) + ' to not be empty');
    return this;
  };

  /**
   * Checks if the obj exactly equals another.
   *
   * @api public
   */

  Assertion.prototype.be =
  Assertion.prototype.equal = function (obj) {
    this.assert(
        obj === this.obj
      , 'expected ' + i(this.obj) + ' to equal ' + i(obj)
      , 'expected ' + i(this.obj) + ' to not equal ' + i(obj));
    return this;
  };

  /**
   * Checks if the obj sortof equals another.
   *
   * @api public
   */

  Assertion.prototype.eql = function (obj) {
    this.assert(
        expect.eql(obj, this.obj)
      , 'expected ' + i(this.obj) + ' to sort of equal ' + i(obj)
      , 'expected ' + i(this.obj) + ' to sort of not equal ' + i(obj));
    return this;
  };

  /**
   * Assert within start to finish (inclusive). 
   *
   * @param {Number} start
   * @param {Number} finish
   * @api public
   */

  Assertion.prototype.within = function (start, finish) {
    var range = start + '..' + finish;
    this.assert(
        this.obj >= start && this.obj <= finish
      , 'expected ' + i(this.obj) + ' to be within ' + range
      , 'expected ' + i(this.obj) + ' to not be within ' + range);
    return this;
  };

  /**
   * Assert typeof / instance of
   *
   * @api public
   */

  Assertion.prototype.a =
  Assertion.prototype.an = function (type) {
    if ('string' == typeof type) {
      // proper english in error msg
      var n = /^[aeiou]/.test(type) ? 'n' : '';

      // typeof with support for 'array'
      this.assert(
          'array' == type ? isArray(this.obj) :
            'object' == type
              ? 'object' == typeof this.obj && null !== this.obj
              : type == typeof this.obj
        , 'expected ' + i(this.obj) + ' to be a' + n + ' ' + type
        , 'expected ' + i(this.obj) + ' not to be a' + n + ' ' + type);
    } else {
      // instanceof
      var name = type.name || 'supplied constructor';
      this.assert(
          this.obj instanceof type
        , 'expected ' + i(this.obj) + ' to be an instance of ' + name
        , 'expected ' + i(this.obj) + ' not to be an instance of ' + name);
    }

    return this;
  };

  /**
   * Assert numeric value above _n_.
   *
   * @param {Number} n
   * @api public
   */

  Assertion.prototype.greaterThan =
  Assertion.prototype.above = function (n) {
    this.assert(
        this.obj > n
      , 'expected ' + i(this.obj) + ' to be above ' + n
      , 'expected ' + i(this.obj) + ' to be below ' + n);
    return this;
  };

  /**
   * Assert numeric value below _n_.
   *
   * @param {Number} n
   * @api public
   */

  Assertion.prototype.lessThan =
  Assertion.prototype.below = function (n) {
    this.assert(
        this.obj < n
      , 'expected ' + i(this.obj) + ' to be below ' + n
      , 'expected ' + i(this.obj) + ' to be above ' + n);
    return this;
  };
  
  /**
   * Assert string value matches _regexp_.
   *
   * @param {RegExp} regexp
   * @api public
   */

  Assertion.prototype.match = function (regexp) {
    this.assert(
        regexp.exec(this.obj)
      , 'expected ' + i(this.obj) + ' to match ' + regexp
      , 'expected ' + i(this.obj) + ' not to match ' + regexp);
    return this;
  };

  /**
   * Assert property "length" exists and has value of _n_.
   *
   * @param {Number} n
   * @api public
   */

  Assertion.prototype.length = function (n) {
    expect(this.obj).to.have.property('length');
    var len = this.obj.length;
    this.assert(
        n == len
      , 'expected ' + i(this.obj) + ' to have a length of ' + n + ' but got ' + len
      , 'expected ' + i(this.obj) + ' to not have a length of ' + len);
    return this;
  };

  /**
   * Assert property _name_ exists, with optional _val_.
   *
   * @param {String} name
   * @param {Mixed} val
   * @api public
   */

  Assertion.prototype.property = function (name, val) {
    if (this.flags.own) {
      this.assert(
          Object.prototype.hasOwnProperty.call(this.obj, name)
        , 'expected ' + i(this.obj) + ' to have own property ' + i(name)
        , 'expected ' + i(this.obj) + ' to not have own property ' + i(name));
      return this;
    }

    if (this.flags.not && undefined !== val) {
      if (undefined === this.obj[name]) {
        throw new Error(i(this.obj) + ' has no property ' + i(name));
      }
    } else {
      var hasProp;
      try {
        hasProp = name in this.obj
      } catch (e) {
        hasProp = undefined !== this.obj[name]
      }
      
      this.assert(
          hasProp
        , 'expected ' + i(this.obj) + ' to have a property ' + i(name)
        , 'expected ' + i(this.obj) + ' to not have a property ' + i(name));
    }
    
    if (undefined !== val) {
      this.assert(
          val === this.obj[name]
        , 'expected ' + i(this.obj) + ' to have a property ' + i(name)
          + ' of ' + i(val) + ', but got ' + i(this.obj[name])
        , 'expected ' + i(this.obj) + ' to not have a property ' + i(name)
          + ' of ' + i(val));
    }

    this.obj = this.obj[name];
    return this;
  };

  /**
   * Assert that the array contains _obj_ or string contains _obj_.
   *
   * @param {Mixed} obj|string
   * @api public
   */

  Assertion.prototype.string =
  Assertion.prototype.contain = function (obj) {
    if ('string' == typeof this.obj) {
      this.assert(
          ~this.obj.indexOf(obj)
        , 'expected ' + i(this.obj) + ' to contain ' + i(obj)
        , 'expected ' + i(this.obj) + ' to not contain ' + i(obj));
    } else {
      this.assert(
          ~indexOf(this.obj, obj)
        , 'expected ' + i(this.obj) + ' to contain ' + i(obj)
        , 'expected ' + i(this.obj) + ' to not contain ' + i(obj));
    }
    return this;
  };

  /**
   * Assert exact keys or inclusion of keys by using
   * the `.own` modifier.
   *
   * @param {Array|String ...} keys
   * @api public
   */

  Assertion.prototype.key =
  Assertion.prototype.keys = function ($keys) {
    var str
      , ok = true;

    $keys = isArray($keys)
      ? $keys
      : Array.prototype.slice.call(arguments);

    if (!$keys.length) throw new Error('keys required');

    var actual = keys(this.obj)
      , len = $keys.length;

    // Inclusion
    ok = every($keys, function (key) {
      return ~indexOf(actual, key);
    });

    // Strict
    if (!this.flags.not && this.flags.only) {
      ok = ok && $keys.length == actual.length;
    }

    // Key string
    if (len > 1) {
      $keys = map($keys, function (key) {
        return i(key);
      });
      var last = $keys.pop();
      str = $keys.join(', ') + ', and ' + last;
    } else {
      str = i($keys[0]);
    }

    // Form
    str = (len > 1 ? 'keys ' : 'key ') + str;

    // Have / include
    str = (!this.flags.only ? 'include ' : 'only have ') + str;

    // Assertion
    this.assert(
        ok
      , 'expected ' + i(this.obj) + ' to ' + str
      , 'expected ' + i(this.obj) + ' to not ' + str);

    return this;
  };

  /**
   * Function bind implementation.
   */

  function bind (fn, scope) {
    return function () {
      return fn.apply(scope, arguments);
    }
  }

  /**
   * Array every compatibility
   *
   * @see bit.ly/5Fq1N2
   * @api public
   */

  function every (arr, fn, thisObj) {
    var scope = thisObj || global;
    for (var i = 0, j = arr.length; i < j; ++i) {
      if (!fn.call(scope, arr[i], i, arr)) {
        return false;
      }
    }
    return true;
  };

  /**
   * Array indexOf compatibility.
   *
   * @see bit.ly/a5Dxa2
   * @api public
   */

  function indexOf (arr, o, i) {
    if (Array.prototype.indexOf) {
      return Array.prototype.indexOf.call(arr, o, i);
    }

    if (arr.length === undefined) {
      return -1;
    }

    for (var j = arr.length, i = i < 0 ? i + j < 0 ? 0 : i + j : i || 0
        ; i < j && arr[i] !== o; i++);

    return j <= i ? -1 : i;
  };

  /**
   * Inspects an object.
   *
   * @see taken from node.js `util` module (copyright Joyent, MIT license)
   * @api private
   */

  function i (obj, showHidden, depth) {
    var seen = [];

    function stylize (str) {
      return str;
    };

    function format (value, recurseTimes) {
      // Provide a hook for user-specified inspect functions.
      // Check that value is an object with an inspect function on it
      if (value && typeof value.inspect === 'function' &&
          // Filter out the util module, it's inspect function is special
          value !== exports &&
          // Also filter out any prototype objects using the circular check.
          !(value.constructor && value.constructor.prototype === value)) {
        return value.inspect(recurseTimes);
      }

      // Primitive types cannot have properties
      switch (typeof value) {
        case 'undefined':
          return stylize('undefined', 'undefined');

        case 'string':
          var simple = '\'' + json.stringify(value).replace(/^"|"$/g, '')
                                                   .replace(/'/g, "\\'")
                                                   .replace(/\\"/g, '"') + '\'';
          return stylize(simple, 'string');

        case 'number':
          return stylize('' + value, 'number');

        case 'boolean':
          return stylize('' + value, 'boolean');
      }
      // For some reason typeof null is "object", so special case here.
      if (value === null) {
        return stylize('null', 'null');
      }

      // Look up the keys of the object.
      var visible_keys = keys(value);
      var $keys = showHidden ? Object.getOwnPropertyNames(value) : visible_keys;

      // Functions without properties can be shortcutted.
      if (typeof value === 'function' && $keys.length === 0) {
        if (isRegExp(value)) {
          return stylize('' + value, 'regexp');
        } else {
          var name = value.name ? ': ' + value.name : '';
          return stylize('[Function' + name + ']', 'special');
        }
      }

      // Dates without properties can be shortcutted
      if (isDate(value) && $keys.length === 0) {
        return stylize(value.toUTCString(), 'date');
      }

      var base, type, braces;
      // Determine the object type
      if (isArray(value)) {
        type = 'Array';
        braces = ['[', ']'];
      } else {
        type = 'Object';
        braces = ['{', '}'];
      }

      // Make functions say that they are functions
      if (typeof value === 'function') {
        var n = value.name ? ': ' + value.name : '';
        base = (isRegExp(value)) ? ' ' + value : ' [Function' + n + ']';
      } else {
        base = '';
      }

      // Make dates with properties first say the date
      if (isDate(value)) {
        base = ' ' + value.toUTCString();
      }

      if ($keys.length === 0) {
        return braces[0] + base + braces[1];
      }

      if (recurseTimes < 0) {
        if (isRegExp(value)) {
          return stylize('' + value, 'regexp');
        } else {
          return stylize('[Object]', 'special');
        }
      }

      seen.push(value);

      var output = map($keys, function (key) {
        var name, str;
        if (value.__lookupGetter__) {
          if (value.__lookupGetter__(key)) {
            if (value.__lookupSetter__(key)) {
              str = stylize('[Getter/Setter]', 'special');
            } else {
              str = stylize('[Getter]', 'special');
            }
          } else {
            if (value.__lookupSetter__(key)) {
              str = stylize('[Setter]', 'special');
            }
          }
        }
        if (indexOf(visible_keys, key) < 0) {
          name = '[' + key + ']';
        }
        if (!str) {
          if (indexOf(seen, value[key]) < 0) {
            if (recurseTimes === null) {
              str = format(value[key]);
            } else {
              str = format(value[key], recurseTimes - 1);
            }
            if (str.indexOf('\n') > -1) {
              if (isArray(value)) {
                str = map(str.split('\n'), function (line) {
                  return '  ' + line;
                }).join('\n').substr(2);
              } else {
                str = '\n' + map(str.split('\n'), function (line) {
                  return '   ' + line;
                }).join('\n');
              }
            }
          } else {
            str = stylize('[Circular]', 'special');
          }
        }
        if (typeof name === 'undefined') {
          if (type === 'Array' && key.match(/^\d+$/)) {
            return str;
          }
          name = json.stringify('' + key);
          if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
            name = name.substr(1, name.length - 2);
            name = stylize(name, 'name');
          } else {
            name = name.replace(/'/g, "\\'")
                       .replace(/\\"/g, '"')
                       .replace(/(^"|"$)/g, "'");
            name = stylize(name, 'string');
          }
        }

        return name + ': ' + str;
      });

      seen.pop();

      var numLinesEst = 0;
      var length = reduce(output, function (prev, cur) {
        numLinesEst++;
        if (indexOf(cur, '\n') >= 0) numLinesEst++;
        return prev + cur.length + 1;
      }, 0);

      if (length > 50) {
        output = braces[0] +
                 (base === '' ? '' : base + '\n ') +
                 ' ' +
                 output.join(',\n  ') +
                 ' ' +
                 braces[1];

      } else {
        output = braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
      }

      return output;
    }
    return format(obj, (typeof depth === 'undefined' ? 2 : depth));
  };

  function isArray (ar) {
    return Object.prototype.toString.call(ar) == '[object Array]';
  };

  function isRegExp(re) {
    var s = '' + re;
    return re instanceof RegExp || // easy case
           // duck-type for context-switching evalcx case
           typeof(re) === 'function' &&
           re.constructor.name === 'RegExp' &&
           re.compile &&
           re.test &&
           re.exec &&
           s.match(/^\/.*\/[gim]{0,3}$/);
  };

  function isDate(d) {
    if (d instanceof Date) return true;
    return false;
  };

  function keys (obj) {
    if (Object.keys) {
      return Object.keys(obj);
    }

    var keys = [];

    for (var i in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, i)) {
        keys.push(i);
      }
    }

    return keys;
  }

  function map (arr, mapper, that) {
    if (Array.prototype.map) {
      return Array.prototype.map.call(arr, mapper, that);
    }

    var other= new Array(arr.length);

    for (var i= 0, n = arr.length; i<n; i++)
      if (i in arr)
        other[i] = mapper.call(that, arr[i], i, arr);

    return other;
  };

  function reduce (arr, fun) {
    if (Array.prototype.reduce) {
      return Array.prototype.reduce.apply(
          arr
        , Array.prototype.slice.call(arguments, 1)
      );
    }

    var len = +this.length;

    if (typeof fun !== "function")
      throw new TypeError();

    // no value to return if no initial value and an empty array
    if (len === 0 && arguments.length === 1)
      throw new TypeError();

    var i = 0;
    if (arguments.length >= 2) {
      var rv = arguments[1];
    } else {
      do {
        if (i in this) {
          rv = this[i++];
          break;
        }

        // if array contains no values, no initial value to return
        if (++i >= len)
          throw new TypeError();
      } while (true);
    }

    for (; i < len; i++) {
      if (i in this)
        rv = fun.call(null, rv, this[i], i, this);
    }

    return rv;
  };

  /**
   * Asserts deep equality
   *
   * @see taken from node.js `assert` module (copyright Joyent, MIT license)
   * @api private
   */

  expect.eql = function eql (actual, expected) {
    // 7.1. All identical values are equivalent, as determined by ===.
    if (actual === expected) { 
      return true;
    } else if ('undefined' != typeof Buffer 
        && Buffer.isBuffer(actual) && Buffer.isBuffer(expected)) {
      if (actual.length != expected.length) return false;

      for (var i = 0; i < actual.length; i++) {
        if (actual[i] !== expected[i]) return false;
      }

      return true;

    // 7.2. If the expected value is a Date object, the actual value is
    // equivalent if it is also a Date object that refers to the same time.
    } else if (actual instanceof Date && expected instanceof Date) {
      return actual.getTime() === expected.getTime();

    // 7.3. Other pairs that do not both pass typeof value == "object",
    // equivalence is determined by ==.
    } else if (typeof actual != 'object' && typeof expected != 'object') {
      return actual == expected;

    // 7.4. For all other Object pairs, including Array objects, equivalence is
    // determined by having the same number of owned properties (as verified
    // with Object.prototype.hasOwnProperty.call), the same set of keys
    // (although not necessarily the same order), equivalent values for every
    // corresponding key, and an identical "prototype" property. Note: this
    // accounts for both named and indexed properties on Arrays.
    } else {
      return objEquiv(actual, expected);
    }
  }

  function isUndefinedOrNull (value) {
    return value === null || value === undefined;
  }

  function isArguments (object) {
    return Object.prototype.toString.call(object) == '[object Arguments]';
  }

  function objEquiv (a, b) {
    if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
      return false;
    // an identical "prototype" property.
    if (a.prototype !== b.prototype) return false;
    //~~~I've managed to break Object.keys through screwy arguments passing.
    //   Converting to array solves the problem.
    if (isArguments(a)) {
      if (!isArguments(b)) {
        return false;
      }
      a = pSlice.call(a);
      b = pSlice.call(b);
      return expect.eql(a, b);
    }
    try{
      var ka = keys(a),
        kb = keys(b),
        key, i;
    } catch (e) {//happens when one is a string literal and the other isn't
      return false;
    }
    // having the same number of owned properties (keys incorporates hasOwnProperty)
    if (ka.length != kb.length)
      return false;
    //the same set of keys (although not necessarily the same order),
    ka.sort();
    kb.sort();
    //~~~cheap key test
    for (i = ka.length - 1; i >= 0; i--) {
      if (ka[i] != kb[i])
        return false;
    }
    //equivalent values for every corresponding key, and
    //~~~possibly expensive deep test
    for (i = ka.length - 1; i >= 0; i--) {
      key = ka[i];
      if (!expect.eql(a[key], b[key]))
         return false;
    }
    return true;
  }

  var json = (function () {
    "use strict";

    if ('object' == typeof JSON && JSON.parse && JSON.stringify) {
      return {
          parse: nativeJSON.parse
        , stringify: nativeJSON.stringify
      }
    }

    var JSON = {};

    function f(n) {
        // Format integers to have at least two digits.
        return n < 10 ? '0' + n : n;
    }

    function date(d, key) {
      return isFinite(d.valueOf()) ?
          d.getUTCFullYear()     + '-' +
          f(d.getUTCMonth() + 1) + '-' +
          f(d.getUTCDate())      + 'T' +
          f(d.getUTCHours())     + ':' +
          f(d.getUTCMinutes())   + ':' +
          f(d.getUTCSeconds())   + 'Z' : null;
    };

    var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        gap,
        indent,
        meta = {    // table of character substitutions
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"' : '\\"',
            '\\': '\\\\'
        },
        rep;


    function quote(string) {

  // If the string contains no control characters, no quote characters, and no
  // backslash characters, then we can safely slap some quotes around it.
  // Otherwise we must also replace the offending characters with safe escape
  // sequences.

        escapable.lastIndex = 0;
        return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
            var c = meta[a];
            return typeof c === 'string' ? c :
                '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
        }) + '"' : '"' + string + '"';
    }


    function str(key, holder) {

  // Produce a string from holder[key].

        var i,          // The loop counter.
            k,          // The member key.
            v,          // The member value.
            length,
            mind = gap,
            partial,
            value = holder[key];

  // If the value has a toJSON method, call it to obtain a replacement value.

        if (value instanceof Date) {
            value = date(key);
        }

  // If we were called with a replacer function, then call the replacer to
  // obtain a replacement value.

        if (typeof rep === 'function') {
            value = rep.call(holder, key, value);
        }

  // What happens next depends on the value's type.

        switch (typeof value) {
        case 'string':
            return quote(value);

        case 'number':

  // JSON numbers must be finite. Encode non-finite numbers as null.

            return isFinite(value) ? String(value) : 'null';

        case 'boolean':
        case 'null':

  // If the value is a boolean or null, convert it to a string. Note:
  // typeof null does not produce 'null'. The case is included here in
  // the remote chance that this gets fixed someday.

            return String(value);

  // If the type is 'object', we might be dealing with an object or an array or
  // null.

        case 'object':

  // Due to a specification blunder in ECMAScript, typeof null is 'object',
  // so watch out for that case.

            if (!value) {
                return 'null';
            }

  // Make an array to hold the partial results of stringifying this object value.

            gap += indent;
            partial = [];

  // Is the value an array?

            if (Object.prototype.toString.apply(value) === '[object Array]') {

  // The value is an array. Stringify every element. Use null as a placeholder
  // for non-JSON values.

                length = value.length;
                for (i = 0; i < length; i += 1) {
                    partial[i] = str(i, value) || 'null';
                }

  // Join all of the elements together, separated with commas, and wrap them in
  // brackets.

                v = partial.length === 0 ? '[]' : gap ?
                    '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']' :
                    '[' + partial.join(',') + ']';
                gap = mind;
                return v;
            }

  // If the replacer is an array, use it to select the members to be stringified.

            if (rep && typeof rep === 'object') {
                length = rep.length;
                for (i = 0; i < length; i += 1) {
                    if (typeof rep[i] === 'string') {
                        k = rep[i];
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            } else {

  // Otherwise, iterate through all of the keys in the object.

                for (k in value) {
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            }

  // Join all of the member texts together, separated with commas,
  // and wrap them in braces.

            v = partial.length === 0 ? '{}' : gap ?
                '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}' :
                '{' + partial.join(',') + '}';
            gap = mind;
            return v;
        }
    }

  // If the JSON object does not yet have a stringify method, give it one.

    JSON.stringify = function (value, replacer, space) {

  // The stringify method takes a value and an optional replacer, and an optional
  // space parameter, and returns a JSON text. The replacer can be a function
  // that can replace values, or an array of strings that will select the keys.
  // A default replacer method can be provided. Use of the space parameter can
  // produce text that is more easily readable.

        var i;
        gap = '';
        indent = '';

  // If the space parameter is a number, make an indent string containing that
  // many spaces.

        if (typeof space === 'number') {
            for (i = 0; i < space; i += 1) {
                indent += ' ';
            }

  // If the space parameter is a string, it will be used as the indent string.

        } else if (typeof space === 'string') {
            indent = space;
        }

  // If there is a replacer, it must be a function or an array.
  // Otherwise, throw an error.

        rep = replacer;
        if (replacer && typeof replacer !== 'function' &&
                (typeof replacer !== 'object' ||
                typeof replacer.length !== 'number')) {
            throw new Error('JSON.stringify');
        }

  // Make a fake root object containing our value under the key of ''.
  // Return the result of stringifying the value.

        return str('', {'': value});
    };

  // If the JSON object does not yet have a parse method, give it one.

    JSON.parse = function (text, reviver) {
    // The parse method takes a text and an optional reviver function, and returns
    // a JavaScript value if the text is a valid JSON text.

        var j;

        function walk(holder, key) {

    // The walk method is used to recursively walk the resulting structure so
    // that modifications can be made.

            var k, v, value = holder[key];
            if (value && typeof value === 'object') {
                for (k in value) {
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        v = walk(value, k);
                        if (v !== undefined) {
                            value[k] = v;
                        } else {
                            delete value[k];
                        }
                    }
                }
            }
            return reviver.call(holder, key, value);
        }


    // Parsing happens in four stages. In the first stage, we replace certain
    // Unicode characters with escape sequences. JavaScript handles many characters
    // incorrectly, either silently deleting them, or treating them as line endings.

        text = String(text);
        cx.lastIndex = 0;
        if (cx.test(text)) {
            text = text.replace(cx, function (a) {
                return '\\u' +
                    ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
            });
        }

    // In the second stage, we run the text against regular expressions that look
    // for non-JSON patterns. We are especially concerned with '()' and 'new'
    // because they can cause invocation, and '=' because it can cause mutation.
    // But just to be safe, we want to reject all unexpected forms.

    // We split the second stage into 4 regexp operations in order to work around
    // crippling inefficiencies in IE's and Safari's regexp engines. First we
    // replace the JSON backslash pairs with '@' (a non-JSON character). Second, we
    // replace all simple value tokens with ']' characters. Third, we delete all
    // open brackets that follow a colon or comma or that begin the text. Finally,
    // we look to see that the remaining characters are only whitespace or ']' or
    // ',' or ':' or '{' or '}'. If that is so, then the text is safe for eval.

        if (/^[\],:{}\s]*$/
                .test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
                    .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
                    .replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

    // In the third stage we use the eval function to compile the text into a
    // JavaScript structure. The '{' operator is subject to a syntactic ambiguity
    // in JavaScript: it can begin a block or an object literal. We wrap the text
    // in parens to eliminate the ambiguity.

            j = eval('(' + text + ')');

    // In the optional fourth stage, we recursively walk the new structure, passing
    // each name/value pair to a reviver function for possible transformation.

            return typeof reviver === 'function' ?
                walk({'': j}, '') : j;
        }

    // If the text is not JSON parseable, then a SyntaxError is thrown.

        throw new SyntaxError('JSON.parse');
    };

    return JSON;
  })();

  if ('undefined' != typeof window) {
    window.expect = module.exports;
  }

})(
    this
  , 'undefined' != typeof module ? module : {}
  , 'undefined' != typeof exports ? exports : {}
);

});

require.define("/util/expect-ext.js", function (require, module, exports, __dirname, __filename) {
(function() {

	var expect = require("expect.js");
	expect.Assertion.prototype.containEql = function(obj) {
		var ok = false;
		for(var i in this.obj)
		{
			ok = ok | expect.eql(this.obj[i], obj);
		}
		this.assert(
			ok,
			'expected ' + this.obj + ' to sort of contain ' + obj,
			'expected ' + this.obj + ' to not sort of contain ' + obj
		);
	};

})();
});

require.define("/test/scenarios/module-collaboration/simple-model.js", function (require, module, exports, __dirname, __filename) {
var mop;

exports.bootstrap = {
	init: function(jsmop) {
		(mop = jsmop)
			.register(new SimpleModel(), "Simple model");
	}
};

var SimpleModel = function() {

	var state = "";

	var populate = function(){
		state = "I am the model";
	};

	var summarise = function() {
		return state;
	};

	return {
		receive_model_populate:			populate,
		receive_model_report_request:	summarise
	};
};
});

require.define("/test/scenarios/module-collaboration/simple-view.js", function (require, module, exports, __dirname, __filename) {
var mop;

exports.bootstrap = {
	init: function(jsmop) {
		(mop = jsmop)
			.register(new SimpleView(), "Simple view");
	}
};

var SimpleView = function() {

	var render = function(model) {
		mop.send("<pretty>" + model + "</pretty>").as("view output");
	};

	return {
		receive_model_for_view:			render
	};
};
});

require.define("/test/scenarios/module-collaboration/simple-controller.js", function (require, module, exports, __dirname, __filename) {
var mop;

module.exports = {
	bootstrap : {
		init: function(jsmop) {
			mop = jsmop
				.register(new Controller(), "Simple controller");
		}
	}
};

var Controller = function() {

	var getMethod = function() {
		var route = mop.topics;
		route.shift();
		if(route.length<1) return;
		var action = route[0];
		switch(action) {
			case "report":
				mop.send().as("model populate");
				var report = mop.send().as("model report request");
				mop.send(report).as("model for view");
				break;
			case "jslint":
				// is annoying
				break;
			default:
				throw "[simple-controller] ERROR: Unknown action";
		}
	};

	return {
		receive_GET : getMethod
	};
};
});

require.define("/test/scenarios/object-collaboration/invoice.js", function (require, module, exports, __dirname, __filename) {
module.exports.Invoice = function(invoiceId, mop) {

	// encapsulated state
	var lineItems = [],
		totals = { net: null, tax: null, gross: null },
		status = "open"
		;

	// private functions
	function toPrice(amount) { return Math.round(amount * 100) / 100; }

	function recalculate() {
		var net = 0;
		for(var i in lineItems)
			net += toPrice(lineItems[i].Item.UnitPrice * lineItems[i].Amount);

		totals = { net: net, tax: null, gross: null };

		mop.send(invoiceId).as("calculate tax for invoice");
	}

	function cloneTotals() {
		return { net: totals.net, tax: totals.tax, gross: totals.gross };
	}

	function cloneLineItems() {
		var ret = [];
		for(var i in lineItems) {
			var lineItem = lineItems[i];
			ret.push({ Item: lineItem.Item, Amount: lineItem.Amount });
		}
		return ret;
	}

	function setCalculatedTax(tax) {
		var newTotals = cloneTotals();
		newTotals.tax = tax;
		newTotals.gross = toPrice(totals.net + tax);
		totals = newTotals;
	}

	function addLineItem(item, amount) {
		lineItems.push({ Item: item, Amount: amount});
		recalculate();
	}

	// message handlers
	this.receive_line_item_for_invoice = function(item, amount) { addLineItem(item, amount); };
	this.receive_total_amount_for_invoice = function() { return totals.gross; };
	this.receive_net_amount_for_invoice = function() { return totals.net; };
	this.receive_calculated_tax_for_invoice = function(tax) { setCalculatedTax(tax); };
	this.receive_request_totals_report_for_invoice = function() { return cloneTotals(); };
	this.receive_line_items_for_invoice = function() { return cloneLineItems(); };

	mop.setReceiveFilters(this, function(topics) {
		// only accept for my invoice number
		return topics.slice(-1)[0] == invoiceId;
	});

	this.receive_invoice_paid = function() { status = "paid"; };
	this.receive_invoice_paid.filter = function(topics, data) { return data && data[0] == invoiceId; };

	this.receive_request_invoice_totals_report = function() { return cloneTotals(); };
	this.receive_request_invoice_totals_report.filter = function(topics, data) {
		return data && data[0] && data[0].status == status;
	};

	this.receive_new_tax = function() { recalculate(); };
};
});

require.define("/test/scenarios/object-collaboration/invoice-factory.js", function (require, module, exports, __dirname, __filename) {
var mop,
	invoices = require("./invoice")
	;

module.exports.bootstrap = {
	init: function(jsmop) {
		(mop = jsmop)
			.register(new InvoiceFactory(), "Invoice factory")
			;
	}
};

var invoiceNumberSeed = new Date().getTime();

function InvoiceFactory() {

	var build = function() {
		var invoiceId = ++invoiceNumberSeed;
		var invoice = new invoices.Invoice(invoiceId, mop);
		mop.register(invoice, "Invoice #" + invoiceId);
		return invoiceId;
	};

	return {
		receive_new_invoice_request: build
	};
}
});

require.define("/test/scenarios/object-collaboration/uk-VAT-calculator.js", function (require, module, exports, __dirname, __filename) {
var mop;

module.exports.bootstrap = {
	init: function(jsmop) {
		mop = jsmop;
		mop.register(Calculator);
	}
};

var toPrice = function(amount) { return Math.round(amount * 100) / 100; };

var Calculator = {

	receive_calculate_tax_for_invoice: function(invoiceNumber) {
		// just get the net amount and multiply by 0.2
		mop.send(
			toPrice(mop.send().as("net amount for invoice " + invoiceNumber) * 0.2)
		).as("calculated tax for invoice " + invoiceNumber);
	}

};

});

require.define("/test/scenarios/object-collaboration/tiered-flat-tax-calculator.js", function (require, module, exports, __dirname, __filename) {
var mop;

module.exports.bootstrap = {
	init: function(jsmop) {
		mop = jsmop;
		mop.register(Calculator);
		mop.send().as("new tax calculator");
	}
};

function toPrice(amount) { return Math.round(amount * 100) / 100; }

function calcTaxForInvoice(invoiceNumber) {
	var total = 0;
	// get a list of line items
	var lines = mop.send().as("line items for invoice " + invoiceNumber);

	// for each one, check the unit price.
	for(var i in lines) {
		var line = lines[i];
		// between 100 and 1000 - add flat tax per unit
		if(line.Item.UnitPrice >= 100 && line.Item.UnitPrice <= 1000) {
			total += (line.Amount * flat_tax_amount);
		}
		// otherwise - add percentage tax amount per line
		else {
			total += toPrice(line.Amount * (toPrice(line.Item.UnitPrice * percentage_tax_amount / 100)));
		}
	}
	// return total
	mop.send(total).as("calculated tax for invoice " + invoiceNumber);
}

var flat_tax_amount = 10,
	percentage_tax_amount = 20
	;

var Calculator = {

	receive_flat_tax_amount: function(amount) { flat_tax_amount = amount; mop.send().as("new tax rate"); },
	receive_percentage_tax_amount: function(amount) { percentage_tax_amount = amount; mop.send().as("new tax rate"); },
	receive_calculate_tax_for_invoice: calcTaxForInvoice

};
});

require.define("/test/auto-registration-of-handlers.js", function (require, module, exports, __dirname, __filename) {
    var jsmop = require("../gbL.jsMop"),
	expect = require("expect.js")
	;

var mop = new jsmop.Mop();

describe("Given an object with handlers", function() {

	var subject = {
		received : { abuse : [], love : [] },
		receive_general_abuse : function(abuse) {
			this.received.abuse.push(abuse);
		},
		receive_general_love : function(love) {
			this.received.love.push(love);
		}
	};

	describe("when that object is registered", function() {
		mop.register(subject);

		describe("and when a message is sent", function() {
			mop.send("dziuba").as("general", "abuse");
		
			it("the object should receive the message through its handler", function() {
				expect(subject.received.abuse).to.contain("dziuba");
			});
		});

		describe("but when the object's handler is Unregistered and when message is sent", function() {
			mop
				.unregisterHandler(subject.receive_general_abuse)
				.send("zoomba").as("general", "abuse");

			it("the object should not receive the message", function() {
				expect(subject.received.abuse).to.not.contain("zoomba");
			});
		});

		describe("but when the object is unregistered and when message is sent", function() {
			mop
				.unregister(subject)
				.send("hugs").as("general love");

			it("the object should not receive the message", function() {
				expect(subject.received.love).to.be.empty();
			});
		});
	});

});
});
require("/test/auto-registration-of-handlers.js");

require.define("/test/patterns-of-receiving.js", function (require, module, exports, __dirname, __filename) {
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
});
require("/test/patterns-of-receiving.js");

require.define("/test/patterns-of-return.js", function (require, module, exports, __dirname, __filename) {
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
});
require("/test/patterns-of-return.js");

require.define("/test/patterns-of-sending.js", function (require, module, exports, __dirname, __filename) {
    var jsmop = require("../gbL.jsMop"),
	expect = require("expect.js")
	;

var mop = new jsmop.Mop();

describe("Given a registered object with handlers", function() {

	var subject = {
		received : { abuse : [], love : [] },
		receive_general_abuse : function(abuse) {
			this.received.abuse.push(abuse);
		},
		receive_general_love : function(love) {
			this.received.love.push(love);
		}
	};

	mop.register(subject);

	describe("When a message is sent using space delimited subject", function() {
		mop.send("yo sushi").as("general abuse");

		it("the object should receive the message through its handler", function() {
			expect(subject.received.abuse).to.contain("yo sushi");
		});
	});

	describe("When a message is sent using as instead of withSubject", function() {
		mop.send("yo su").as("general love");

		it("the object should receive the message through its handler", function() {
			expect(subject.received.love).to.contain("yo su");
		});
	});
});
});
require("/test/patterns-of-sending.js");

require.define("/test/registration-closures.js", function (require, module, exports, __dirname, __filename) {
    var expect = require("expect.js"),
	jsmop = require("../gbL.jsMop")
	;

describe("Given a temporary need for a receiver", function() {
	var received = [];
	var mop = new jsmop.Mop();
	describe("When I send within a registration closure", function() {

		mop.withRegistered({ receive_something: function(message) { received.push(message); } }, function() {
			mop.send("hello").as("something");
		});

		it("The registered object should receive", function() {
			expect(received).to.contain("hello");
		});

		describe("But when sending again", function() {
			mop.send("goodbye").as("something");

			it("should not receive the message", function() {
				expect(received).to.not.contain("goodbye");
			});
		});
	});
});
});
require("/test/registration-closures.js");

require.define("/test/resetting-the-context.js", function (require, module, exports, __dirname, __filename) {
    var jsmop = require("../gbL.jsMop"),
	expect = require("expect.js")
	;

var mop = new jsmop.Mop();

describe("Given a hub with registered handlers", function() {
	
	mop.register({
		receive_hello_world : function() {
			return "hello to you too";
		}
	});

	describe("When I send a hello world", function() {
		var result = mop.send().as("hello world");

		it("Should respond with hello to you too", function() {
			expect(result).to.be("hello to you too");
		});

		describe("But when I reset the context and send the same message", function() {
			var result2 = mop
				.reset()
				.send().as("hello world");

			it("Should no longer receive a response", function() {
				expect(result2).to.be.empty();
			});
		});
	});
});
});
require("/test/resetting-the-context.js");

require.define("/test/scenarios/module-collaboration/module-collaboration-scenario.js", function (require, module, exports, __dirname, __filename) {
    var jsmop = require("../../../gbL.jsMop"),
	expect = require("expect.js")
	;

var mop = new jsmop.Mop();

describe("Given an MVC", function() {
	
	var outputs = [];
	module.receive_view_output = function(output) { outputs.push(output); };
	
	mop
		.boot({
			model: require("./simple-model"),
			view: require("./simple-view"),
			controller: require("./simple-controller")
		})
		.register(module); // to receive view output

	describe("When I send GET report", function() {
		mop.send().as("GET report");

		it("Should return a report view", function() {
			expect(outputs).to.contain("<pretty>I am the model</pretty>");
		});
	});
});
});
require("/test/scenarios/module-collaboration/module-collaboration-scenario.js");

require.define("/test/scenarios/module-collaboration/simple-controller.js", function (require, module, exports, __dirname, __filename) {
    var mop;

module.exports = {
	bootstrap : {
		init: function(jsmop) {
			mop = jsmop
				.register(new Controller(), "Simple controller");
		}
	}
};

var Controller = function() {

	var getMethod = function() {
		var route = mop.topics;
		route.shift();
		if(route.length<1) return;
		var action = route[0];
		switch(action) {
			case "report":
				mop.send().as("model populate");
				var report = mop.send().as("model report request");
				mop.send(report).as("model for view");
				break;
			case "jslint":
				// is annoying
				break;
			default:
				throw "[simple-controller] ERROR: Unknown action";
		}
	};

	return {
		receive_GET : getMethod
	};
};
});
require("/test/scenarios/module-collaboration/simple-controller.js");

require.define("/test/scenarios/module-collaboration/simple-model.js", function (require, module, exports, __dirname, __filename) {
    var mop;

exports.bootstrap = {
	init: function(jsmop) {
		(mop = jsmop)
			.register(new SimpleModel(), "Simple model");
	}
};

var SimpleModel = function() {

	var state = "";

	var populate = function(){
		state = "I am the model";
	};

	var summarise = function() {
		return state;
	};

	return {
		receive_model_populate:			populate,
		receive_model_report_request:	summarise
	};
};
});
require("/test/scenarios/module-collaboration/simple-model.js");

require.define("/test/scenarios/module-collaboration/simple-view.js", function (require, module, exports, __dirname, __filename) {
    var mop;

exports.bootstrap = {
	init: function(jsmop) {
		(mop = jsmop)
			.register(new SimpleView(), "Simple view");
	}
};

var SimpleView = function() {

	var render = function(model) {
		mop.send("<pretty>" + model + "</pretty>").as("view output");
	};

	return {
		receive_model_for_view:			render
	};
};
});
require("/test/scenarios/module-collaboration/simple-view.js");

require.define("/test/scenarios/object-collaboration/invoice-factory.js", function (require, module, exports, __dirname, __filename) {
    var mop,
	invoices = require("./invoice")
	;

module.exports.bootstrap = {
	init: function(jsmop) {
		(mop = jsmop)
			.register(new InvoiceFactory(), "Invoice factory")
			;
	}
};

var invoiceNumberSeed = new Date().getTime();

function InvoiceFactory() {

	var build = function() {
		var invoiceId = ++invoiceNumberSeed;
		var invoice = new invoices.Invoice(invoiceId, mop);
		mop.register(invoice, "Invoice #" + invoiceId);
		return invoiceId;
	};

	return {
		receive_new_invoice_request: build
	};
}
});
require("/test/scenarios/object-collaboration/invoice-factory.js");

require.define("/test/scenarios/object-collaboration/invoice.js", function (require, module, exports, __dirname, __filename) {
    module.exports.Invoice = function(invoiceId, mop) {

	// encapsulated state
	var lineItems = [],
		totals = { net: null, tax: null, gross: null },
		status = "open"
		;

	// private functions
	function toPrice(amount) { return Math.round(amount * 100) / 100; }

	function recalculate() {
		var net = 0;
		for(var i in lineItems)
			net += toPrice(lineItems[i].Item.UnitPrice * lineItems[i].Amount);

		totals = { net: net, tax: null, gross: null };

		mop.send(invoiceId).as("calculate tax for invoice");
	}

	function cloneTotals() {
		return { net: totals.net, tax: totals.tax, gross: totals.gross };
	}

	function cloneLineItems() {
		var ret = [];
		for(var i in lineItems) {
			var lineItem = lineItems[i];
			ret.push({ Item: lineItem.Item, Amount: lineItem.Amount });
		}
		return ret;
	}

	function setCalculatedTax(tax) {
		var newTotals = cloneTotals();
		newTotals.tax = tax;
		newTotals.gross = toPrice(totals.net + tax);
		totals = newTotals;
	}

	function addLineItem(item, amount) {
		lineItems.push({ Item: item, Amount: amount});
		recalculate();
	}

	// message handlers
	this.receive_line_item_for_invoice = function(item, amount) { addLineItem(item, amount); };
	this.receive_total_amount_for_invoice = function() { return totals.gross; };
	this.receive_net_amount_for_invoice = function() { return totals.net; };
	this.receive_calculated_tax_for_invoice = function(tax) { setCalculatedTax(tax); };
	this.receive_request_totals_report_for_invoice = function() { return cloneTotals(); };
	this.receive_line_items_for_invoice = function() { return cloneLineItems(); };

	mop.setReceiveFilters(this, function(topics) {
		// only accept for my invoice number
		return topics.slice(-1)[0] == invoiceId;
	});

	this.receive_invoice_paid = function() { status = "paid"; };
	this.receive_invoice_paid.filter = function(topics, data) { return data && data[0] == invoiceId; };

	this.receive_request_invoice_totals_report = function() { return cloneTotals(); };
	this.receive_request_invoice_totals_report.filter = function(topics, data) {
		return data && data[0] && data[0].status == status;
	};

	this.receive_new_tax = function() { recalculate(); };
};
});
require("/test/scenarios/object-collaboration/invoice.js");

require.define("/test/scenarios/object-collaboration/object-collaboration-scenario.js", function (require, module, exports, __dirname, __filename) {
    var jsmop = require("../../../gbL.jsMop"),
	expect = require("expect.js")
	;

var mop = new jsmop.Mop();
/*

	This scenario depicts the process of creating a new invoice, adding some line items to it, and requesting the total amount.
	Then we create two more invoices with line items, and we mark the first invoice as paid.
	We request a report of all outstanding invoice amounts, including total charges and total tax.
	Finally, we change the way tax is calculated to a flat-tax for items between £100 and £1000 and request a new report.

*/

describe("Given an invoice factory", function() {

	var objects = {
		factory: require("./invoice-factory"),
		taxCalculator: require("./uk-VAT-calculator")
	};

	mop.reset().boot(objects);

	describe("When I request a new invoice", function() {
		var invoiceNumber = mop.send().as("new invoice request");

		it("Should return the number of the new invoice", function() {
			expect(invoiceNumber).to.be.greaterThan(0);
		});

		var toPrice = function(amount) { return Math.round(amount * 100) / 100; };

		describe("When I add two line items to the invoice and request the total amount", function() {
			var kitkat = { Description: "Kit kat", UnitPrice: 0.89 };
			var ferrari = { Description: "Any old Ferrari will do", UnitPrice: 200000.00 };
			var netbook = { Description: "Samsung netbook", UnitPrice: 319.99 };

			var lineItem = "line item for invoice " + invoiceNumber;
			
			mop.send(kitkat, 3).as(lineItem);
			mop.send(ferrari, 2).as(lineItem);

			var total = mop.send().as("total amount for invoice " + invoiceNumber);
			
			it("Should return the total for the invoice", function() {
				var taxFactor = 1.2; // 20% tax? surely that's a bug?
				var amount = (toPrice(kitkat.UnitPrice * 3) + toPrice(ferrari.UnitPrice * 2)) * taxFactor;
				var expected = toPrice(amount);
				expect(total).to.be(expected);
			});


			describe("When I add two more invoices with line items, pay the first invoice and request an outstanding amount report", function() {
				var invoice2 = mop.send().as("new invoice request");
				var invoice3 = mop.send().as("new invoice request");

				mop.send(kitkat, 1).as("line item for invoice " + invoice2);
				mop.send(ferrari, 3).as("line item for invoice " + invoice2);
				mop.send(kitkat, 5).as("line item for invoice " + invoice3);
				mop.send(netbook, 2).as("line item for invoice " + invoice3);

				mop.send(invoiceNumber).as("invoice paid");

				var report = mop.send({ status: "open" }).forList().as("request invoice totals report");

				it("Should return a report with two totals", function() {
					expect(report).to.have.length(2);
				});

				it("Should return the correct tax amount for each report", function() {
					var sampleTotals = report[1];
					var expectedTax = toPrice(sampleTotals.net * 0.2);
					expect(sampleTotals.tax).to.be(expectedTax);
				});

				describe("When I change the tax calculator and request a report", function() {
					mop
						.unregister(objects.taxCalculator)
						.boot({ taxCalculator: require("./tiered-flat-tax-calculator") })
						.send(42).as("flat tax amount");
					
					var report = mop.send().as("request totals report for invoice " + invoice3);

					it("Should return the correct tax", function() {

						var expectedTax =
							(toPrice(toPrice(kitkat.UnitPrice * 0.2) * 5)) + // percentage tax for the kitkats
							(2 * 42) // flat tax for the two netbooks
							;

						expect(report.tax).to.be(expectedTax);
					});
				});
			});
		});
	});

});
});
require("/test/scenarios/object-collaboration/object-collaboration-scenario.js");

require.define("/test/scenarios/object-collaboration/tiered-flat-tax-calculator.js", function (require, module, exports, __dirname, __filename) {
    var mop;

module.exports.bootstrap = {
	init: function(jsmop) {
		mop = jsmop;
		mop.register(Calculator);
		mop.send().as("new tax calculator");
	}
};

function toPrice(amount) { return Math.round(amount * 100) / 100; }

function calcTaxForInvoice(invoiceNumber) {
	var total = 0;
	// get a list of line items
	var lines = mop.send().as("line items for invoice " + invoiceNumber);

	// for each one, check the unit price.
	for(var i in lines) {
		var line = lines[i];
		// between 100 and 1000 - add flat tax per unit
		if(line.Item.UnitPrice >= 100 && line.Item.UnitPrice <= 1000) {
			total += (line.Amount * flat_tax_amount);
		}
		// otherwise - add percentage tax amount per line
		else {
			total += toPrice(line.Amount * (toPrice(line.Item.UnitPrice * percentage_tax_amount / 100)));
		}
	}
	// return total
	mop.send(total).as("calculated tax for invoice " + invoiceNumber);
}

var flat_tax_amount = 10,
	percentage_tax_amount = 20
	;

var Calculator = {

	receive_flat_tax_amount: function(amount) { flat_tax_amount = amount; mop.send().as("new tax rate"); },
	receive_percentage_tax_amount: function(amount) { percentage_tax_amount = amount; mop.send().as("new tax rate"); },
	receive_calculate_tax_for_invoice: calcTaxForInvoice

};
});
require("/test/scenarios/object-collaboration/tiered-flat-tax-calculator.js");

require.define("/test/scenarios/object-collaboration/uk-VAT-calculator.js", function (require, module, exports, __dirname, __filename) {
    var mop;

module.exports.bootstrap = {
	init: function(jsmop) {
		mop = jsmop;
		mop.register(Calculator);
	}
};

var toPrice = function(amount) { return Math.round(amount * 100) / 100; };

var Calculator = {

	receive_calculate_tax_for_invoice: function(invoiceNumber) {
		// just get the net amount and multiply by 0.2
		mop.send(
			toPrice(mop.send().as("net amount for invoice " + invoiceNumber) * 0.2)
		).as("calculated tax for invoice " + invoiceNumber);
	}

};

});
require("/test/scenarios/object-collaboration/uk-VAT-calculator.js");

require.define("/test/utilities.js", function (require, module, exports, __dirname, __filename) {
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
});
require("/test/utilities.js");

require.define("/test/work-with-node.js", function (require, module, exports, __dirname, __filename) {
    var jsmop = require("../gbL.jsMop"),
	expect = require("expect.js")
	;

var mop = new jsmop.Mop();

describe("Given require('gbL-jsMop')", function() {

	it("the boot function should be available", function() {
		expect(mop.boot).to.be.a("function");
	});

	describe("when a handler is registered", function() {

		var helloWorldHandlerData = [];

		mop.registerHandler(["hello", "world"], function(data) {
			helloWorldHandlerData.push(data);
		});

		describe("and when a message is sent with matching subject", function() {
			mop.send("hi").as("hello", "world");
		
			it("the handler should receive the message", function() {
				expect(helloWorldHandlerData).to.contain("hi");
			});
		});

		describe("and when a message is sent with matching partial subject", function() {
			mop.send("hi 2").as("hello", "world", "other");

			it("The handler should still receive the message", function() {
				expect(helloWorldHandlerData).to.contain("hi 2");
			});
		});

	});

	describe("when a handler is registered using space-delimited syntax", function() {
		
		var helloHeavenHandlerData = [];

		mop.registerHandler("hello heaven", function(data) {
			helloHeavenHandlerData.push(data);
		});

		describe("and a message is sent with matching subject", function() {
			mop.send("hi").as("hello", "heaven");

			it("the handler should receive the message", function() {
				expect(helloHeavenHandlerData).to.contain("hi");
			});
		});
	});

});
});
require("/test/work-with-node.js");
