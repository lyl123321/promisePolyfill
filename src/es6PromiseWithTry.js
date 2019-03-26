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
        const eventArr = this._listeners[type];

        if (eventArr instanceof Array) {
            for (let i = 0, len = eventArr.length; i < len; i++) {
                if (typeof eventArr[i] === "function") {
                    eventArr[i].call(this);
                }
            }
        }

        return this;
    },
    removeEvent: function(type, fn) {
        const eventArr = this._listeners[type];

        if (eventArr instanceof Array) {
            if (typeof fn === "function") {
                for (let i = 0, len = eventArr.length; i < len; i++) {
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
		const self = this;
		
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
				});
			},
			configurable: true
		});
		
		if(typeof executor === 'function') {
			//捕获错误
			try {
				executor.call(null, function resolve(valueArg) {
					if(valueArg instanceof Promise) {
						if(valueArg.status === 'fulfilled') {
							self.value = valueArg.value;
							self.status = 'fulfilled';
						} else if (valueArg.status === 'rejected') {
							self.reason = valueArg.reason;
							self.status = 'rejected';
						} else {
							valueArg.then(function(value){
								self.value = value;
								self.status = 'fulfilled';
							},function(reason) {
								self.reason = reason;
								self.status = 'rejected';
							});
						}
					} else {
						self.value = valueArg;
						self.status = 'fulfilled';
					}
				}, function reject(reasonArg) {
					self.reason = reasonArg;
					self.status = 'rejected';
					throw reasonArg;
				});
			} catch(err) {
				self.reason = err;
				self.status = 'rejected';
				setTimeout(() => {throw `(in promiseddd) ${err}`});
			}
		}
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
		
		try: {
			value: tryFn,
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
		
		then: function(onFulfilled = identity, onRejected = thrower) {
			const pro = new Promise();
			
			this.events.addEvent('change', hander.bind(null, this));
			
			function hander(that) {
				let res;
				
				try {
					if(that.status === 'fulfilled') {
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
						res.then(function(value){
							pro.value = value;
							pro.status = 'fulfilled';
						},function(reason) {
							pro.reason = reason;
							pro.status = 'rejected';
						});
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
			const pro = new Promise();
			
			this.events.addEvent('change', hander.bind(null, this));
			
			function hander(that) {
				let res;
				
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
		if(value instanceof Promise) {
			return value;
		}
		
		if(typeof value === 'object' && typeof value.then === 'function') {
			return new Promise(value.then);
		}
		
		const pro = new Promise();
		
		pro.value = value;
		pro.status = 'fulfilled';
		
		return pro;
	}
	
	function reject(reason) {
		const pro = new Promise();
		
		pro.reason = reason;
		pro.status = 'rejected';
		
		return pro;
	}
	
	//实现 Promise.try
	function tryFn(fn, thisArg = null, ...args) {
		if(typeof fn === 'function') {
			return new Promise(resolve => resolve(fn.apply(thisArg, args)));
		} else {
			const err = new TypeError(`${typeof fn} ${fn} is not a function`);
			return Promise.try(() => {throw err});
		}
	}
	
	function all(iterable) {
		if(iterable[Symbol.iterator] === undefined) {
			const err = new TypeError(`${typeof iterable} ${iterable} is not iterable (cannot read property Symbol(Symbol.iterator))`);
			return Promise.try(() => {throw err});
		}
		
		const iteArray = Array.from(iterable);
		const len = iteArray.length;
		
		if(len === 0) {
			return Promise.resolve([]);
		}
		
		const pro = new Promise();
		const valueArr = [];
		
		setTimeout(function() {
			let index = 0,	//记录当前索引
				count = 0;
			
			for(let val of iteArray) {
				-function(i){
					if(val instanceof Promise) {		//当前值为 Promise 对象时
						if(val.status === 'pending') {
							val.then(function(value) {
								valueArr[i] = value;
								count++;
								
								if(count === len) {
									pro.value = valueArr;
									pro.status = 'fulfilled';
								}
							}, function(reason) {
								pro.reason = reason;
								pro.status = 'rejected';
								removeEv(iteArray);
							});
						} else if(val.status === 'rejected') {
							pro.reason = val.reason;
							pro.status = 'rejected';
							return;
						} else {
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
			
			if(count === len) {
				pro.value = valueArr;
				pro.status = 'fulfilled';
			}
		});
		
		return pro;
	}
	
	function race(iterable) {
		if(iterable[Symbol.iterator] === undefined) {
			const err = new TypeError(`${typeof iterable} ${iterable} is not iterable (cannot read property Symbol(Symbol.iterator))`);
			return Promise.try(() => {throw err});
		}
		
		const iteArray = Array.from(iterable);
		const len = iteArray.length;
		
		if(len === 0) {
			return Promise.resolve([]);
		}
		
		const pro = new Promise();
		
		setTimeout(function() {
			for(let val of iteArray) {
				if(val instanceof Promise) {
					if(val.status === 'pending') {
						val.then(function(value) {
							pro.value = value;
							pro.status = 'fulfilled';
							removeEv(iteArray);
						}, function(reason) {
							pro.reason = reason;
							pro.status = 'rejected';
							removeEv(iteArray);
						});
					} else if(val.status === 'rejected') {
						pro.reason = val.reason;
						pro.status = 'rejected';
						removeEv(iteArray);
						return;
					} else {
						pro.value = val.value;
						pro.status = 'fulfilled';
						removeEv(iteArray);
						return;
					}
				} else {
					pro.value = val;
					pro.status = 'fulfilled';
					removeEv(iteArray);
					return;
				}
			}
		});
		
		return pro;
	}
	
	function identity(value) {
		return value;
	}
	
	function thrower(reason) {
		throw reason;
	}
	
	function removeEv(iterable) {
		for(let uselessPromise of iterable) {
			if(uselessPromise instanceof Promise && uselessPromise.status === 'pending') {
				uselessPromise.events.removeEvent('change');
			}
		}
	}
	
	window.$Promise = Promise;
})();

//给原生 Promise 扩展 try 方法
Promise.try = function(func) {
    return new Promise(function(resolve, reject) {
        resolve(func());
    });
}

//测试1: $Promise.try
function synError() {
	throw new Error('Synchronous error!');
}

let p = $Promise.try(() => synError());		//等价于 let p1 = $Promise.try(synError);

//如果想传参
let p1 = $Promise.try(function(a) {
	throw a;
}, null, 'error');

//如果非函数
let p2 = $Promise.try(2);

console.log(p);
console.log(p1);
console.log(p2);

/*
//测试2：比较 Promise.try 与 $Promise.try
let p3 = Promise.try(() => {throw 'promise'});
let p4 = $Promise.try(() => {throw '$promise'});

console.log(p3);
console.log(p4);

//测试3：比较 Promise.all 与 $Promise.all
let p5 = Promise.all(1);
let p6 = $Promise.all(1);

console.log(p5);
console.log(p6);
*/
