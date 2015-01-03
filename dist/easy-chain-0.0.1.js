(function (global) {

    //==================================================================
    // Utilities

    var isFunction = function (value) {
            return typeof value === 'function';
        },

        isArray = function (value) {
            return Object.prototype.toString.call(value) === '[object Array]';
        },

        isObject = function (value) {
            var type = typeof value;
            return type === 'function' || type === "object" && !!value;
        },

        arrayfy = function (_arguments) {
            return _arguments.length > 0 ? Array.prototype.slice.call(_arguments) : [];
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

        map = function (array, callback) {
            var newArray = [], value;
            for (var i = 0; i < array.length; i++) {
                value = array[i];
                newArray.push(callback(value, i));
            }
            return newArray;
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
    // Promise

    function Promise(deferred) {
        this._deferred = deferred;
    }

    Promise.prototype.done = function (callback) {
        this._deferred.done(callback);
        return this;
    };

    Promise.prototype.fail = function (callback) {
        this._deferred.fail(callback);
        return this;
    };

    //==================================================================
    // Deferred

    function Deferred() {
        this._doneCallbacks = [];
        this._failCallbacks = [];
        this._status = null;
        this._arguments = null;
    }

    // - - - - - - - - - - - - - - - - - - -
    // Public Static Methods

    Deferred.prototype.resolve = function () {
        if (!this._status) {
            this._status = "resolved";
            this._arguments = arrayfy(arguments);
            forEach(this._doneCallbacks, bind(function (callback) {
                callback.apply(null, this._arguments);
            }, this));
        }
        return this;
    };

    Deferred.prototype.reject = function () {
        if (!this._status) {
            this._status = "rejected";
            this._arguments = arrayfy(arguments);
            forEach(this._failCallbacks, bind(function (callback) {
                callback.apply(null, this._arguments);
            }, this));
        }
        return this;
    };

    Deferred.prototype.done = function (callback) {
        this._doneCallbacks.push(callback);
        if (this._status === "resolved") {
            callback.apply(null, this._arguments);
        }
        return this;
    };

    Deferred.prototype.fail = function (callback) {
        this._failCallbacks.push(callback);
        if (this._status === "rejected") {
            callback.apply(null, this._arguments);
        }
        return this;
    };

    Deferred.prototype.promise = function () {
        return new Promise(this);
    };

    Deferred.whenAllDone = function (deferreds) {
        var _deferred = new Deferred(),
            counter = 0,
            total = deferreds.length;
        forEach(deferreds, function (deferred) {
            deferred.done(function () {
                counter++;
                if (counter === total) {
                    _deferred.resolve();
                }
            })
        });
        return _deferred.promise();
    };

    Deferred.whenAnyDone = function (deferreds) {
        var _deferred = new Deferred();
        forEach(deferreds, function (deferred) {
            deferred.done(function () {
                _deferred.resolve();
            })
        });
        return _deferred.promise();
    };

    //==================================================================
    // Queue Item

    function QueueItem(callback) {
        this.callback = callback;
        this.deferred = new Deferred();
        this.value = undefined;

        this.deferred.done(bind(function (value) {
            this.value = value;
        }, this));
    }

    //==================================================================
    // Queue

    function Queue(type, callbacks, timeout) {
        this._initialize(type, callbacks, timeout);
    }

    // - - - - - - - - - - - - - - - - - - -
    // Private Methods

    Queue.prototype._initialize = function (type, callbacks, timeout) {
        this.type = type;
        this.deferred = new Deferred();
        this.timeout = timeout;
        this.timeoutId = null;
        this.queueItems = null;
        this.waitTime = null;

        if (this.type === Queue.Types.SINGLE
            || this.type === Queue.Types.ALL) {
            this.queueItems = map(callbacks, function (callback) {
                return new QueueItem(callback);
            });
            Deferred
                .whenAllDone(map(this.queueItems, function (queueItem) {
                    return queueItem.deferred.promise();
                }))
                .done(bind(function () {
                    this._clearTimeout();
                    this.deferred.resolve();
                }, this));
        } else if (this.type === Queue.Types.ANY) {
            this.queueItems = map(callbacks, function (callback) {
                return new QueueItem(callback);
            });
            Deferred
                .whenAnyDone(map(this.queueItems, function (queueItem) {
                    return queueItem.deferred.promise();
                }))
                .done(bind(function () {
                    this._clearTimeout();
                    this.deferred.resolve();
                }, this));
        } else if (this.type === Queue.Types.WAIT) {
            this.waitTime = callbacks;
            this.queueItems = [new QueueItem(bind(function () {
                setTimeout(bind(function () {
                    this.deferred.resolve();
                }, this), this.waitTime);
            }, this))];
        }
    };

    Queue.prototype._runQueueItems = function (options) {
        options = options || {};

        forEach(this.queueItems, bind(function (queueItem) {
            var returnedValue;
            if (isFunction(queueItem.callback)) {
                returnedValue = queueItem.callback(function () {
                    queueItem.deferred.resolve(arrayfy(arguments));
                }, options.prevQueue);
                if (isJQueryDeferred(returnedValue)) {
                    returnedValue.done(function () {
                        queueItem.deferred.resolve(arrayfy(arguments));
                    });
                }
            } else if (isJQueryDeferred(queueItem.callback)) {
                queueItem.callback.done(function () {
                    queueItem.deferred.resolve(arrayfy(arguments));
                });
            } else if (queueItem.callback instanceof EasyChain) {
                queueItem.callback._runQueuesFrom(0).done(function (queues) {
                    if (queues.length < 2) {
                        queueItem.deferred.resolve(queues[0]);
                    } else {
                        queueItem.deferred.resolve(queues);
                    }
                });
            }
        }, this));
    };

    Queue.prototype._setTimeout = function () {
        this.timeoutId = setTimeout(bind(function () {
            this.deferred.reject();
        }, this), (this.timeout || Queue.TIMEOUT));
    };

    Queue.prototype._clearTimeout = function () {
        clearTimeout(this.timeoutId);
    };

    // - - - - - - - - - - - - - - - - - - -
    // Public Methods

    Queue.prototype.run = function (options) {
        this._runQueueItems(options);
        this._setTimeout();
        return this.deferred.promise();
    };

    Queue.prototype.getType = function () {
        return this.type;
    };

    Queue.prototype.getValues = function () {
        if (this.type === Queue.Types.ALL
            || this.type === Queue.Types.ANY) {
            return map(this.queueItems, function (queueItem) {
                return queueItem.value;
            });
        } else if (this.type === Queue.Types.SINGLE) {
            return this.queueItems[0].value;
        } else if (this.type === Queue.Types.WAIT) {
            return this.waitTime;
        }
    };

    Queue.prototype.getStatus = function () {
        return this.deferred._status;
    };

    // - - - - - - - - - - - - - - - - - - -
    // Public Static Methods

    Queue.createSingleType = function (callbacks, timeout) {
        callbacks = isArray(callbacks) ? callbacks : [callbacks];
        return new Queue(Queue.Types.SINGLE, callbacks, timeout);
    };

    Queue.createAllType = function (callbacks, timeout) {
        callbacks = isArray(callbacks) ? callbacks : [callbacks];
        return new Queue(Queue.Types.ALL, callbacks, timeout);
    };

    Queue.createAnyType = function (callbacks, timeout) {
        callbacks = isArray(callbacks) ? callbacks : [callbacks];
        return new Queue(Queue.Types.ANY, callbacks, timeout);
    };

    Queue.createWaitType = function (msec) {
        return new Queue(Queue.Types.WAIT, msec);
    };

    Queue.TIMEOUT = 5000;
    Queue.Types = {
        SINGLE: 'single',
        ALL: 'all',
        ANY: 'any',
        WAIT: 'wait'
    };
    Queue.Events = {
        TIMEOUT: 'timeout'
    };

    //==================================================================
    // PromiseChain

    function EasyChain() {
        this._queues = [];
        this._eventListeners = {};
        this._eventListeners[EasyChain.Events.COMPLETE] = [];
        this._eventListeners[EasyChain.Events.TIMEOUT] = [];
        this._eventListeners[EasyChain.Events.PROGRESS] = [];
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

    EasyChain.prototype._runQueuesFrom = function (index) {
        var queue = this._queues[index],
            prevQueue = this._queues[index - 1],
            runOption = prevQueue ? {
                prevQueue: prevQueue
            } : {},
            deferred = new Deferred();

        if (queue) {
            queue
                .run(runOption)
                .done(bind(function () {
                    this._fireEvent(
                        EasyChain.Events.PROGRESS,
                        new Event(EasyChain.Events.PROGRESS, this, {
                            queue: queue,
                            index: index
                        })
                    );
                    this._runQueuesFrom(index + 1).done(bind(function (queues) {
                        queues.unshift(queue);
                        deferred.resolve(queues);
                    }, this));
                }, this))
                .fail(bind(function () {
                    this._fireEvent(
                        EasyChain.Events.TIMEOUT,
                        new Event(EasyChain.Events.TIMEOUT, this, {
                            queue: queue,
                            index: index
                        })
                    );
                }, this));
        } else {
            deferred.resolve([]);
        }

        return deferred.promise();
    };

    EasyChain.prototype._on = function (name, callback, context) {
        if (this._eventListeners[name]) {
            this._eventListeners[name].push(new EventListener(callback, context));
        }
        return this;
    };

    EasyChain.prototype._off = function (name, callback, context) {
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

    // - - - - - - - - - - - - - - - - - - -
    // Public Methods

    EasyChain.prototype.do = function (callback, timeout) {
        this._queues.push(Queue.createSingleType(callback, timeout));
        return this;
    };

    EasyChain.prototype.doAll = function (callbacks, timeout) {
        this._queues.push(Queue.createAllType(callbacks, timeout));
        return this;
    };

    EasyChain.prototype.doAny = function (callbacks, timeout) {
        this._queues.push(Queue.createAnyType(callbacks, timeout));
        return this;
    };

    EasyChain.prototype.wait = function (msec) {
        this._queues.push(Queue.createWaitType(msec));
        return this;
    };

    EasyChain.prototype.run = function () {
        return this._runQueuesFrom(0)
            .done(bind(function () {
                this._fireEvent(
                    EasyChain.Events.COMPLETE,
                    new Event(EasyChain.Events.COMPLETE, this, {
                        type: EasyChain.Events.COMPLETE,
                        length: this._queues.length
                    })
                );
            }, this));
    };

    EasyChain.prototype.empty = function () {
        this._queues = [];
        return this;
    };

    EasyChain.prototype.on = function (name, callback, context) {
        return this._on(name, callback, context);
    };

    EasyChain.prototype.off = function (name, callback, context) {
        return this._off(name, callback, context);
    };

    // - - - - - - - - - - - - - - - - - - -
    // Public Static Methods

    EasyChain.wait = function (msec) {
        var instance = new EasyChain();
        return instance.wait(msec);
    };

    EasyChain.do = function (callback) {
        var instance = new EasyChain();
        return instance.do(callback);
    };

    EasyChain.doAll = function () {
        var instance = new EasyChain();
        return instance.doAll.apply(instance, arguments);
    };

    EasyChain.doAny = function () {
        var instance = new EasyChain();
        return instance.doAny.apply(instance, arguments);
    };

    EasyChain.Events = {
        COMPLETE: 'complete',
        PROGRESS: 'progress',
        TIMEOUT: 'timeout'
    };

    global.EasyChain = EasyChain;
    global.EasyChain.Deferred = Deferred;
    global.EasyChain.Queue = Queue;

}(this));