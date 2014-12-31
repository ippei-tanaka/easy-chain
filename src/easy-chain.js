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

        arrayfy = function (_arguments) {
            return _arguments.length > 0 ? Array.prototype.slice.call(_arguments) : [];
        },

        createObject = (function () {
            function F() {
            }

            return function (o) {
                F.prototype = o;
                return new F()
            };
        })(),

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
        this._status = '';
        this._arguments = null;
    }

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

        this.deferred.done(bind(function () {
            this.value = arrayfy(arguments);
        }, this));
    }

    //==================================================================
    // Queue

    function Queue(type, timeout, callbacks) {
        this.type = type;
        this.queueItems = map(callbacks, function (callback) {
            return new QueueItem(callback);
        });
        this.deferred = new Deferred();
        this.timeout = timeout;
        this.timeoutId = null;
        this._initialize();
    }

    Queue.prototype._initialize = function () {
        var deferred;
        if (this.type === Queue.SINGLE
            || this.type === Queue.ALL
            || this.type === Queue.WAIT) {
            deferred = Deferred.whenAllDone(map(this.queueItems, function (queueItem) {
                return queueItem.deferred.promise();
            }));
        } else if (this.type === Queue.FIRST) {
            deferred = Deferred.whenAnyDone(map(this.queueItems, function (queueItem) {
                return queueItem.deferred.promise();
            }));
        }
        deferred.done(bind(function () {
            clearTimeout(this.timeoutId);
            this.deferred.resolve();
        }, this));
    };

    Queue.prototype.run = function (options) {
        forEach(this.queueItems, bind(function (queueItem) {
            var resolve = function () {
                    queueItem.deferred.resolve.apply(queueItem.deferred, arrayfy(arguments));
                },
                returnedValue;
            if (isFunction(queueItem.callback)) {
                returnedValue = queueItem.callback(options.passedValues, resolve);
                if (isJQueryDeferred(returnedValue)) {
                    returnedValue.done(resolve);
                }
            } else if (queueItem.callback instanceof EasyChain) {
                queueItem.callback.runQueuesFrom(0).done(resolve);
            }
        }, this));

        this.timeoutId = setTimeout(bind(function () {
            this.deferred.reject();
        }, this), (this.timeout || EasyChain.TIMEOUT_MSEC));

        return this.deferred.promise();
    };

    Queue.prototype.getType = function () {
        return this.type;
    };

    Queue.prototype.getValues = function () {
        if (this.type === Queue.ALL || this.type === Queue.FIRST) {
            return map(this.queueItems, function (queueItem) {
                return queueItem.value;
            });
        } else if (this.type === Queue.SINGLE || this.type === Queue.WAIT) {
            return this.queueItems[0].value;
        }
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

    EasyChain.prototype.runQueuesFrom = function (index) {
        var queue = this._queues[index],
            prevQueue = this._queues[index - 1],
            prevQueueValues = prevQueue ? prevQueue.getValues() : undefined,
            deferred = new Deferred();

        if (queue) {
            queue
                .run({
                    passedValues: prevQueueValues
                })
                .done(bind(function () {
                    this._fireEvent(
                        EasyChain.PROGRESS,
                        new Event(EasyChain.PROGRESS, this, {
                            values: queue.getValues(),
                            queueType: queue.getType(),
                            index: index
                        })
                    );
                    this.runQueuesFrom(index + 1).done(function () {
                        deferred.resolve(queue.getValues());
                    });
                }, this))
                .fail(bind(function () {
                    this._fireEvent(
                        EasyChain.TIMEOUT_ERROR,
                        new Event(EasyChain.TIMEOUT_ERROR, this, {
                            values: queue.getValues(),
                            queueType: queue.getType(),
                            index: index
                        })
                    );
                }, this));
        } else {
            deferred.resolve(prevQueueValues);
        }

        return deferred.promise();
    };

    // - - - - - - - - - - - - - - - - - - -
    // Public Methods

    EasyChain.prototype.single = function (callback) {
        if (isFunction(callback)) {
            this._queues.push(new Queue(Queue.SINGLE, this._timeout, [callback]));
        } else {
            throw new TypeError("single() takes only function.");
        }
        return this;
    };

    EasyChain.prototype.all = function () {
        var callbacks = isArray(arguments[0]) ? arguments[0] : Array.prototype.slice.call(arguments);
        this._queues.push(new Queue(Queue.ALL, this._timeout, callbacks));
        return this;
    };

    EasyChain.prototype.first = function () {
        var callbacks = isArray(arguments[0]) ? arguments[0] : Array.prototype.slice.call(arguments);
        this._queues.push(new Queue(Queue.FIRST, this._timeout, callbacks));
        return this;
    };

    EasyChain.prototype.wait = function (msec) {
        if (isNumber(msec)) {
            this._queues.push(new Queue(Queue.WAIT, this._timeout, [function (values, next) {
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
        this.runQueuesFrom(0)
            .done(bind(function () {
                this._fireEvent(
                    EasyChain.COMPLETE,
                    new Event(EasyChain.COMPLETE, this, {
                        type: EasyChain.COMPLETE,
                        length: this._queues.length
                    })
                );
            }, this));
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
    global.EasyChain.Deferred = Deferred;

}(this));