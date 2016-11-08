function createFunctions(Reflux, PromiseFactory, catchHandler) {
  const _ = Reflux.utils;

    /**
     * Returns a Promise for the triggered action
     *
     * @return {Promise}
     *   Resolved by completed child action.
     *   Rejected by failed child action.
     *   If listenAndPromise'd, then promise associated to this trigger.
     *   Otherwise, the promise is for next child action completion.
     */
  function triggerPromise(...triggerArgs) {
    const canHandlePromise =
            this.children.indexOf('completed') >= 0 &&
            this.children.indexOf('failed') >= 0;

    const createdPromise = new PromiseFactory((resolve, reject) => {
            // If `listenAndPromise` is listening
            // patch `promise` w/ context-loaded resolve/reject
      if (this.willCallPromise) {
        _.nextTick(() => {
          const previousPromise = this.promise;
          this.promise = (inputPromise, ...promiseArgs) => {
            inputPromise.then(resolve, reject);
                        // Back to your regularly schedule programming.
            this.promise = previousPromise;
            return this.promise(inputPromise, ...promiseArgs);
          };
          this.trigger(...triggerArgs);
        });

        return;
      }

      if (canHandlePromise) {
        const removeSuccess = this.completed.listen((...args) => {
          removeSuccess();
          removeFailed();
          resolve(args.length > 1 ? args : args[0]);
        });

        const removeFailed = this.failed.listen((...args) => {
          removeSuccess();
          removeFailed();
          reject(args.length > 1 ? args : args[0]);
        });
      }

      _.nextTick(() => this.trigger(...triggerArgs));

      if (!canHandlePromise) {
        resolve();
      }
    });

        // Attach promise catch handler if provided
    if (typeof (catchHandler) === 'function') {
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
    const canHandlePromise =
            this.children.indexOf('completed') >= 0 &&
            this.children.indexOf('failed') >= 0;

    if (!canHandlePromise) {
      throw new Error('Publisher must have "completed" and "failed" child publishers');
    }

    p.then(response => this.completed(response), error => this.failed(error));
  }

    /**
     * Subscribes the given callback for action triggered, which should
     * return a promise that in turn is passed to `this.promise`
     *
     * @param {Function} callback The callback to register as event handler
     */
  function listenAndPromise(callback, bindContext) {
    bindContext = bindContext || this;
    this.willCallPromise = (this.willCallPromise || 0) + 1;

    const removeListen = this.listen((...args) => {
      if (!callback) {
        throw new Error(`Expected a function returning a promise but got ${callback}`);
      }

      const returnedPromise = callback.apply(bindContext, args);
      return this.promise.call(this, returnedPromise);
    }, bindContext);

    return function() {
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
export default function(promiseFactory, catchHandler) {
  return function(Reflux) {
    const { triggerPromise, promise, listenAndPromise } = createFunctions(Reflux, promiseFactory, catchHandler);
    Reflux.PublisherMethods.triggerAsync = triggerPromise;
    Reflux.PublisherMethods.promise = promise;
    Reflux.PublisherMethods.listenAndPromise = listenAndPromise;
  };
}
