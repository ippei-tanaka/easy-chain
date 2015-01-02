describe("EasyChain.Queue", function () {

    it("should have type, status, save data given by next method", function (done) {
        var queue = EasyChain.Queue
            .createSingleType(function (next) {
                setTimeout(function () {
                    next("A", "B", ["C"]);
                }, 100)
            }, 500);

        queue
            .run()
            .done(function () {
                expect(queue.getType()).toBe('single');
                expect(queue.getValues()).toEqual(["A", "B", ["C"]]);
                expect(queue.getStatus()).toBeTruthy();
                done();
            });

        expect(queue.getType()).toBe('single');
        expect(queue.getValues()).toBeUndefined();
        expect(queue.getStatus()).toBeFalsy();
    });

    it("should wait", function (done) {
        var queue = EasyChain.Queue.createWaitType(100);

        queue.run();

        expect(queue.getType()).toBe('wait');
        expect(queue.getValues()).toEqual(100);
        expect(queue.getStatus()).toBeFalsy();

        setTimeout(function () {
            expect(queue.getType()).toBe('wait');
            expect(queue.getValues()).toEqual(100);
            expect(queue.getStatus()).toBeTruthy();
            done();
        }, 200);
    });

});
