# promisePolyfill
Promise——从阅读文档到简单实现(一)
## 前言 ##
最近几周参加笔试面试，总是会遇到实现异步和处理异步的问题，然而作者每次都无法完美地回答。在最近一次笔试因为 `Promise` 而被刷掉后，我终于下定决心一个个地搞懂它们，就先拿 `Promise` 开刀吧 :)

## 用法解析 ##
ES6 的`Promise`对象是一个代理对象，被代理的值在`Promise`对象创建时可能是未知的，另外它允许你为异步操作的成功和失败分别绑定相应的处理方法。
`Promise` 常用于控制异步操作的执行顺序，而且可以让异步方法像同步方法那样返回值。它不能立即取得异步方法的返回值，但是它可以代理这个值，一旦异步操作完成，就会以及将值传递给相应的处理方法。
一个`Promise`对象有以下几种状态:
- `pending`: 初始状态，既不是成功，也不是失败状态。
- `fulfilled`: 意味着操作成功完成。
- `rejected`: 意味着操作失败。
一个`Promise`对象的状态可以从`pending`变成`fulfilled`，同时传递一个值给相应的`onfulfilled`处理方法；也可以从`pending`变成`rejected`，同时传递一个失败信息给相应的`onrejected`处理方法。
一旦一个`Promise`对象的状态发生改变，就会触发之前通过Promise.prototype.`then`、 Promise.prototype.`catch`和 Promise.prototype.`finally`方法绑定的`onfulfilled`、`onrejected`和`onFinally`处理方法。
因为 `then`、`catch`和`finally`方法都会返回一个新的`Promise`对象， 所以它们可以被链式调用。

![1](https://github.com/lyl123321/promisePolyfill/blob/master/images/image.png)

### 构造函数 ###
构造函数`Promise()`主要用来包装还未支持 promises 的函数。
    new Promise( function(resolve, reject) {...} /* executor */  );
参数：`executor`
`executor`是带有 `resolve` 和 `reject` 两个函数参数的函数。`Promise`构造函数执行时立即调用`executor`函数，换句话说，`executor`函数是在`Promise`构造函数内执行的，所以它是同步代码。在`executor`函数内调用 `resolve` 和 `reject` 函数，可以传递参数给相应的处理方法，并会分别将 `promise` 新建对象的状态改为`fulfilled`（完成）或`rejected`（失败）。
`executor` 内部通常会执行一些异步操作如`ajax`，一旦完成，可以调用`resolve`函数传递参数并将 promise 对象的状态改成 fulfilled，或者在发生错误时调用`reject` 函数传递参数并将 promise 对象的状态改成 rejected。如下：
    function myAsyncFunction(url) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        xhr.onload = () => resolve(xhr.responseText);
        xhr.onerror = () => reject(xhr.statusText);
        xhr.send();
      });
    };
如果在`executor`函数中抛出一个错误，那么该 promise 对象状态将变为`rejected`，并将错误作为参数传递给对应的`onrejected`处理方法。如下：
    function myAsyncFunction(url) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        xhr.onerror = () => {
            throw xhr.statusText;
            //throw xhr.statusText 效果等同于 reject(xhr.statusText)
        };
        xhr.send();
      });
    };
### 静态方法 ###
静态方法是定义在构造函数上的方法，声明静态方法：
    Func.fn = function() {}
调用静态方法：
    Func.fn(args);
`ES6`中的`Promise`构造函数有4个静态方法：
- Promise.`resolve`(value)
- Promise.`reject`(reason)
- Promise.`all`(iterable)
- Promise.`race`(iterable)
Promise.`resolve`(value)：
返回一个由参数`value`解析而来的`Promise`对象。
如果`value`是一个`thenable`对象（带有 then 方法的对象），返回的`Promise`对象会跟随这个`thenable`对象，状态随之变化；如果传入的`value`本身就是`Promise`对象，则直接返回`value`；其它情况下返回的`Promise`对象状态为`fulfilled`，并且将该`value`作为参数传递给`onfulfilled`处理方法。
通常而言，如果你不知道一个值是否为`Promise`对象，就可以使用 Promise.resolve(value) 来将`value`以`Promise`对象的形式使用。

```
    // resolve一个thenable对象
    var p1 = Promise.resolve({ 
      then: function(onFulfill, onReject) { onFulfill("fulfilled!"); }
    });
    console.log(p1 instanceof Promise) // true, 这是一个Promise对象
    
    p1.then(function(v) {
        console.log(v); // 输出"fulfilled!"
      }, function(e) {
        // 不会被调用
    });
```
Promise.`reject`(reason)：
返回一个被给定原因`reason`拒绝的`Promise`对象。
返回的`Promise`对象的`status`状态属性为`rejected`，`reason`拒绝原因属性（传递给`onrejected`处理方法的 reason 参数）与参数`reason`相等。

```
Promise.reject(new Promise((resolve, reject) => resolve('done')))
.then(function(reason) {
  	// 未被调用
}, function(reason) {
  	console.log(reason); // new Promise
});
```
Promise.`all`(iterable)：
参数：`iterable`对象为`Array`对象、`Map`对象和`Set`对象等可迭代对象。
返回一个`Promise`对象。
如果`iterable`对象为空，Promise.`all`会同步地返回一个状态为`fulfilled`的 promise 对象。
如果`iterable`对象中的 promise 对象都变为`fulfilled`状态，或者`iterable`对象内没有 promise 对象，Promise.`all`返回的 promise 对象将异步地变为`fulfilled`状态。
以上两种情况返回的都是`fulfilled`状态的 promise 对象，其`value`值(传递给`onfulfilled`处理方法的 value 参数)都是一个数组，这个数组包含`iterable`对象中所有的基本值和 promise 对象`value`值。
如果`iterable`对象中任意一个 promise 对象状态变为`rejected`，那么Promise.`all`就会异步地返回一个状态为`rejected`的 promise 对象，而且此 promise 对象的`reason`值（传递给`onrejected`处理方法的 reason 参数），等于`iterable`对象中状态为`rejected`的那一个 promise 对象的`reason`值。
    // this will be counted as if the iterable passed is empty, so it gets fulfilled
    var p = Promise.all([1,2,3]);
    // this will be counted as if the iterable passed contains only the resolved promise with value "444", so it gets fulfilled
    var p2 = Promise.all([1,2,3, Promise.resolve(444)]);
    // this will be counted as if the iterable passed contains only the rejected promise with value "555", so it gets rejected
    var p3 = Promise.all([1,2,3, Promise.reject(555)]);
    
    // using setTimeout we can execute code after the stack is empty
    setTimeout(function(){
        console.log(p);
        console.log(p2);
        console.log(p3);
    });
    
    // logs
    // Promise { <state>: "fulfilled", <value>: Array[3] }
    // Promise { <state>: "fulfilled", <value>: Array[4] }
    // Promise { <state>: "rejected", <reason>: 555 }

Promise.`race`(iterable)：
返回一个`Promise`对象。
一旦`iterable`中的某个 promise 对象完成或拒绝，返回的 promise 对象就会完成或拒绝，且返回的 promise 对象的`value`值（完成时）或`reason`值（拒绝时）和这个 promise 对象的`value`值（完成时）或`reason`值（拒绝时）相等。
    var promise1 = new Promise(function(resolve, reject) {
        setTimeout(resolve, 500, 'one');
    }), promise2 = new Promise(function(resolve, reject) {
        setTimeout(resolve, 100, 'two');
    });
    
    Promise.race([promise1, promise2]).then(function(value) {
      console.log(value);
      // Both resolve, but promise2 is faster
    });
    // expected output: "two"

### 实例方法 ###
实例方法是定义在原型对象上的方法，声明实例方法：
    Func.prototype.fn = function() {}
调用实例方法需要先创建一个实例：
    let func = new Func();
    func.fn(args);
`Promise`的原型对象上有3个实例方法：
- Promise.prototype.`then`(`onFulfilled`, `onRejected`)
- Promise.prototype.`catch`(`onRejected`)
- Promise.prototype.`finally`(`onFinally`)

Promise.prototype.`then`(`onFulfilled`, `onRejected`)：
`then`方法接收成功和失败两种情况的回调函数作为参数，返回一个`Promise`对象。
参数：`onFulfilled`和`onRejected`回调函数
`onFulfilled`：当 promise 对象变成 fulfilled 状态时被调用。`onFulfilled`函数有一个参数，即 promise 对象完成时的 `value` 值。如果`onFulfilled`不是函数，它会在`then`方法内部被替换成一个`Identity`函数，即 (x) => (x) 。
`onRejected`：当 promise 对象变成 rejected 状态时被调用。`onRejected`函数有一个参数，即 promise 对象失败时的 `reason` 值。如果`onRejected`不是函数，它会在`then`方法内部被替换成一个`Thrower`函数，即 (reason) => {throw reason} 。
返回：一旦调用`then`方法的 promise 对象被完成或拒绝，将异步调用相应的处理函数(`onFulfilled`或`onRejected`)，即将处理函数加入`microtask`队列中。如果`onFulfilled`或`onRejected`回调函数：
- 返回一个值，则`then`返回的 promise 对象的`status`变为`fulfilled`，`value`变为回调函数的返回值；
- 不返回任何内容，则`then`返回的 promise 对象的`status`变为`fulfilled`，`value`变为`undefined`；
- 抛出一个错误，则`then`返回的 promise 对象的`status`变为`rejected`，`reason`变为回调函数抛出的错误;
- 返回一个状态为`fulfilled`的 promise 对象，则`then`返回的 promise 对象的`status`变为`fulfilled`，`value`等于回调函数返回的 promise 对象的`value`值；
- 返回一个状态为`rejected`的 promise 对象，则`then`返回的 promise 对象的`status`变为`rejected`，`reason`等于回调函数返回的 promise 对象的`reason`值；
- 返回一个状态为`pending`的 promise 对象，则`then`返回的 promise 对象的`status`变为`pending`，且其`status`将随着回调函数返回的 promise 对象的`status`变化而变化，之后其`value`或`reason`值也会和此 promise 对象的`value`或`reason`值相同。
这里提一下，这个地方看 MDN 文档中文翻译实在看不懂，之后看英文原文反而稍微理解了，希望之后在实现 Promise 的过程中能理解更深。

```
    var fromCallback;
    
    var fromThen = Promise.resolve('done')
    .then(function() {
    	fromCallback = new Promise(function(){});
    	return fromCallback;
    });
    
    setTimeout(function() {
    	console.log(fromCallback);	//fromCallback.status === 'pending'
    	console.log(fromThen);		//fromThen.status === 'pending'
    	console.log(fromCallback === fromThen);	//false
    }, 0);
```
Promise.prototype.`catch`(`onRejected`)：
`catch`方法接收失败情况的回调函数作为参数，返回一个`Promise`对象。
参数：`onRejected`回调函数，表现同`then`中的`onRejected`参数。
返回：promiseObj.catch(onRejected) 与 promiseObj.then(undefined, onRejected) 返回值相同。

```
    Promise.resolve()
      .then( () => {
        // 返回一个 rejected promise
        throw 'Oh no!';
      })
      .catch( reason => {
        console.error( 'onRejected function called: ', reason );
      })
      .then( () => {
        console.log( "I am always called even if the prior then's promise rejects" );
      });
```
Promise.prototype.`finally`(`onFinally`)：
`finally`方法接收`onFinally`回调函数作为参数，返回一个`Promise`对象。
如果你想在 promise 执行完毕后，无论其结果是成功还是失败，都做一些相同的处理时，可以使用`finally`方法。
参数：`onFinally`回调函数
`onFinally`不接收任何参数，当 promise 对象变成 settled (fulfilled / rejected) 状态时`onFinally`被调用。
返回：如果`onFinally`回调函数
- 不返回任何内容或者返回一个值或者返回一个状态为`fulfilled`的 promise 对象，则`finally`返回的 promise 对象的`status`、`value`和`reason`值与调用这个`finally`方法的 promise 对象的值相同；
- 抛出一个错误或者返回一个状态为`rejected`的 promise 对象，则`finally`返回的 promise 对象的`status`值变为`rejected`，`reason`值变为被抛出的错误或者回调函数返回的 promise 对象的`reason`值；
- 返回一个状态为`pending`的 promise 对象，则`finally`返回的 promise 对象的`status`值变为`pending`，且其`status`值将随着回调函数返回的 promise 对象的`status`值变化而变化，之后其`value`或`reason`值也会和此 promise 对象的`value`或`reason`值相同。

```
Promise.reject('是我，开心吗').finally(function() {
	var pro = new Promise(function(r){r('你得不到我')});    //pro.status === 'fulfilled'
	return pro;    //`onFinally`回调函数返回一个状态为`fulfilled`的 promise 对象
}).catch(function(reason) {
	console.log(reason);
});
```
## 结语 ##
将 MDN 文档整理了一下，加入了一些自己的理解，也花费了一天的时间。现在`Promise`各个方法的参数、返回值、功能和使用方法已经有个大概的了解了，为了进一步理解其原理，接下来我打算简单地实现一下它。
