# Promise——从阅读文档到简单实现（二） #
## 前言 ##
按照文档说明简单地实现 ES6 `Promise`的各个方法并不难，但是`Promise`的一些特殊需求实现起来并不简单，我首先提出一些不好实现或者容易忽略的需求：
- 数据传递
- 回调绑定
- 将回调变成 microtask
- 实现 then/finally 返回的`pending` promise “跟随”它们的回调返回的`pending` promise
- 实现 resolve 返回的 promise “跟随”它的`thenable`对象参数

## 实现框架 ##
在解决上述问题前，我们先实现一个框架。
首先，我的目的是实现一个`Promise`插件，它包括：
- 构造函数：Promise
- 静态方法：resolve、reject、all 和 race
- 实例方法：then、catch 和 finally
- 私有函数：identity、thrower 和 isSettled 等
如下：
```
;(function() {
	function Promise(executor) {
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
		race: {
			value: race,
			configurable: true,
			writable: true
		},
		all: {
			value: all,
			configurable: true,
			writable: true
		}
	});
	
	Promise.prototype = {
		constructor: Promise,
		
		then: function(onFulfilled, onRejected) {
		},
		
		catch: function(onRejected) {
		},
		
		finally: function(onFinally) {
		},
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

```

## 解决问题 ##
接下来，我们解决各个问题。
### 数据传递 ###
为了传递数据——回调函数需要用到的参数以及 promise 的状态，我们首先在构造函数`Promise`中添加`status`、`value`和`reason`属性，并且在构造函数中执行 `executor` 函数：
```
function Promise(executor) {
    var self = this;

    this.status = 'pending';
    this.value = undefined;
    this.reason = undefined;

    typeof executor === 'function' ? executor.call(null,
    function(value) {
        self.value = value;
        self.status = 'fulfilled';
    },
    function(reason) {
        self.reason = reason;
        self.status = 'rejected';
    }) : false;
}
```
按照文档说明，为了实现链式调用，`Promise`的所有方法都会返回一个 Promise 对象，而且除了Promise.resolve(peomiseObj) 这种情况外都是新生成的 Promise 对象。所以接下来我的大部分方法都会返回一个新的 promise 对象。不生成新对象的特例：
```
var a = Promise.resolve('a'),
    b = Promise.resolve(a);
console.log(a === b)	//true
```
### 回调绑定 ###
接下来，我们要将`then`、`catch`和`finally`中的回调方法绑定到`Promise`对象的状态这个事件上。
我想到的第一个事件就是`onchange`事件，但是 promiseObj.status 属性上并没有`change`事件。但是，我马上想到每次设置`accessor`属性的值时，就会调用 accessor 属性的`setter`方法。那么，我只要把`status`属性设置为存取属性，然后在它的 setter 方法里绑定回调函数就行啦！如下：
```
function Promise(executor) {
    var self = this;

    //存储状态的私有属性
    this._status = 'pending';

    this.value = undefined;
    this.reason = undefined;
    //this.events = new Events();
    //存储状态的公开属性
    Object.defineProperty(this, 'status', {
        get: function() {
            return self._status;
        },
        set: function(newValue) {
            self._status = newValue;
            //self.events.fireEvent('change');
        },
        configurable: true
    });

    typeof executor === 'function' ? executor.call(null,
    function(value) {
        self.value = value;
        self.status = 'fulfilled';
    },
    function(reason) {
        self.reason = reason;
        self.status = 'rejected';
    }) : false;
}
```
为了绑定回调函数，我使用了发布订阅模式。在`then`、`catch`和`finally`方法执行的时候订阅事件`change`，将自己的回调函数绑定到`change`事件上，promiseObj.status 属性是发布者，一旦它的值发生改变就发布`change`事件，执行回调函数。
为了节省篇幅，不那么重要的发布者`Events`() 构造函数及其原型我就不贴代码了，文章末尾我会给出源代码。

### 实现 microtask ###
`then`、`catch`和`finally`方法的回调函数都是`microtask`，当满足条件（promise 对象状态改变）时，这些回调会被放入`microtask`队列。每当调用栈中的`macrotask`执行完毕时，立刻执行`microtask`队列中的所有`microtask`，这样一次事件循环就结束了，js引擎等待下一次循环。
要我实现`microtask`我是做不到的，我就只能用`macrotask`模仿一下`microtask`了，就像有些大人喜欢冒充小学生过儿童节一样，我用宏任务冒充一下微任务应该问题不大（才怪）。
我用 setTimeout 发布的`macrotask`进行模仿：
```
Object.defineProperty(this, 'status', {
    get: function() {
        return self._status;
    },
    set: function(newValue) {
        self._status = newValue;
        setTimeout(() = >{
            self.events.fireEvent('change');
        },
        0);
    },
    configurable: true
});
```
## 实现函数 ##
接下来，我们实现各个函数和方法。在知道方法的参数和返回值后再实现方法如有神助，而实现过程中最难处理的就是 pending 状态的 promise 对象，因为我们要等它变成其它状态时，再做真正的处理。下面我拿出两个最具代表性的方法来分析。

### 静态方法`all` ###
如果忘记了 Promise.`all`(iterable) 的参数和返回值，可以返回我上一篇文章查看。


```
function all(iterable) {
    //如果 iterable 不是一个可迭代对象
    if (iterable[Symbol.iterator] == undefined) {
        let err = new TypeError(typeof iterable + iterable + ' is not iterable (cannot read property Symbol(Symbol.iterator))');
        return Promise.reject(err);
    }

    //如果 iterable 对象为空
    if (iterable.length === 0) {
        return Promise.resolve([]);
    }

    //其它情况用异步处理
    var pro = new Promise(),
    //all 返回的 promise 对象
    valueArr = []; //all 返回的 promise 对象的 value 属性
    setTimeout(function() {
        var index = 0,
        //记录当前索引
        count = 0,
        len = iterable.length;

        for (let val of iterable) { -
            function(i) {
                if (val instanceof Promise) { //当前值为 Promise 对象时
                    if (val.status === 'pending') {
                        val.then(function(value) {
                            valueArr[i] = value;
                            count++;
                            //Promise.all([new Promise(function(resolve){setTimeout(resolve, 100, 1)}), 2, 3, 4])
                            if (count === len) {
                                pro.value = valueArr;
                                pro.status = 'fulfilled';
                            }
                        },
                        function(reason) {
                            pro.reason = reason;
                            pro.status = 'rejected';
                            //当一个pending Promise首先完成时，解除其它 pending Promise的事件，防止之后其它 Promise 改变 pro 的状态
                            for (let uselessPromise of iterable) {
                                if (uselessPromise instanceof Promise && uselessPromise.status === 'pending') {
                                    uselessPromise.events.removeEvent('change');
                                }
                            }
                        });
                    } else if (val.status === 'rejected') {
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
            } (index);
        }

        //如果 iterable 对象中的 promise 对象都变为 fulfilled 状态，或者 iterable 对象内没有 promise 对象,
        //由于我们可能需要等待 pending promise 的结果，所以要额外花费一个变量计数，而不能用valueArr的长度判断。
        if (count === len) {
            pro.value = valueArr;
            pro.status = 'fulfilled';
        }
    },
    0);

    return pro;
}
```
这里解释两点：

1、如何保证 value 数组中值的顺序
如果iterable对象中的 promise 对象都变为 fulfilled 状态，或者 iterable 对象内没有 promise 对象，all 返回一个 fulfilled promise 对象，且其 value 值为 iterable 中各项值组成的数组，数组中的值将会按照 iterable 内的顺序排列，而不是由 pending promise 的完成顺序决定。
为了保证 value 数组中值的顺序，最简单的方法是
```
valueArr[iterable.indexOf(val)] = val.value;
```
但是像除 Array、TypedArray 和 String 外的 Map 和 Set 原生 iterabe 对象，以及其它通过myIterable[Symbol.iterator] 创建的自定义的 iterable 对象都没有 indexOf 方法，所以我选择用闭包来保证 value 数组值的顺序。

2、处理 pending promise 对象。
pending promise 是导致这个函数要额外添加很多变量存储状态，额外做很多判断和处理的罪魁祸首。
如果 iterabe 对象中有一个`pending`状态的 promise（通常为一个异步的 promise），我们就使用`then`方法来持续关注它的动态。
- 一旦它变成`fulfilled`promise，就将它的 value 加入 valueArr 数组。我们添加一个 count 变量记录目前 valueArr 获取到了多少个值，当全部获取到值后，就可以给 pro.value 和pro.status 赋值了。之所以用 count 而不是 valueArr.length 判断，是因为 valueArr = [undefined,undefined,undefined,1] 的长度也为4，这样可能导致还没获取到 pending promise 的值就改变 pro.status 了。
- 而当它变成`rejected`promise 时，我们就更新 all 方法返回的对象的 reason 值，同时改变状态 status 为 rejected，触发绑定的`onrejected`函数。另外，为了与原生 Promise 表现相同：如果 iterable 对象中任意一个 pending promise 对象状态变为 `rejected`，将不再持续关注其它 pending promise 的动态。而我早就在所有的 pending promise 上都绑定了 onfulfilled 和 onrejected 函数，用来跟踪它们。所以我需要在某个 pending promise 变为 rejected promise 时，删除它们绑定的回调函数。
### 实例方法`then` ###
Promise.prototype.`then`(onFulfilled, onRejected)：
```
Promise.prototype.then = function(onFulfilled, onRejected) {
    var pro = new Promise();

    //绑定回调函数，onFulfilled 和 onRejected 用一个回调函数处理
    this.events.addEvent('change', hander.bind(null, this));

    function hander(that) {
        var res; //onFulfilled 或 onRejected 回调函数执行后得到的结果
        try {
            if (that.status === 'fulfilled') {
                //如果onFulfilled不是函数，它会在then方法内部被替换成一个 Identity 函数
                typeof onFulfilled !== 'function' ? onFulfilled = identity: false;
                //将参数 this.value 传入 onFulfilled 并执行，将结果赋给 res
                res = onFulfilled.call(null, that.value);
            } else if (that.status === 'rejected') {
                //如果onRejected不是函数，它会在then方法内部被替换成一个 Thrower 函数
                typeof onRejected !== 'function' ? onRejected = thrower: false;

                res = onRejected.call(null, that.reason);
            }
        } catch(err) {
            //抛出一个错误，情况3
            pro.reason = err;
            pro.status = 'rejected';

            return;
        }

        if (res instanceof Promise) {
            if (res.status === 'fulfilled') {            //情况4
                pro.value = res.value;
                pro.status = 'fulfilled';
            } else if (res.status === 'rejected') {      //情况5
                pro.reason = res.reason;
                pro.status = 'rejected';
            } else {                                     //情况6
                //res.status === 'pending'时，pro 跟随 res
                pro.status = 'pending';
                res.then(function(value) {
                    pro.value = value;
                    pro.status = 'fulfilled';
                },
                function(reason) {
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
};
```
我想我已经注释得很清楚了，可以对照我上一篇文章进行阅读。
我再说明一下pending promise 的“跟随”情况，和 all 方法的实现方式差不多，这里也是用 res.`then`来“跟随”的。我相信大家都看得懂代码，下面我举个例子来实践一下：
```
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
	}, 10);	//将这个 delay 参数改为 0 试试
}, 0);
```
看完这个例子，我相信大家都搞懂了`then`的回调函数返回 pending promise 时它会怎么处理了。
另外，这个例子也体现出我用 setTimeout 分发的`macrotask`模拟`microtask`的不足之处了，如果将倒数第二行的的 delay 参数改为 0，那么 fromThen.status === 'pending'，这说明修改它状态的代码在 log 它状态的代码之后执行，至于原因大家自己想一下，这涉及到 event loop。
### 测试 ###
大家可以点下面的链接进行测试：
https://codepen.io/lyl123321/pen/drmKwr?editors=0010

也可以点这里查看源代码：
https://github.com/lyl123321/promisePolyfill/blob/master/src/polyfill.js
