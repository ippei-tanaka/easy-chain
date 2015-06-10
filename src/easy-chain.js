/**
 * @fileOverview Easy Chain
 * @author Ippei Tanaka
 * @version 0.0.1
 */
(function () {

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

    /**
     * @class Promise
     * @param {Deferred} deferred
     */
    function Promise(deferred) {
        this._deferred = deferred;
    }
    
    // - - - - - - - - - - - - - - - - - - -
    // Public Methods
    
    /**
     * Add a callback that will be executed 
     * when the promise object is resolved.
     * @memberOf Promise
     * @param {function} callback
     * @returns {Promise}
     */
    Promise.prototype.done = function (callback) {
        this._deferred.done(callback);
        return this;
    };

    /**
     * Add a callback that will be executed 
     * when the promise object is rejected.
     * @memberOf Promise
     * @param {function} callback
     * @returns {Promise}
     */
    Promise.prototype.fail = function (callback) {
        this._deferred.fail(callback);
        return this;
    };

    //==================================================================
    // Deferred

    /**
     * @class Deferred
     */
    function Deferred() {
        this._doneCallbacks = [];
        this._failCallbacks = [];
        this._status = null;
        this._arguments = null;
    }
    
    // - - - - - - - - - - - - - - - - - - -
    // Public Methods

    /**
     * Resolve the deferred object with optional values 
     * that will be sent to done callbacks.
     * @memberOf Deferred
     * @param {...*} [values]
     * @returns {Deferred}
     */
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

    /**
     * Reject the deferred object with optional values 
     * that will be sent to fail callbacks.
     * @memberOf Deferred
     * @param {...*} [values]
     * @returns {Deferred}
     */
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

    /**
     * Add a callback that will be executed 
     * when the deferred object is resolved.
     * @memberOf Deferred
     * @param {function} callback
     * @returns {Deferred}
     */
    Deferred.prototype.done = function (callback) {
        this._doneCallbacks.push(callback);
        if (this._status === "resolved") {
            callback.apply(null, this._arguments);
        }
        return this;
    };

    /**
     * Add a callback that will be executed 
     * when the deferred object is rejected.
     * @memberOf Deferred
     * @param {function} callback
     * @returns {Deferred}
     */
    Deferred.prototype.fail = function (callback) {
        this._failCallbacks.push(callback);
        if (this._status === "rejected") {
            callback.apply(null, this._arguments);
        }
        return this;
    };

 	/**
     * Get the promise object.
     * @memberOf Deferred
     * @returns {Promise}
     */
    Deferred.prototype.promise = function () {
        return new Promise(this);
    };
    
    /**
     * Get the status of the deferred object.
     * @memberOf Deferred
     * @returns {string}
     */
    Deferred.prototype.getStatus = function () {
        return this._status;
    };
    
    // - - - - - - - - - - - - - - - - - - -
    // Public Static Methods

    /**
     * Return the promise object that will be resolved 
     * when all deferred objects are resolved.
     * @memberOf Deferred
     * @method whenAllDone
     * @param {Array.<Deferred|Promise>} deferreds
     * @returns {Promise}
     */
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

    /**
     * Return the promise object that will be resolved 
     * when any of deferred objects are resolved.
     * @memberOf Deferred
     * @method whenAnyDone
     * @param {Array.<Deferred|Promise>} deferreds
     * @returns {Promise}
     */
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
    // Command

    function Command(command) {
        this._command = command;
        this._deferred = new Deferred();
        this._output = undefined;

        this._deferred.done(bind(function (value) {
            this._output = value;
        }, this));
    }
    
    // - - - - - - - - - - - - - - - - - - -
    // Public Methods

    Command.prototype.execute = function (options) {
        var returnedValue;
        options = options || {};

        if (isFunction(this._command)) {
            returnedValue = this._command(bind(function () {
                this._deferred.resolve(arrayfy(arguments));
            }, this), options.prevTask);
            if (isJQueryDeferred(returnedValue)) {
                returnedValue.done(bind(function () {
                    this._deferred.resolve(arrayfy(arguments));
                }, this));
            }
        } else if (isJQueryDeferred(this._command)) {
            this._command.done(bind(function () {
                this._deferred.resolve(arrayfy(arguments));
            }, this));
        } else if (this._command instanceof EasyChain) {
            this._command._runTasksFrom(0).done(bind(function (tasks) {
                if (tasks.length < 2) {
                    this._deferred.resolve(tasks[0]);
                } else {
                    this._deferred.resolve(tasks);
                }
            }, this));
        }
    };

    Command.prototype.getOutput = function () {
        return this._output;
    };
    
    Command.prototype.getDeferred = function () {
        return this._deferred;
    };

    //==================================================================
    // Task

    function Task(type, commands, timeout) {
        this._initialize(type, commands, timeout);
    }

    // - - - - - - - - - - - - - - - - - - -
    // Private Methods

    Task.prototype._initialize = function (type, commands, timeout) {
        this._type = type;
        this._deferred = new Deferred();
        this._timeout = timeout;
        this._timeoutId = null;
        this._commands = null;
        this._waitTime = null;

        if (this._type === Task.Types.SINGLE
            || this._type === Task.Types.ALL) {
            this._commands = map(commands, function (command) {
                return new Command(command);
            });
            Deferred
                .whenAllDone(map(this._commands, function (command) {
                    return command.getDeferred().promise();
                }))
                .done(bind(function () {
                    this._clearTimeout();
                    this._deferred.resolve();
                }, this));
        } else if (this._type === Task.Types.ANY) {
            this._commands = map(commands, function (callback) {
                return new Command(callback);
            });
            Deferred
                .whenAnyDone(map(this._commands, function (command) {
                    return command.getDeferred().promise();
                }))
                .done(bind(function () {
                    this._clearTimeout();
                    this._deferred.resolve();
                }, this));
        } else if (this._type === Task.Types.WAIT) {
            this._waitTime = commands;
            this._commands = [new Command(bind(function () {
                setTimeout(bind(function () {
                    this._deferred.resolve();
                }, this), this._waitTime);
            }, this))];
        }
    };

    Task.prototype._runJobs = function (options) {
        forEach(this._commands, bind(function (command) {
            command.execute(options);
        }, this));
    };

    Task.prototype._setTimeout = function () {
        this._timeoutId = setTimeout(bind(function () {
            this._deferred.reject();
        }, this), (this._timeout || Task.TIMEOUT));
    };

    Task.prototype._clearTimeout = function () {
        clearTimeout(this._timeoutId);
    };

    // - - - - - - - - - - - - - - - - - - -
    // Public Methods

    Task.prototype.run = function (options) {
        this._runJobs(options);
        this._setTimeout();
        return this._deferred.promise();
    };

    Task.prototype.getType = function () {
        return this._type;
    };

    Task.prototype.getValues = function () {
        if (this._type === Task.Types.ALL
            || this._type === Task.Types.ANY) {
            return map(this._commands, function (command) {
                return command.getOutput();
            });
        } else if (this._type === Task.Types.SINGLE) {
            return this._commands[0].getOutput();
        } else if (this._type === Task.Types.WAIT) {
            return this._waitTime;
        }
    };

    Task.prototype.getStatus = function () {
        return this._deferred.getStatus();
    };

    // - - - - - - - - - - - - - - - - - - -
    // Public Static Methods

    Task.createSingleType = function (commands, timeout) {
        commands = isArray(commands) ? commands : [commands];
        return new Task(Task.Types.SINGLE, commands, timeout);
    };

    Task.createAllType = function (commands, timeout) {
        commands = isArray(commands) ? commands : [commands];
        return new Task(Task.Types.ALL, commands, timeout);
    };

    Task.createAnyType = function (commands, timeout) {
        commands = isArray(commands) ? commands : [commands];
        return new Task(Task.Types.ANY, commands, timeout);
    };

    Task.createWaitType = function (msec) {
        return new Task(Task.Types.WAIT, msec);
    };

    Task.TIMEOUT = 5000;
    Task.Types = {
        SINGLE: 'single',
        ALL: 'all',
        ANY: 'any',
        WAIT: 'wait'
    };
    Task.Events = {
        TIMEOUT: 'timeout'
    };

    //==================================================================
    // PromiseChain

    /**
     * @class EasyChain
     */
    function EasyChain() {
        this._tasks = [];
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

    EasyChain.prototype._runTasksFrom = function (index) {
        var task = this._tasks[index],
            prevTask = this._tasks[index - 1],
            runOption = prevTask ? {
                prevTask: prevTask
            } : {},
            deferred = new Deferred();

        if (task) {
            task
                .run(runOption)
                .done(bind(function () {
                    this._fireEvent(
                        EasyChain.Events.PROGRESS,
                        new Event(EasyChain.Events.PROGRESS, this, {
                            task: task,
                            index: index
                        })
                    );
                    this._runTasksFrom(index + 1).done(bind(function (tasks) {
                        tasks.unshift(task);
                        deferred.resolve(tasks);
                    }, this));
                }, this))
                .fail(bind(function () {
                    this._fireEvent(
                        EasyChain.Events.TIMEOUT,
                        new Event(EasyChain.Events.TIMEOUT, this, {
                            task: task,
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

    /**
     * Add a command to the queue.
     * @memberOf EasyChain
     * @param {function|EasyChain|Deferred} command
     * @param {number} [timeout]
     * @returns {EasyChain}
     */
    EasyChain.prototype.do = function (command, timeout) {
        this._tasks.push(Task.createSingleType(command, timeout));
        return this;
    };

    /**
     * Add commands, all of which will be executed, to the queue.
     * The queue doesn't proceed until all of commands are done.
     * @memberOf EasyChain
     * @param {Array.<function|EasyChain|Deferred>} commands
     * @param {number} [timeout]
     * @returns {EasyChain}
     */
    EasyChain.prototype.doAll = function (commands, timeout) {
        this._tasks.push(Task.createAllType(commands, timeout));
        return this;
    };

    /**
     * Add commands, all of which will be executed, to the queue.
     * @memberOf EasyChain
     * @param {Array.<function|EasyChain|Deferred>} commands
     * @param {number} [timeout]
     * @returns {EasyChain}
     */
    EasyChain.prototype.doAny = function (commands, timeout) {
        this._tasks.push(Task.createAnyType(commands, timeout));
        return this;
    };

    /**
     * Wait
     * @memberOf EasyChain
     * @param {number} msec
     * @returns {EasyChain}
     */
    EasyChain.prototype.wait = function (msec) {
        this._tasks.push(Task.createWaitType(msec));
        return this;
    };

    /**
     * Run commands in the queue.
     * @memberOf EasyChain
     * @param {number} msec
     * @returns {Promise}
     */
    EasyChain.prototype.run = function () {
        return this._runTasksFrom(0)
            .done(bind(function () {
                this._fireEvent(
                    EasyChain.Events.COMPLETE,
                    new Event(EasyChain.Events.COMPLETE, this, {
                        type: EasyChain.Events.COMPLETE,
                        length: this._tasks.length
                    })
                );
            }, this));
    };

    /**
     * Empty the queue.
     * @memberOf EasyChain
     * @returns {EasyChain}
     */
    EasyChain.prototype.empty = function () {
        this._tasks = [];
        return this;
    };

    /**
     * Add an event listener.
     * @memberOf EasyChain
     * @param {string} name - The name of event. Use {@link EasyChain.Events}, instead of raw string.
     * @param {function} callback - The event listener.
     * @param {object} [context] - The context of the event listener.
     * @returns {EasyChain}
     */
    EasyChain.prototype.on = function (name, callback, context) {
        return this._on(name, callback, context);
    };

    /**
     * Remove an event listener.
     * @memberOf EasyChain
     * @param {string} name - The name of event. Use {@link EasyChain.Events}, instead of raw string.
     * @param {function} [callback] - The event listener.
     * @param {object} [context] - The context of the event listener.
     * @returns {EasyChain}
     */
    EasyChain.prototype.off = function (name, callback, context) {
        return this._off(name, callback, context);
    };

    // - - - - - - - - - - - - - - - - - - -
    // Public Static Methods

    /**
     * Add a command to the queue.
     * @method do
     * @memberOf EasyChain
     * @param {function|EasyChain|Deferred} command
     * @param {number} [timeout]
     * @returns {EasyChain}
     */
    EasyChain.do = function (command, timeout) {
        var instance = new EasyChain();
        return instance.do(command, timeout);
    };

    /**
     * Add commands, all of which will be executed, to the queue.
     * The queue doesn't proceed until all of commands are done.
     * @method doAll
     * @memberOf EasyChain
     * @param {Array.<function|EasyChain|Deferred>} commands
     * @param {number} [timeout]
     * @returns {EasyChain}
     */
    EasyChain.doAll = function (commands, timeout) {
        var instance = new EasyChain();
        return instance.doAll(commands, timeout);
    };

    /**
     * Add commands, all of which will be executed, to the queue.
     * @method doAny
     * @memberOf EasyChain
     * @param {Array.<function|EasyChain|Deferred>} commands
     * @param {number} [timeout]
     * @returns {EasyChain}
     */
    EasyChain.doAny = function (tasks, timeout) {
        var instance = new EasyChain();
        return instance.doAny(tasks, timeout);
    };
    
    /**
     * Wait
     * @method wait
     * @memberOf EasyChain
     * @param {number} msec
     * @returns {EasyChain}
     */
    EasyChain.wait = function (msec) {
        var instance = new EasyChain();
        return instance.wait(msec);
    };

	/**
	 * @namespace 
  	 * @memberOf EasyChain
	 * @property {object}  Events - The list of event names.
	 * @property {string}  Events.COMPLETE
	 * @property {string}  Events.PROGRESS
  	 * @property {string}  Events.TIMEOUT
	 */
    EasyChain.Events = {
        COMPLETE: 'complete',
        PROGRESS: 'progress',
        TIMEOUT: 'timeout'
    };

    this.EasyChain = EasyChain;

    this.EasyChain.Deferred = Deferred;

    this.EasyChain.Task = Task;

}).call(this);