angular.module('angular.usecase.adapter', [])
    .factory('usecaseAdapterFactory', function() {
        var spy = jasmine.createSpy('usecaseAdapterFactorySpy');
        spy.and.returnValue({});
        return  spy;
    });