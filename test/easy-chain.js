describe("EasyChain", function () {

    var originalJasmineTimeout,
        originalEasyChainTimeout,
        chain,
        chain2,
        chain3,
        spiedFunction,
        timeout = 50;

    beforeEach(function () {
        originalJasmineTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 1000;
        originalEasyChainTimeout = EasyChain.TIMEOUT_MSEC;
        chain = new EasyChain({timeout: timeout});
        chain2 = new EasyChain();
        chain3 = new EasyChain();
        spiedFunction = jasmine.createSpy('spiedFunction');
    });

    it("should run sequentially functions.", function () {
        chain
            .single(function (values, next) {
                next("He", "llo");
            })
            .single(function (values, next) {
                spiedFunction();
                expect(values).toEqual(["He", "llo"]);
                next();
            })
            .run();
        expect(spiedFunction).toHaveBeenCalled();
    });

    it("should not run functions that doesn't invoke the given callback.", function () {
        chain
            .single(function () {
            })
            .single(function () {
                spiedFunction();
            })
            .run();

        chain2
            .first(function () {
            }, function () {
            }, function () {
            })
            .single(function () {
                spiedFunction();
            })
            .run();

        chain3
            .all(function () {
            }, function (value, next) {
                next()
            }, function (value, next) {
                next()
            })
            .single(function () {
                spiedFunction();
            })
            .run();

        expect(spiedFunction).not.toHaveBeenCalled();
    });


    it("should run all functions in parallel.", function () {
        chain
            .all(function (values, next) {
                spiedFunction();
                next(1, 2, 3);
                expect(values).toBeUndefined();
            }, function (values, next) {
                spiedFunction();
                next(4, 5);
                expect(values).toBeUndefined();
            })
            .all([function (values, next) {
                spiedFunction();
                next();
                expect(values).toEqual([[1, 2, 3], [4, 5]]);
            }, function (values, next) {
                spiedFunction();
                next();
            }])
            .single(spiedFunction)
            .run();
        expect(spiedFunction.calls.count()).toEqual(5);
    });

    it("should run first function in parallel.", function () {
        chain
            .first(
            function (values, next) {
                next();
            }, function (values, next) {
            }, function (values, next) {
            })
            .first([function (values, next) {
                next();
            }, function (values, next) {
                next();
            }, function (values, next) {
            }])
            .single(spiedFunction)
            .run();
        expect(spiedFunction).toHaveBeenCalled();
    });


    it("should run functions that returns a jQuery promise.", function () {
        var deferredObjects = _(new Array(8)).map(function () {
            return $.Deferred();
        });

        chain
            .single(function () {
                return deferredObjects[0].promise();
            })
            .all(function () {
                return deferredObjects[1].promise();
            })
            .first(function () {
                return deferredObjects[1].promise();
            })
            .all([function () {
                return deferredObjects[1].promise();
            }])
            .first([function () {
                return deferredObjects[1].promise();
            }])
            .first(
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
        )
            .all(
            deferredObjects[4].promise,
            deferredObjects[5].promise,
            deferredObjects[6].promise,
            function (values, next) {
                next();
                spiedFunction();
            }
        )
            .single(function () {
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
        chain
            .single(function (values, next) {
                next()
            })
            .single(function (values, next) {
                next()
            })
            .on(EasyChain.COMPLETE, function () {
                spiedFunction();
            })
            .off(EasyChain.COMPLETE)
            .on(EasyChain.COMPLETE, function (event) {
                expect(event.length).toBe(2);
                expect(event.target).toBe(chain);
                expect(event.type).toBe(EasyChain.COMPLETE);
                spiedFunction();
            })
            .run();

        expect(spiedFunction.calls.count()).toEqual(1);
    });

    it("should fire progress callback.", function () {
        var callback = function () {
            var args = arguments;
            return function (values, next) {
                next.apply({}, args)
            };
        };

        chain
            .single(callback("Hi", "Hello"))
            .all(callback("H", "E"), callback("L"), callback("L", "O"))
            .first(callback("H", "E"), callback("L"), callback("L", "O"))
            .on(EasyChain.PROGRESS, function (event) {
                expect(event.type).toBe(EasyChain.PROGRESS);
                expect(event.target).toBe(chain);
                if (event.index === 0) {
                    expect(event.queueType).toBe('single');
                    expect(event.values).toEqual(["Hi", "Hello"]);
                } else if (event.index === 1) {
                    expect(event.queueType).toBe('all');
                    expect(event.values).toEqual([["H", "E"], ["L"], ["L", "O"]]);
                } else if (event.index === 2) {
                    expect(event.queueType).toBe('first');
                    expect(event.values).toEqual([["H", "E"], ["L"], ["L", "O"]]);
                }
                spiedFunction();
            })
            .run();

        expect(spiedFunction.calls.count()).toEqual(3);
    });


    it("should trigger error event when timeout occurs.", function (done) {
        chain
            .all(function (values, next) {
                next()
            })
            .all(function (values, next) {
                next("H", "I")
            }, function (values, next) {
            })
            .on(EasyChain.TIMEOUT_ERROR, function (event) {
                expect(event.type).toBe(EasyChain.TIMEOUT_ERROR);
                expect(event.target).toBe(chain);
                expect(event.values).toEqual([["H", "I"], undefined]);
                spiedFunction();
            })
            .run();

        setTimeout(function () {
            expect(spiedFunction).toHaveBeenCalled();
            done();
        }, timeout + 50)
    });

    it("should not trigger error event when timeout doesn't occur.", function (done) {
        chain
            .single(function (values, next) {
                next()
            })
            .on(EasyChain.TIMEOUT_ERROR, function () {
                spiedFunction();
            })
            .run();

        setTimeout(function () {
            expect(spiedFunction).not.toHaveBeenCalled();
            done();
        }, timeout + 50)
    });

    it("should run nested chains.", function () {
        var callback = function (values, next) {
            next();
        };

        chain
            .all(
            chain2
                .all(callback, callback, callback),
            chain3
                .all(callback, callback, callback)
                .first(callback, callback, callback),
            function (values, next) {
                next();
            }
        )
            .single(function () {
                spiedFunction();
            })
            .run();

        expect(spiedFunction).toHaveBeenCalled();
    });


    it("should wait.", function (done) {
        EasyChain
            .wait(200)
            .single(function (values, next) {
                spiedFunction();
                next();
            })
            .on(EasyChain.PROGRESS, function (event) {
                if (event.index === 0) {
                    spiedFunction();
                    expect(event.queueType).toBe('wait');
                    expect(event.values).toEqual(200);
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
        var callback = function (values, next) {
            next();
        };

        chain
            .all(
            chain2
                .all(callback, callback, callback),
            chain3
                .all(callback, callback, callback)
                .first(function () {
                }, function () {
                })
        )
            .single(function () {
                spiedFunction();
            })
            .run();

        expect(spiedFunction).not.toHaveBeenCalled();
    });

    it("should on and off event-listeners.", function () {
        var obj = {},
            callback = function () {
                spiedFunction();
            };

        chain
            .single(function (values, next) {
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
            .single(function (values, next) {
                next()
            })
            .on(EasyChain.COMPLETE, callback)
            .on(EasyChain.COMPLETE, callback)
            .off(EasyChain.COMPLETE, callback)
            .run();

        expect(spiedFunction).not.toHaveBeenCalled();

        chain
            .empty()
            .single(function (values, next) {
                next()
            })
            .on(EasyChain.PROGRESS, callback)
            .off(EasyChain.PROGRESS)
            .run();

        expect(spiedFunction).not.toHaveBeenCalled();

    });


    it("should return instance through static methods.", function (done) {
        var callback = function (values, next) {
            next();
        };

        EasyChain
            .all(callback, callback, callback, EasyChain.first([callback, callback]))
            .first(
            EasyChain.wait(100),
            function () {
            }
        )
            .single(function () {
                spiedFunction();
            })
            .run();

        expect(spiedFunction).not.toHaveBeenCalled();

        setTimeout(function () {
            expect(spiedFunction).toHaveBeenCalled();
            done();
        }, 300);
    });

    it("should be working with jQuery ajax calls.", function (done) {

        jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;
        EasyChain.TIMEOUT_MSEC = 10000;
        EasyChain.all(
            $.getJSON('http://echo.jsontest.com/key1/value1'),
            $.getJSON('http://echo.jsontest.com/key2/value2').promise(),
            EasyChain.wait(100)
        )
        .single(function (values, next) {
            expect(values[0][0]).toEqual({"key1": "value1"});
            expect(values[1][0]).toEqual({"key2": "value2"});
            expect(values[2]).toEqual([100]);
            return $.getJSON('http://echo.jsontest.com/key3/value3');
        })
        .single(function (values, next) {
            expect(values[0]).toEqual({"key3": "value3"});
            next();
            done();
        })
        .run();
    });


    afterEach(function () {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = originalJasmineTimeout;
        EasyChain.TIMEOUT_MSEC = originalEasyChainTimeout;
    });
});