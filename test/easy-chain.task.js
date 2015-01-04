describe("EasyChain.Queue", function () {

    it("should have type, status, save data given by next method", function (done) {
        var task = EasyChain.Task
            .createSingleType(function (next) {
                setTimeout(function () {
                    next("A", "B", ["C"]);
                }, 100)
            }, 500);

        task
            .run()
            .done(function () {
                expect(task.getType()).toBe('single');
                expect(task.getValues()).toEqual(["A", "B", ["C"]]);
                expect(task.getStatus()).toBeTruthy();
                done();
            });

        expect(task.getType()).toBe('single');
        expect(task.getValues()).toBeUndefined();
        expect(task.getStatus()).toBeFalsy();
    });

    it("should wait", function (done) {
        var task = EasyChain.Task.createWaitType(100);

        task.run();

        expect(task.getType()).toBe('wait');
        expect(task.getValues()).toEqual(100);
        expect(task.getStatus()).toBeFalsy();

        setTimeout(function () {
            expect(task.getType()).toBe('wait');
            expect(task.getValues()).toEqual(100);
            expect(task.getStatus()).toBeTruthy();
            done();
        }, 200);
    });

});
