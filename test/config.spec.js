describe('config.js', function() {
    angular.module('testApp', function () {})
        .config(function (configProvider) {
            configProvider.add({
                key: 'value',
                foo: 'bar'
            });
            configProviderSpy = configProvider;
    });

    var config, scope, dispatcher, rest;
    var configProviderSpy;
    var baseUri = 'B/';


    beforeEach(module('config'));
    beforeEach(module('rest.client'));
    beforeEach(module('notifications'));
    beforeEach(module('angular.usecase.adapter'));
    beforeEach(module('testApp'));
    beforeEach(inject(function(_restServiceHandler_, _config_) {
        rest = _restServiceHandler_;
        _config_.baseUri = baseUri;
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
    }));

    function request() {
        return rest.calls[0].args[0];
    }

    describe('config provider', function () {
        it('config param is available', inject(function (config) {
            expect(config.key).toEqual('value');
            expect(config.foo).toEqual('bar');
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

    describe('config reader', function() {
        var sut, usecaseAdapterFactory;
        var success;

        beforeEach(inject(function(_configReader_, _usecaseAdapterFactory_) {
            sut = _configReader_;
            usecaseAdapterFactory = _usecaseAdapterFactory_;
            execute()
        }));

        function execute() {
            sut({
                $scope: scope,
                key:'K',
                success: function(data) {success = data}
            });
        }

        it('usecase adapter factory receives scope', function() {
            expect(usecaseAdapterFactory.calls[0].args[0]).toEqual(scope);
        });

        it('rest service gets executed', function() {
            expect(request().params).toEqual({
                method:'GET',
                url:baseUri + 'api/entity/config/K',
                params: {
                    treatInputAsId:true,
                    scope:''
                },
                withCredentials:true
            });
        });

        it('when config scope is provided it is passed', function() {
            sut({
                $scope: scope,
                key:'K',
                scope:'s',
                success: function(data) {success = data}
            });

            expect(request().params).toEqual({
                method:'GET',
                url:baseUri + 'api/entity/config/K',
                params: {
                    treatInputAsId:true,
                    scope:'s'
                },
                withCredentials:true
            });
        });

        describe('on success', function() {
            beforeEach(function() {
                request().success('D')
            });

            it('payload is passed to success handler', function() {
                expect(success).toEqual('D');
            })
        });
    });

    describe('config writer', function() {
        var sut, usecaseAdapterFactory;
        var success;

        beforeEach(inject(function(_configWriter_, _usecaseAdapterFactory_) {
            sut = _configWriter_;
            usecaseAdapterFactory = _usecaseAdapterFactory_;
            sut({
                $scope:scope,
                key: 'K',
                value:'V',
                scope:'S',
                success: function(data) {success = data}
            });
        }));

        it('usecase adapter factory receives scope', function() {
            expect(usecaseAdapterFactory.calls[0].args[0]).toEqual(scope);
        });

        it('rest service gets executed', function() {
            expect(request().params).toEqual({
                method:'POST',
                url: baseUri + 'api/config',
                data: {
                    id: 'K',
                    value: 'V',
                    scope:'S'
                },
                withCredentials:true
            })
        });

        it('when no scope is provided it defaults to empty', function() {
            sut({
                $scope:scope,
                key: 'K',
                value:'V',
                success: function(data) {success = data}
            });
            expect(request().params.data.scope).toEqual('');
        });

        describe('on success', function() {
            beforeEach(function() {
                request().success('D')
            });

            it('test', function() {
                expect(success).toEqual('D');
            })
        });
    });

    describe('bin-config', function() {
        var sut;
        var configReader = jasmine.createSpy('configReader');
        var configWriter = jasmine.createSpy('configWriter');

        beforeEach(inject(function(_topicMessageDispatcher_) {
            scope = {};
            sut = BinConfigDirectiveFactory(configReader, configWriter, _topicMessageDispatcher_);
        }));

        afterEach(function() {
            configReader.reset();
            configWriter.reset();
        });

        it('restrict to classes attributes and elements', function() {
            expect(sut.restrict).toEqual('ECA');
        });

        it('scope is created', function() {
            expect(sut.scope).toBeTruthy();
        });

        describe('on link', function() {
            var key = 'K';
            var i18nDefault = 'D';

            beforeEach(function() {
                sut.link(scope, null, {key:key, i18nDefault:i18nDefault, scope:'s'})
            });

            it('key is exposed on scope', function() {
                expect(scope.key).toEqual(key);
            });

            it('test', function() {
                expect(scope.i18nDefault).toEqual(i18nDefault);
            });

            it('config reader is called', function() {
                expect(configReader.calls[0].args[0].key).toEqual(key);
                expect(configReader.calls[0].args[0].$scope).toEqual(scope);
                expect(configReader.calls[0].args[0].scope).toEqual('s');
            });

            describe('on config reader success', function() {
                beforeEach(function() {
                    configReader.calls[0].args[0].success({value:'V'});
                });

                it('value is exposed on scope', function() {
                    expect(scope.value).toEqual('V');
                });

                describe('on submit', function() {
                    beforeEach(function() {
                        scope.submit();
                    });

                    it('config writer was executed', function() {
                        expect(configWriter.calls[0].args[0].$scope).toEqual(scope);
                        expect(configWriter.calls[0].args[0].scope).toEqual('s');
                        expect(configWriter.calls[0].args[0].key).toEqual(key);
                        expect(configWriter.calls[0].args[0].value).toEqual('V');
                    });

                    describe('on success', function() {
                        beforeEach(function() {
                            configWriter.calls[0].args[0].success();
                        });

                        it('test', inject(function(_topicMessageDispatcherMock_) {
                            expect(_topicMessageDispatcherMock_['system.success']).toEqual({
                                code:'config.item.updated',
                                default:'Config item was successfully updated'
                            });
                        }))
                    });
                });
            });
        });
    });
});

