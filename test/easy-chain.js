describe("EasyChain.Deferred", function () {

    var originalTimeout;

    beforeEach(function () {
        originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 1000;
    });

    it("should invoke callbacks when being resolved or rejected for the first time.", function () {
        var spiedFunction1 = jasmine.createSpy('spiedFunction'),
            spiedFunction2 = jasmine.createSpy('spiedFunction');

        new EasyChain.Deferred()
            .done(function (values) {
                expect(values).toEqual([1, 2, 3]);
                spiedFunction1();
            })
            .done(function (values) {
                expect(values).toEqual([1, 2, 3]);
                spiedFunction1();
            })
            .fail(function (values) {
                expect(values).toEqual([4, 5, 6]);
                spiedFunction1();
            })
            .resolve([1, 2, 3])
            .resolve([1, 2, 3])
            .reject([1, 2, 3]);

        expect(spiedFunction1.calls.count()).toEqual(2);

        new EasyChain.Deferred()
            .done(function (values) {
                expect(values).toEqual([1, 2, 3]);
                spiedFunction2();
            })
            .done(function (values) {
                expect(values).toEqual([1, 2, 3]);
                spiedFunction2();
            })
            .fail(function (values) {
                expect(values).toEqual([4, 5, 6]);
                spiedFunction2();
            })
            .reject([4, 5, 6])
            .reject([4, 5, 6])
            .resolve([1, 2, 3])
            .resolve([1, 2, 3]);

        expect(spiedFunction2.calls.count()).toEqual(1);
    });

    describe("Promise object", function () {
        it("should ban reject and resolve methods.", function () {
            var spiedFunction1 = jasmine.createSpy('spiedFunction'),
                deferred =  new EasyChain.Deferred();

            expect(function () {
                deferred
                    .done(function (values) {
                        expect(values).toEqual([1, 2, 3]);
                        spiedFunction1();
                    })
                    .promise()
                    .done(function (values) {
                        expect(values).toEqual([1, 2, 3]);
                        spiedFunction1();
                    })
                    .resolve([7, 8, 9]);
            }).toThrow();

            deferred.resolve([1, 2, 3]);

            expect(spiedFunction1.calls.count()).toEqual(2);
        });
    });

    afterEach(function () {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
    });
});