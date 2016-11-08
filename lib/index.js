'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.default = function (promiseFactory, catchHandler) {
  return function (Reflux) {
    var _createFunctions = createFunctions(Reflux, promiseFactory, catchHandler),
        triggerPromise = _createFunctions.triggerPromise,
        promise = _createFunctions.promise,
        listenAndPromise = _createFunctions.listenAndPromise;

    Reflux.PublisherMethods.triggerAsync = triggerPromise;
    Reflux.PublisherMethods.promise = promise;
    Reflux.PublisherMethods.listenAndPromise = listenAndPromise;
  };
};

function createFunctions(Reflux, PromiseFactory, catchHandler) {
  /**
   * Returns a Promise for the triggered action
   *
   * @return {Promise}
   *   Resolved by completed child action.
   *   Rejected by failed child action.
   *   If listenAndPromise'd, then promise associated to this trigger.
   *   Otherwise, the promise is for next child action completion.
   */
  function triggerPromise() {
    var _this = this;

    for (var _len = arguments.length, triggerArgs = Array(_len), _key = 0; _key < _len; _key++) {
      triggerArgs[_key] = arguments[_key];
    }

    var canHandlePromise = this.children.indexOf('completed') >= 0 && this.children.indexOf('failed') >= 0;

    var createdPromise = new PromiseFactory(function (resolve, reject) {
      // If `listenAndPromise` is listening
      // patch `promise` w/ context-loaded resolve/reject
      if (_this.willCallPromise) {
        var _ret = function () {
          var previousPromise = _this.promise;
          _this.promise = function (inputPromise) {
            for (var _len2 = arguments.length, promiseArgs = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
              promiseArgs[_key2 - 1] = arguments[_key2];
            }

            inputPromise.then(resolve, reject);
            // Back to your regularly schedule programming.
            _this.promise = previousPromise;
            return _this.promise.apply(_this, [inputPromise].concat(promiseArgs));
          };
          _this.trigger.apply(_this, triggerArgs);

          return {
            v: void 0
          };
        }();

        if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
      }

      if (canHandlePromise) {
        (function () {
          var unsubscribes = [];
          var unsubscribe = function unsubscribe() {
            return unsubscribes.forEach(function (unsub) {
              return unsub();
            });
          };
          unsubscribes.push(_this.completed.listen(function () {
            for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
              args[_key3] = arguments[_key3];
            }

            unsubscribe();
            resolve(args.length > 1 ? args : args[0]);
          }));

          unsubscribes.push(_this.failed.listen(function () {
            for (var _len4 = arguments.length, args = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
              args[_key4] = arguments[_key4];
            }

            unsubscribe();
            reject(args.length > 1 ? args : args[0]);
          }));
        })();
      }

      _this.trigger.apply(_this, triggerArgs);

      if (!canHandlePromise) {
        resolve();
      }
    });

    // Attach promise catch handler if provided
    if (typeof catchHandler === 'function') {
      createdPromise.catch(catchHandler);
    }

    return createdPromise;
  }

  /**
   * Attach handlers to promise that trigger the completed and failed
   * child publishers, if available.
   *
   * @param {Object} p The promise to attach to
   */
  function promise(p) {
    var _this2 = this;

    var canHandlePromise = this.children.indexOf('completed') >= 0 && this.children.indexOf('failed') >= 0;

    if (!canHandlePromise) {
      throw new Error('Publisher must have "completed" and "failed" child publishers');
    }

    p.then(function (response) {
      return _this2.completed(response);
    }, function (error) {
      return _this2.failed(error);
    });
  }

  /**
   * Subscribes the given callback for action triggered, which should
   * return a promise that in turn is passed to `this.promise`
   *
   * @param {Function} callback The callback to register as event handler
   */
  function listenAndPromise(callback, bindContext) {
    var _this3 = this;

    bindContext = bindContext || this;
    this.willCallPromise = (this.willCallPromise || 0) + 1;

    var removeListen = this.listen(function () {
      for (var _len5 = arguments.length, args = Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
        args[_key5] = arguments[_key5];
      }

      if (!callback) {
        throw new Error('Expected a function returning a promise but got ' + callback);
      }

      var returnedPromise = callback.apply(bindContext, args);
      return _this3.promise.call(_this3, returnedPromise);
    }, bindContext);

    return function () {
      this.willCallPromise--;
      removeListen.call(this);
    };
  }

  return {
    triggerPromise: triggerPromise,
    promise: promise,
    listenAndPromise: listenAndPromise
  };
}

/**
 * Sets up reflux with Promise functionality
 */