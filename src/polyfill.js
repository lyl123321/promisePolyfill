'use strict';
function Events() {
    this._listeners = {};
}

Events.prototype = {
    constructor: Events,

    addEvent: function(type, fn) {
        this._listeners[type] = this._listeners[type] || [];

        if (typeof fn === "function") {
            this._listeners[type].push(fn);
        }

        return this;
    },

    fireEvent: function(type) {
        var eventArr = this._listeners[type];

        if (eventArr instanceof Array) {
            for (var i = 0, len = eventArr.length; i < len; i++) {
                if (typeof eventArr[i] === "function") {
                    eventArr[i].call(this);
                }
            }
        }

        return this;
    },
    removeEvent: function(type, fn) {
        var eventArr = this._listeners[type];

        if (eventArr instanceof Array) {
            if (typeof fn === "function") {
                for (var i = 0, len = eventArr.length; i < len; i++) {
                    if (eventArr[i] === fn) {
                        eventArr.splice(i, 1);
                        break;
                    }
                }
            } else if (typeof fn === "undefined") {
                delete this._listeners[type];
            }
        }
    }
};
	
;(function() {
	function Promise(executor) {
		var self = this;
		
		//存储状态的私有属性
		this._status = 'pending';
		
		this.value = undefined;
		this.reason = undefined;
		this.events = new Events();
		
		//存储状态的公开属性
		Object.defineProperty(this, 'status', {
			get: function() {
				return self._status;
			},
			set: function(newValue) {
				self._status = newValue;
				setTimeout(() => {
					self.events.fireEvent('change');
				}, 0);
			},
			configurable: true
		});
		
		typeof executor === 'function' ? executor.call(null, function(value) {
			self.value = value;
			self.status = 'fulfilled';
		}, function(reason) {
			self.reason = reason;
			self.status = 'rejected';
		}) : false;
	}
	
	Object.defineProperties(Promise, {
		resolve: {
			value: resolve,
			configurable: true,
			writable: true
		},
		
		reject: {
			value: reject,
			configurable: true,
			writable: true
		},
		
		all: {
			value: all,
			configurable: true,
			writable: true
		},
		
		race: {
			value: race,
			configurable: true,
			writable: true
		}
	});
	
	Promise.prototype = {
		constructor: Promise,
		
		then: function(onFulfilled, onRejected) {
			var pro = new Promise();
			
			this.events.addEvent('change', hander.bind(null, this));
			
			function hander(that) {
				var res;
				
				try {
					if(that.status === 'fulfilled') {
						//onFulfilled == null ? pro._status = that.status : false;
						
						typeof onFulfilled !== 'function' ? onFulfilled = identity : false;
						
						res = onFulfilled.call(null, that.value);
					} else if(that.status === 'rejected') {
						typeof onRejected !== 'function' ? onRejected = thrower : false;
						
						res = onRejected.call(null, that.reason);
					}
				} catch(err) {
					pro.reason = err;
					pro.status = 'rejected';
					
					return;
				}
				
				if(res instanceof Promise) {
					if(res.status === 'fulfilled') {
						pro.value = res.value;
						pro.status = 'fulfilled';
					} else if (res.status === 'rejected') {
						pro.reason = res.reason;
						pro.status = 'rejected';
					} else {
						//res.status === 'pending'时，pro 跟随 res
						res.then(function(value){
							pro.value = value;
							pro.status = 'fulfilled';
						},function(reason) {
							pro.reason = reason;
							pro.status = 'rejected';
						});
						pro.status = 'pending';
					}
				} else {
					pro.value = res;
					pro.status = 'fulfilled';
				}
			}
			
			return pro;
		},
		
		catch: function(onRejected) {
			return this.then(undefined, onRejected);
		},
		
		finally: function(onFinally) {
			var pro = new Promise();
			
			this.events.addEvent('change', hander.bind(null, this));
			
			function hander(that) {
				var res;
				
				try {
					res = typeof onFinally === 'function' ? onFinally() : undefined;
				} catch(err) {
					pro.reason = err;
					pro.status = 'rejected';
					
					return;
				}
				
				if(res instanceof Promise && res.status === 'rejected') {
					pro.reason = res.reason;
					pro.status = 'rejected';
				} else if(res instanceof Promise && res.status === 'pending') {
					//res.status === 'pending'时，pro 跟随 res
					res.then(function(value){
						pro.value = value;
						pro.status = 'fulfilled';
					},function(reason) {
						pro.reason = reason;
						pro.status = 'rejected';
					});
					pro.status = 'pending';
				} else {
					pro.value = that.value;
					pro.reason = that.reason;
					pro.status = that.status;
				}
			}
			
			return pro;
		},
	}
	
	function resolve(value) {
		//Promise 对象直接返回
		if(value instanceof Promise) {
			return reason;
		}
		
		var pro = new Promise(),
			tem = new Promise();
		
		//跟随 thenable 对象，这个跟随不知道怎么实现
		if(typeof value === 'object' && value.then != null) {
			//pro.follow(value);
			//value.then(Promise.resolve, Promise.reject);
		}
		
		pro.value = value;
		pro.status = 'fulfilled';
		
		return pro;
	}
	
	function reject(reason) {
		var pro = new Promise();
		
		pro.reason = reason;
		pro.status = 'rejected';
		
		return pro;
	}
	
	function all(iterable) {
		var pro = new Promise(),
			valueArr = [],
			err;
		
		if(iterable[Symbol.iterator] == undefined) {
			err = new TypeError(typeof iterable + iterable + ' is not iterable (cannot read property Symbol(Symbol.iterator))');
			return Promise.reject(err);
		}
		
		if(iterable.length === 0) {
			return Promise.resolve([]);
		}
		
		setTimeout(function() {
			for(let val of iterable) {
				if(val instanceof Promise) {
					if(val.status === 'pending') {
						val.then(function(value) {
							valueArr[iterable.indexOf(val)] = val.value;
						}, function(reason) {
							pro.reason = val.reason;
							pro.value = undefined;
							pro.status = 'rejected';
							//当一个Promise首先完成时，解除其它 Promise 的事件，防止之后其它Promise触发事件
							setTimeout(() => pro.events.removeEvent('change'), 0);
						})
					} else if(val.status === 'rejected') {
						pro.reason = val.reason;
						pro.status = 'rejected';
						return;
					} else {
						valueArr[iterable.indexOf(val)] = val.value;
					}
				} else {
					valueArr[iterable.indexOf(val)] = val;
				}
			}
			
			pro.value = valueArr;
			pro.status = 'fulfilled';
		}, 0);
		
		return pro;
	}
	
	function race(iterable) {
		var pro = new Promise(),
			err;
		
		if(iterable[Symbol.iterator] == undefined) {
			err = new TypeError(typeof iterable + iterable + ' is not iterable (cannot read property Symbol(Symbol.iterator))');
			return Promise.reject(err);
		}
		
		if(iterable.length === 0) {
			return Promise.resolve([]);
		}
		
		setTimeout(function() {
			for(let val of iterable) {
				if(val instanceof Promise) {
					if(val.status === 'pending') {
						val.then(function(value) {
							pro.value = val.value;
							pro.status = 'fulfilled';
							//防止之后其它Promise触发事件
							setTimeout(() => pro.events.removeEvent('change'), 0);
						}, function(reason) {
							pro.reason = val.reason;
							pro.status = 'rejected';
							setTimeout(() => pro.events.removeEvent('change'), 0);
						})
					} else if(val.status === 'rejected') {
						pro.reason = val.reason;
						pro.status = 'rejected';
						return;
					} else {
						pro.value = val.value;
						pro.status = 'fulfilled';
						return;
					}
				} else {
					pro.value = val;
					pro.status = 'fulfilled';
					return;
				}
			}
		}, 0);
		
		return pro;
	}
	
	function identity(value) {
		return value;
	}
	
	function thrower(reason) {
		throw reason;
	}
	
	function isSettled(pro) {
		return pro instanceof Promise ? pro.status === 'fulfilled' || pro.status === 'rejected' : false;
	}
	
	window.Promise = Promise;
})();

var fromCallback;

var fromThen = Promise.resolve('done')
.then(function onFulfilled() {
    fromCallback = new Promise(function(resolve){
    	setTimeout(() => resolve(3), 0);
    });
    return fromCallback;	//未执行setTimeout异步前fromCallback为'pending'
});

setTimeout(function() {
	//执行 then 中回调onFulfilled后，fromCallback为'pending'，所以fromThen‘跟随’fromCallback，随之变化
    console.log(fromCallback);    //fromCallback.status === 'pending'
    console.log(fromThen);        //fromThen.status === 'pending'
    setTimeout(function() {
    	// onFulfilled 中的 异步 resolve 执行后，fromCallback 变为'resolved'，fromThen 也跟着变为'resolved'
	    console.log(fromCallback);    //fromCallback.status === 'resolved'
	    console.log(fromThen);        //fromThen.status === 'resolved'
	    console.log(fromCallback === fromThen);		//false
	}, 100);
}, 0);
