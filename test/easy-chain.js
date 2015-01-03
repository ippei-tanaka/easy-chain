describe("EasyChain", function () {

    var originalJasmineTimeout,
        spiedFunction;

    beforeEach(function () {
        //originalJasmineTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        //jasmine.DEFAULT_TIMEOUT_INTERVAL = 1000;
        spiedFunction = jasmine.createSpy('spiedFunction');
    });

    it("should run sequentially functions calling next method.", function () {
        EasyChain
            .do(function (next) {
                next("He", "llo");
            })
            .do(function (next, prevQueue) {
                spiedFunction();
                expect(prevQueue.getValues()).toEqual(["He", "llo"]);
                next();
            })
            .run();
        expect(spiedFunction).toHaveBeenCalled();
    });


    it("should not run functions that doesn't invoke the given callback.", function () {

        EasyChain
            .do(function () {})
            .do(function () { spiedFunction(); })
            .run();

        EasyChain
            .doAny([
                function () {},
                function () {},
                function () {}
            ])
            .do(function () {
                spiedFunction();
            })
            .run();

        EasyChain
            .doAll([
                function () {},
                function (next) { next() },
                function (next) { next() }
            ])
            .do(function () {
                spiedFunction();
            })
            .run();

        expect(spiedFunction).not.toHaveBeenCalled();
    });


    it("should run all functions in parallel with doAll method.", function () {
        EasyChain
            .doAll([
                function (next, prevQueue) {
                    spiedFunction();
                    next(1, 2, 3);
                    expect(prevQueue).toBeUndefined();
                },
                function (next, prevQueue) {
                    spiedFunction();
                    next(4, 5);
                    expect(prevQueue).toBeUndefined();
                }
            ])
            .doAll([
                function (next, prevQueue) {
                    spiedFunction();
                    next();
                    expect(prevQueue.getValues()).toEqual([[1, 2, 3], [4, 5]]);
                },
                function (next) {
                    spiedFunction();
                    next();
                }
            ])
            .do(spiedFunction)
            .run();

        expect(spiedFunction.calls.count()).toEqual(5);
    });

    it("should run first function in parallel with doAny method.", function () {
        EasyChain
            .doAny([
                function (next) { next("ABC", "DEF"); },
                function (next) {},
                function (next) {}
            ])
            .doAny([
                function (next) {},
                function (next, prevQueue) {
                    expect(prevQueue.getValues()).toEqual([["ABC", "DEF"], undefined, undefined]);
                },
                function (next) { next("HELLO"); }
            ])
            .do(function (next, prevQueue) {
                expect(prevQueue.getValues()).toEqual([undefined, undefined, ["HELLO"]]);
                next();
            })
            .do(spiedFunction)
            .run();

        expect(spiedFunction).toHaveBeenCalled();
    });


    it("should run functions that returns a jQuery promise.", function () {
        var deferredObjects = _(new Array(8)).map(function () {
            return $.Deferred();
        });

        EasyChain
            .do(function () {
                return deferredObjects[0].promise();
            })
            .doAll([function () {
                return deferredObjects[1].promise();
            }])
            .doAny([function () {
                return deferredObjects[1].promise();
            }])
            .doAll([function () {
                return deferredObjects[1].promise();
            }])
            .doAny([function () {
                return deferredObjects[1].promise();
            }])
            .doAny([
                function () {
                    var p = deferredObjects[2].promise();
                    deferredObjects[2].done(spiedFunction);
                    return p;
                },
                function () {
                    var p = deferredObjects[3].promise();
                    deferredObjects[3].done(spiedFunction);
                    return p;
                }
            ])
            .doAll([
                deferredObjects[4].promise,
                deferredObjects[5].promise,
                deferredObjects[6].promise,
                function (next) {
                    next();
                    spiedFunction();
                }
            ])
            .do(function () {
                spiedFunction();
                return deferredObjects[7].promise();
            })
            .run();

        deferredObjects[0].resolve();
        deferredObjects[1].resolve();
        deferredObjects[2].resolve();
        deferredObjects[4].resolve();
        deferredObjects[5].resolve();
        deferredObjects[6].resolve();

        expect(spiedFunction.calls.count()).toEqual(3);
    });


    it("should fire complete callback.", function () {
        var chain = EasyChain
            .do(function (next) {
                next()
            })
            .do(function (next) {
                next()
            })
            .on(EasyChain.Events.COMPLETE, function () {
                spiedFunction();
            })
            .off(EasyChain.Events.COMPLETE)
            .on(EasyChain.Events.COMPLETE, function (event) {
                expect(event.length).toBe(2);
                expect(event.target).toBe(chain);
                expect(event.type).toBe(EasyChain.Events.COMPLETE);
                spiedFunction();
            });

        chain.run();
        expect(spiedFunction.calls.count()).toEqual(1);
    });


    it("should fire progress callback.", function () {
        var callback = function () {
            var args = arguments;
            return function (next) {
                next.apply({}, args)
            };
        };

        EasyChain
            .do(callback("Hi", "Hello"))
            .doAll([callback(1), callback(2, 3), callback(4, 5, 6)])
            .doAny([callback("H", "E"), callback("L"), callback("L", "O")])
            .on(EasyChain.Events.PROGRESS, function (event) {
                expect(event.type).toBe(EasyChain.Events.PROGRESS);
                if (event.index === 0) {
                    expect(event.queue.getType()).toBe('single');
                    expect(event.queue.getValues()).toEqual(["Hi", "Hello"]);
                } else if (event.index === 1) {
                    expect(event.queue.getType()).toBe('all');
                    expect(event.queue.getValues()).toEqual([[1], [2, 3], [4, 5, 6]]);
                } else if (event.index === 2) {
                    expect(event.queue.getType()).toBe('any');
                    expect(event.queue.getValues()).toEqual([["H", "E"], ["L"], ["L", "O"]]);
                }
                spiedFunction();
            })
            .run();

        expect(spiedFunction.calls.count()).toEqual(3);
    });


    it("should trigger error event when timeout occurs.", function (done) {
        var chain = EasyChain
            .doAll([
                function (next) { next() }
            ])
            .doAll([
                function (next) { next(1) },
                function (next) {
                    setTimeout(function () {
                        next()
                    }, 500);
                }
            ], 100)
            .on(EasyChain.Events.TIMEOUT_ERROR, function (event) {
                expect(event.type).toBe(EasyChain.Events.TIMEOUT_ERROR);
                expect(event.target).toBe(chain);
                expect(event.index).toBe(1);
                expect(event.queue.getValues()).toEqual([[1], undefined]);
                done();
            });

        chain.run();
    });


    it("should not trigger error event when timeout doesn't occur.", function (done) {
        EasyChain
            .do(function (next) {
                setTimeout(function () {
                    next()
                }, 10);
            }, 100)
            .on(EasyChain.Events.TIMEOUT_ERROR, function () {
                spiedFunction();
            })
            .run();

        setTimeout(function () {
            expect(spiedFunction).not.toHaveBeenCalled();
            done();
        }, 1000)
    });


    it("should run nested chains.", function () {
        var callback = function (next) {
            next();
        };

        EasyChain
            .doAll([
                EasyChain.doAll([
                    callback,
                    callback
                ]),
                EasyChain
                    .doAll([
                        callback,
                        callback
                    ])
                    .doAny([
                        function () {},
                        callback
                    ]),
                callback
            ])
            .do(function () {
                spiedFunction();
            })
            .run();

        expect(spiedFunction).toHaveBeenCalled();
    });


    it("should wait.", function (done) {
        EasyChain
            .wait(200)
            .do(function (next) {
                spiedFunction();
                next();
            })
            .on(EasyChain.PROGRESS, function (event) {
                if (event.index === 0) {
                    spiedFunction();
                    expect(event.queue.getType()).toBe('wait');
                    expect(event.queue.getValues()).toEqual(200);
                }
            })
            .run();

        expect(spiedFunction).not.toHaveBeenCalled();

        setTimeout(function () {
            expect(spiedFunction).not.toHaveBeenCalled();
        }, 10);

        setTimeout(function () {
            expect(spiedFunction).toHaveBeenCalled();
            done();
        }, 300);
    });


    it("should not complete incorrectly nested chains.", function () {
        var callback = function (next) {
            next();
        };

        EasyChain
            .doAll([
                EasyChain
                    .doAll([
                        callback,
                        callback,
                        callback
                    ]),
                EasyChain
                    .doAll([
                        callback,
                        callback,
                        callback
                    ])
                    .doAny([
                        function () {},
                        function () {}
                    ])
            ])
            .do(function () {
                spiedFunction();
            })
            .run();

        expect(spiedFunction).not.toHaveBeenCalled();
    });


    it("should on and off event-listeners.", function () {
        var obj = {},
            callback = function () {
                spiedFunction();
            },
            chain = new EasyChain();

        chain
            .do(function (next) {
                next()
            })
            .on(EasyChain.COMPLETE, callback, obj)
            .on(EasyChain.COMPLETE, function () {
            }, obj)
            .off(EasyChain.COMPLETE, callback, {})
            .run();

        expect(spiedFunction).not.toHaveBeenCalled();

        chain
            .empty()
            .do(function (next) {
                next()
            })
            .on(EasyChain.COMPLETE, callback)
            .on(EasyChain.COMPLETE, callback)
            .off(EasyChain.COMPLETE, callback)
            .run();

        expect(spiedFunction).not.toHaveBeenCalled();

        chain
            .empty()
            .do(function (next) {
                next()
            })
            .on(EasyChain.PROGRESS, callback)
            .off(EasyChain.PROGRESS)
            .run();

        expect(spiedFunction).not.toHaveBeenCalled();

    });


    it("should return queue record.", function (done) {
        EasyChain
            .doAll([
                function (next) {
                    next(1);
                },
                EasyChain.doAll([
                    function (next) {
                        next(2);
                    },
                    EasyChain.wait(10)
                ])
            ])
            .doAny([
                EasyChain.wait(10),
                function (next, prevQueue) {
                    expect(prevQueue.getValues()[0]).toEqual([1]);
                    expect(prevQueue.getValues()[1].getValues()[0]).toEqual([2]);
                    expect(prevQueue.getValues()[1].getValues()[1].getValues()).toEqual(10);
                }
            ])
            .do(function (next) {
                spiedFunction();
                next();
            })
            .run();

        expect(spiedFunction).not.toHaveBeenCalled();

        setTimeout(function () {
            expect(spiedFunction).toHaveBeenCalled();
            done();
        }, 300);
    });


    it("should be working with jQuery ajax calls.", function (done) {

        EasyChain
            .doAll([
                $.getJSON('http://echo.jsontest.com/key1/value1'),
                $.getJSON('http://echo.jsontest.com/key2/value2').promise(),
                EasyChain.wait(100)
            ])
            .do(function (next, prevQueue) {
                expect(prevQueue.getValues()[0][0]).toEqual({"key1": "value1"});
                expect(prevQueue.getValues()[1][0]).toEqual({"key2": "value2"});
                expect(prevQueue.getValues()[2].getValues()).toEqual(100);
                return $.getJSON('http://echo.jsontest.com/key3/value3');
            })
            .do(function (next, prevQueue) {
                expect(prevQueue.getValues()[0]).toEqual({"key3": "value3"});
                next();
                done();
            })
            .run();
    });
});