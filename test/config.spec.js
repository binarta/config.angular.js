describe('config.js', function() {
    var config, scope, dispatcher;

    beforeEach(function() {
        scope = {
            $eval:function(it) {
                return it;
            }
        };
        dispatcher = {
            firePersistently:function(topic, msg) {
                dispatcher[topic] = msg;
            }
        };
    });

    describe('config provider', function () {
        var configProviderSpy;

        beforeEach(function () {
            angular.module('testApp', function () {})
                .config(function (configProvider) {
                    configProvider.key = 'value';
                    configProviderSpy = configProvider;
                });
            module('config', 'testApp');
        });

        it('config param is available', inject(function (config) {
            expect(config.key).toEqual('value');
        }));
    });

    describe('app-config directive', function() {
        var directive, element, attrs, registry;

        beforeEach(function() {
            config = {};
            attrs = {};
            registry = {};
            directive = AppConfigDirectiveFactory(registry, dispatcher);
        });

        it('restrict', function() {
            expect(directive.restrict).toEqual('A');
        });

        describe('when linked', function() {
            beforeEach(function() {
                attrs.appConfig = {key:'value'};
                directive.link(scope, element, attrs);
            });

            it('installs config in registry', function() {
                expect(registry).toEqual(attrs.appConfig);
            });

            it('expose config on scope', function() {
                expect(scope.appConfig).toEqual({key:'value'});
            });

            it('raises config.initialized event with the current config as payload', function() {
                expect(dispatcher['config.initialized']).toEqual(attrs.appConfig);
            });

            it('raises app.start event to inform components configuration has been set, delivered to all interested components and are ready for use', function() {
                expect(dispatcher['app.start']).toEqual('ok');
            });
        });
    });
});