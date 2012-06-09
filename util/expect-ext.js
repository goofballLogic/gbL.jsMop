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