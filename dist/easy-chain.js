(function (global) {

    //==================================================================
    // Utilities

    var isFunction = function (value) {
            return typeof value === 'function';
        },

        isArray = function (value) {
            return Object.prototype.toString.call(value) === '[object Array]';
        },

        isNumber = function (value) {
            return typeof value === 'number';
        },

        isObject = function (value) {
            var type = typeof value;
            return type === 'function' || type === "object" && !!value;
        },

        bind = function (func, context) {
            return function () {
                return func.apply(context, arguments);
            }
        },

        forEach = function (array, callback) {
            for (var i = 0; i < array.length; i++) {
                callback(array[i], i);
            }
        },

        filter = function (array, callback) {
            var newArray = [], value;
            for (var i = 0; i < array.length; i++) {
                value = array[i];
                if (callback(value, i)) {
                    newArray.push(value);
                }
            }
            return newArray;
        },

        reject = function (array, callback) {
            return filter(array, function (value, index) {
                return !callback(value, index);
            });
        },

        countTrue = function (array) {
            var counter = 0;
            forEach(array, function (value) {
                if (!!value) {
                    counter++;
                }
            });
            return counter;
        },

        isJQueryDeferred = jQuery ? function (value) {
            var thenString = String(jQuery.Deferred().then).substring(10, 20);
            if (!isObject(value) || !isFunction(value.then)) {
                return false;
            }
            return thenString === String(value.then).substring(10, 20);
        } : function () {
            return false;
        };

    //==================================================================
    // Event

    function Event(type, target, extra) {
        this.type = type;
        this.target = target;
        for (var i in extra) {
            if (extra.hasOwnProperty(i)) {
                this[i] = extra[i];
            }
        }
    }

    //==================================================================
    // EventListener

    function EventListener(callback, context) {
        this.callback = callback;
        this.context = context;
    }

    //==================================================================
    // Queue

    function Queue(type, callbacks) {
        this.type = type;
        this.callbacks = callbacks;
        this.nextHasBeenCalled = false;
        this.eventValues = callbacks ? new Array(callbacks.length) : [];
        this.onComplete = null;
    }

    Queue.prototype._attemptToGoToNext = function (callbackIndex) {
        return bind(function () {
            if (this.type === Queue.WAIT) {
                this.eventValues = arguments[0];
            } else if (this.type === Queue.SINGLE) {
                this.eventValues = Array.prototype.slice.call(arguments);
            } else {
                this.eventValues[callbackIndex] = Array.prototype.slice.call(arguments);
            }

            if (!this.nextHasBeenCalled
                && (this.type === Queue.SINGLE || this.type === Queue.WAIT || this.type === Queue.FIRST
                || (this.type === Queue.ALL && countTrue(this.eventValues) === this.callbacks.length)
                )
            ) {
                this.nextHasBeenCalled = true;
                this.onComplete();
            }
        }, this);
    };

    Queue.prototype.run = function (options) {
        this.onComplete = options.onComplete;
        forEach(this.callbacks, bind(function (callback, callbackIndex) {
            var returnedValue;
            if (isFunction(callback)) {
                returnedValue = callback(this._attemptToGoToNext(callbackIndex), options.prevEventValues);
                if (isJQueryDeferred(returnedValue)) {
                    returnedValue.done(this._attemptToGoToNext(callbackIndex), options.prevEventValues);
                }
            } else if (isJQueryDeferred(callback)) {
                callback.done(this._attemptToGoToNext(callbackIndex), options.prevEventValues);
            } else if (callback instanceof EasyChain) {
                callback._runQueues(0, {
                    onComplete: this._attemptToGoToNext(callbackIndex)
                });
            }
        }, this));
    };

    Queue.ALL = 'all';
    Queue.FIRST = 'first';
    Queue.SINGLE = 'single';
    Queue.WAIT = 'wait';


    //==================================================================
    // PromiseChain

    function EasyChain() {
        this._queues = [];
        this._eventListeners = {};
        this._eventListeners[EasyChain.COMPLETE] = [];
        this._eventListeners[EasyChain.TIMEOUT_ERROR] = [];
        this._eventListeners[EasyChain.PROGRESS] = [];
        this._timeout = null;
    }

    // - - - - - - - - - - - - - - - - - - -
    // Private Methods

    EasyChain.prototype._fireEvent = function (name) {
        var args = arguments.length > 0 ? Array.prototype.slice.call(arguments, 1) : [];
        forEach(this._eventListeners[name], function (eventListener) {
            eventListener.callback.apply(eventListener.context || {}, args);
        });
        return this;
    };

    EasyChain.prototype._runQueues = function (index, options) {
        var queue = this._queues[index],
            prevQueue = this._queues[index - 1],
            timeoutId;

        if (queue) {
            timeoutId = setTimeout(bind(function () {
                this._fireEvent(
                    EasyChain.TIMEOUT_ERROR,
                    new Event(EasyChain.TIMEOUT_ERROR, this, {
                        values: queue.eventValues,
                        queueType: queue.type,
                        index: index
                    })
                );
            }, this), (this._timeout || EasyChain.TIMEOUT_MSEC));

            queue.run({
                onComplete: bind(function () {
                    clearTimeout(timeoutId);
                    this._fireEvent(
                        EasyChain.PROGRESS,
                        new Event(EasyChain.PROGRESS, this, {
                            values: queue.eventValues,
                            queueType: queue.type,
                            index: index
                        })
                    );
                    this._runQueues(index + 1, options);
                }, this),
                prevEventValues: prevQueue ? prevQueue.eventValues : undefined
            });
        } else if (isFunction(options.onComplete)) {
            options.onComplete();
        }
    };

    // - - - - - - - - - - - - - - - - - - -
    // Public Methods

    EasyChain.prototype.single = function (callback) {
        if (isFunction(callback)) {
            this._queues.push(new Queue(Queue.SINGLE, [callback]));
        } else {
            throw new TypeError("single() takes only function.");
        }
        return this;
    };

    EasyChain.prototype.all = function () {
        var callbacks = isArray(arguments[0]) ? arguments[0] : Array.prototype.slice.call(arguments);
        this._queues.push(new Queue(Queue.ALL, callbacks));
        return this;
    };

    EasyChain.prototype.first = function () {
        var callbacks = isArray(arguments[0]) ? arguments[0] : Array.prototype.slice.call(arguments);
        this._queues.push(new Queue(Queue.FIRST, callbacks));
        return this;
    };

    EasyChain.prototype.wait = function (msec) {
        if (isNumber(msec)) {
            this._queues.push(new Queue(Queue.WAIT, [function (next) {
                setTimeout(function () {
                    next(msec);
                }, msec);
            }]));
        } else {
            throw new TypeError("wait() takes only number.");
        }
        return this;
    };

    EasyChain.prototype.run = function () {
        this._runQueues(0, {
            onComplete: bind(function () {
                this._fireEvent(
                    EasyChain.COMPLETE,
                    new Event(EasyChain.COMPLETE, this, {
                        type: EasyChain.COMPLETE,
                        length: this._queues.length
                    })
                );
            }, this)
        });
        return this;
    };

    EasyChain.prototype.empty = function () {
        this._queues = [];
        return this;
    };

    EasyChain.prototype.on = function (name, callback, context) {
        if (this._eventListeners[name]) {
            this._eventListeners[name].push(new EventListener(callback, context));
        }
        return this;
    };

    EasyChain.prototype.off = function (name, callback, context) {
        if (this._eventListeners[name]) {
            if (callback) {
                this._eventListeners[name] = reject(this._eventListeners[name], function (listener) {
                    return listener.callback === callback;
                });
            }
            if (context) {
                this._eventListeners[name] = reject(this._eventListeners[name], function (listener) {
                    return listener.context === context;
                });
            }
            if (!callback && !context) {
                this._eventListeners[name] = [];
            }
        }
        return this;
    };

    EasyChain.prototype.setTimeout = function (msec) {
        this._timeout = msec;
        return this;
    };

    // - - - - - - - - - - - - - - - - - - -
    // Public Static Methods

    EasyChain.wait = function (msec) {
        var instance = new EasyChain();
        return instance.wait(msec);
    };

    EasyChain.single = function (callback) {
        var instance = new EasyChain();
        return instance.single(callback);
    };

    EasyChain.all = function () {
        var instance = new EasyChain();
        return instance.all.apply(instance, arguments);
    };

    EasyChain.first = function () {
        var instance = new EasyChain();
        return instance.first.apply(instance, arguments);
    };

    EasyChain.TIMEOUT_MSEC = 5000;
    EasyChain.COMPLETE = 'complete';
    EasyChain.PROGRESS = 'progress';
    EasyChain.TIMEOUT_ERROR = 'timeout-error';

    global.EasyChain = EasyChain;

}(this));