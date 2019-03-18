'use strict';
//原型实现观察者模式
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
			
			//绑定回调函数，onFulfilled 和 onRejected 用一个回调函数处理
			this.events.addEvent('change', hander.bind(null, this));
			
			function hander(that) {
				var res;	//onFulfilled 或 onRejected 回调函数执行后得到的结果
				
				try {
					if(that.status === 'fulfilled') {
						//如果onFulfilled不是函数，它会在then方法内部被替换成一个 Identity 函数
						typeof onFulfilled !== 'function' ? onFulfilled = identity : false;
						//将参数 that.value 传入 onFulfilled 并执行，将结果赋给 res
						res = onFulfilled.call(null, that.value);
					} else if(that.status === 'rejected') {
						//如果onRejected不是函数，它会在then方法内部被替换成一个 Thrower 函数
						typeof onRejected !== 'function' ? onRejected = thrower : false;
						
						res = onRejected.call(null, that.reason);
					}
				} catch(err) {
					//抛出一个错误，情况3
					pro.reason = err;
					pro.status = 'rejected';
					
					return;
				}
				
				if(res instanceof Promise) {
					if(res.status === 'fulfilled') {		//情况4
						pro.value = res.value;
						pro.status = 'fulfilled';
					} else if (res.status === 'rejected') {	//情况5
						pro.reason = res.reason;
						pro.status = 'rejected';
					} else {								//情况6
						//res.status === 'pending'时，pro 跟随 res
						//pro.status = 'pending';
						res.then(function(value){
							pro.value = value;
							pro.status = 'fulfilled';
						},function(reason) {
							pro.reason = reason;
							pro.status = 'rejected';
						});
					}
				} else {
					//回调函数返回一个值或不返回任何内容，情况1、2
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
					//pro.status = 'pending';
					res.then(function(value){
						pro.value = value;
						pro.status = 'fulfilled';
					},function(reason) {
						pro.reason = reason;
						pro.status = 'rejected';
					});
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
			return value;
		}
		
		var pro = new Promise();
		
		//跟随 thenable 对象，这个跟随不知道怎么实现，有兴趣的可以试试
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
		//如果 iterable 不是一个可迭代对象
		if(iterable[Symbol.iterator] == undefined) {
			let err = new TypeError(typeof iterable + iterable + ' is not iterable (cannot read property Symbol(Symbol.iterator))');
			return Promise.reject(err);
		}
		
		//如果 iterable 对象为空
		if(iterable.length === 0) {
			return Promise.resolve([]);
		}
		
		//其它情况用异步处理
		var pro = new Promise(),	//all 返回的 promise 对象
			valueArr = [];			//all 返回的 promise 对象的 value 属性
		
		setTimeout(function() {
			var index = 0,	//记录当前索引
				count = 0,
				len = iterable.length;
			
			for(let val of iterable) {
				-function(i){
					if(val instanceof Promise) {		//当前值为 Promise 对象时
						if(val.status === 'pending') {
							val.then(function(value) {
								valueArr[i] = value;
								count++;
								//Promise.all([new Promise(function(resolve){setTimeout(resolve, 100, 1)}), 2, 3, 4])
								if(count === len) {
									pro.value = valueArr;
									pro.status = 'fulfilled';
								}
							}, function(reason) {
								pro.reason = reason;
								pro.status = 'rejected';
								//当一个pending Promise首先完成时，解除其它 pending Promise的事件，防止之后其它 Promise 改变 pro 的状态
								removeEv(iterable);
							});
						} else if(val.status === 'rejected') {
							pro.reason = val.reason;
							pro.status = 'rejected';
							return;
						} else {
							//val.status === 'fulfilled'
							valueArr[i] = val.value;
							count++;
						}
					} else {
						valueArr[i] = val;
						count++;
					}
					index++;
				}(index);
			}
			
			//如果 iterable 对象中的 promise 对象都变为 fulfilled 状态，或者 iterable 对象内没有 promise 对象,
			//由于我们可能需要等待 pending promise 的结果，所以要额外花费一个变量计数，而不能用valueArr的长度判断。
			if(count === len) {
				pro.value = valueArr;
				pro.status = 'fulfilled';
			}
		}, 0);
		
		return pro;
	}
	
	function race(iterable) {
		if(iterable[Symbol.iterator] == undefined) {
			let err = new TypeError(typeof iterable + iterable + ' is not iterable (cannot read property Symbol(Symbol.iterator))');
			return Promise.reject(err);
		}
		
		if(iterable.length === 0) {
			return Promise.resolve([]);
		}
		
		var pro = new Promise();
		
		setTimeout(function() {
			for(let val of iterable) {
				if(val instanceof Promise) {
					if(val.status === 'pending') {
						val.then(function(value) {
							pro.value = value;
							pro.status = 'fulfilled';
							removeEv(iterable);
						}, function(reason) {
							pro.reason = reason;
							pro.status = 'rejected';
							removeEv(iterable);
						});
					} else if(val.status === 'rejected') {
						pro.reason = val.reason;
						pro.status = 'rejected';
						removeEv(iterable);
						return;
					} else {
						pro.value = val.value;
						pro.status = 'fulfilled';
						removeEv(iterable);
						return;
					}
				} else {
					pro.value = val;
					pro.status = 'fulfilled';
					removeEv(iterable);
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
	
	function removeEv(iterable) {
		for(let uselessPromise of iterable) {
			if(uselessPromise instanceof Promise && uselessPromise.status === 'pending') {
				uselessPromise.events.removeEvent('change');
			}
		}
	}
	
	window.Promise = Promise;
})();

var fromCallback;

var fromThen = Promise.resolve('done')
.then(function onFulfilled(value) {
    fromCallback = new Promise(function(resolve){
    	setTimeout(() => resolve(value), 0);	//未执行 setTimeout 的回调方法之前 fromCallback 为'pending'状态
    });
    return fromCallback;	//then 方法返回的 fromThen 将跟随 onFulfilled 方法返回的 fromCallback
});

setTimeout(function() {
	//目前已执行完 onFulfilled 回调函数，fromCallback 为'pending'状态，fromThen ‘跟随’ fromCallback
    console.log(fromCallback.status);    //fromCallback.status === 'pending'
    console.log(fromThen.status);        //fromThen.status === 'pending'
    setTimeout(function() {
    	//目前已执行完 setTimeout 中的回调函数，fromCallback 为'fulfilled'状态，fromThen 也跟着变为'fulfilled'状态
	    console.log(fromCallback.status + ' ' + fromCallback.value);    //fromCallback.status === 'fulfilled'
	    console.log(fromThen.status + ' ' + fromThen.value);        //fromThen.status === 'fulfilled'
	    console.log(fromCallback === fromThen);		//false
	}, 100);	//将这个 delay 参数改为 0 试试
}, 0);
