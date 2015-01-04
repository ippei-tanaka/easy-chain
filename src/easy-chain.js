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
    // Command

    function Command(command) {
        this.command = command;
        this.deferred = new Deferred();
        this.output = undefined;

        this.deferred.done(bind(function (value) {
            this.output = value;
        }, this));
    }

    Command.prototype.execute = function (options) {
        var returnedValue;
        options = options || {};

        if (isFunction(this.command)) {
            returnedValue = this.command(bind(function () {
                this.deferred.resolve(arrayfy(arguments));
            }, this), options.prevTask);
            if (isJQueryDeferred(returnedValue)) {
                returnedValue.done(bind(function () {
                    this.deferred.resolve(arrayfy(arguments));
                }, this));
            }
        } else if (isJQueryDeferred(this.command)) {
            this.command.done(bind(function () {
                this.deferred.resolve(arrayfy(arguments));
            }, this));
        } else if (this.command instanceof EasyChain) {
            this.command._runTasksFrom(0).done(bind(function (tasks) {
                if (tasks.length < 2) {
                    this.deferred.resolve(tasks[0]);
                } else {
                    this.deferred.resolve(tasks);
                }
            }, this));
        }
    };

    Command.prototype.getOutput = function () {
        return this.output;
    };

    //==================================================================
    // Task

    function Task(type, commands, timeout) {
        this._initialize(type, commands, timeout);
    }

    // - - - - - - - - - - - - - - - - - - -
    // Private Methods

    Task.prototype._initialize = function (type, commands, timeout) {
        this.type = type;
        this.deferred = new Deferred();
        this.timeout = timeout;
        this.timeoutId = null;
        this.commands = null;
        this.waitTime = null;

        if (this.type === Task.Types.SINGLE
            || this.type === Task.Types.ALL) {
            this.commands = map(commands, function (command) {
                return new Command(command);
            });
            Deferred
                .whenAllDone(map(this.commands, function (command) {
                    return command.deferred.promise();
                }))
                .done(bind(function () {
                    this._clearTimeout();
                    this.deferred.resolve();
                }, this));
        } else if (this.type === Task.Types.ANY) {
            this.commands = map(commands, function (callback) {
                return new Command(callback);
            });
            Deferred
                .whenAnyDone(map(this.commands, function (command) {
                    return command.deferred.promise();
                }))
                .done(bind(function () {
                    this._clearTimeout();
                    this.deferred.resolve();
                }, this));
        } else if (this.type === Task.Types.WAIT) {
            this.waitTime = commands;
            this.commands = [new Command(bind(function () {
                setTimeout(bind(function () {
                    this.deferred.resolve();
                }, this), this.waitTime);
            }, this))];
        }
    };

    Task.prototype._runJobs = function (options) {
        forEach(this.commands, bind(function (command) {
            command.execute(options);
        }, this));
    };

    Task.prototype._setTimeout = function () {
        this.timeoutId = setTimeout(bind(function () {
            this.deferred.reject();
        }, this), (this.timeout || Task.TIMEOUT));
    };

    Task.prototype._clearTimeout = function () {
        clearTimeout(this.timeoutId);
    };

    // - - - - - - - - - - - - - - - - - - -
    // Public Methods

    Task.prototype.run = function (options) {
        this._runJobs(options);
        this._setTimeout();
        return this.deferred.promise();
    };

    Task.prototype.getType = function () {
        return this.type;
    };

    Task.prototype.getValues = function () {
        if (this.type === Task.Types.ALL
            || this.type === Task.Types.ANY) {
            return map(this.commands, function (command) {
                return command.getOutput();
            });
        } else if (this.type === Task.Types.SINGLE) {
            return this.commands[0].getOutput();
        } else if (this.type === Task.Types.WAIT) {
            return this.waitTime;
        }
    };

    Task.prototype.getStatus = function () {
        return this.deferred._status;
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

    EasyChain.prototype.wait = function (msec) {
        this._tasks.push(Task.createWaitType(msec));
        return this;
    };

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

    EasyChain.prototype.empty = function () {
        this._tasks = [];
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

    EasyChain.doAny = function (tasks, timeout) {
        var instance = new EasyChain();
        return instance.doAny(tasks, timeout);
    };

    EasyChain.wait = function (msec) {
        var instance = new EasyChain();
        return instance.wait(msec);
    };

    EasyChain.Events = {
        COMPLETE: 'complete',
        PROGRESS: 'progress',
        TIMEOUT: 'timeout'
    };

    this.EasyChain = EasyChain;

    this.EasyChain.Deferred = Deferred;

    this.EasyChain.Task = Task;

}).call(this);