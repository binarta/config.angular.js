describe('config.js', function() {
    angular.module('testApp', function () {})
        .config(function (configProvider) {
            configProvider.add({
                key: 'value',
                foo: 'bar'
            });
            configProviderSpy = configProvider;
    });

    var config, scope = {}, dispatcher, rest;
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
        scope.$eval = function(it) {
            return it;
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

    describe('binConfigController', function () {
        var ctrl;
        var configReader = jasmine.createSpy('configReader');
        var configWriter = jasmine.createSpy('configWriter');
        var key = 'key';

        beforeEach(inject(function ($controller) {
            ctrl = $controller('binConfigController', {$scope: scope, configReader: configReader, configWriter: configWriter});
        }));

        afterEach(function() {
            configReader.reset();
            configWriter.reset();
        });

        describe('on init', function () {
            beforeEach(function () {
                ctrl.init({key: key, scope: 'public'});
            });

            it('reader puts value on scope', function () {
                expect(configReader.calls[0].args[0].key).toEqual(key);
                expect(configReader.calls[0].args[0].$scope).toEqual(scope);
                expect(configReader.calls[0].args[0].scope).toEqual('public');
            });

            describe('on config reader success', function() {
                beforeEach(function() {
                    configReader.calls[0].args[0].success({value:'value'});
                });

                it('value is exposed on scope', function() {
                    expect(scope.config).toEqual({value:'value'});
                });
            });

            describe('on submit', function () {
                beforeEach(function () {
                    scope.config.value = 'new value';
                    ctrl.submit();
                });

                function writer() {
                    return configWriter.calls[0].args[0];
                }

                it('then writer is executed', function() {
                    expect(writer().$scope).toEqual(scope);
                    expect(writer().key).toEqual(key);
                    expect(writer().value).toEqual('new value');
                    expect(writer().scope).toEqual('public');
                });
            });
        });
    });

    describe('bin-config', function() {
        var sut;
        var configReader = jasmine.createSpy('configReader');
        var configWriter = jasmine.createSpy('configWriter');
        var activeUserHasPermission = jasmine.createSpy('activeUserHasPermission');
        var editModeRenderer = jasmine.createSpyObj('editModeRenderer', ['open', 'close']);
        var child;
        var childScopeWasCreated = false;

        beforeEach(inject(function(ngRegisterTopicHandler) {
            child = {id:'child'};
            scope.id = 'scope';
            scope.$new = function() {
                childScopeWasCreated = true;
                return child;
            };
            sut = BinConfigDirectiveFactory(configReader, activeUserHasPermission, editModeRenderer, configWriter, ngRegisterTopicHandler);
        }));

        afterEach(function() {
            configReader.reset();
            configWriter.reset();
            activeUserHasPermission.reset();
        });

        it('restrict to classes attributes and elements', function() {
            expect(sut.restrict).toEqual('A');
        });

        it('scope is created', function() {
            expect(sut.scope).toBeTruthy();
        });

        describe('on link', function() {
            var key = 'K';
            var element;
            var event, cb;
            var isBound = false;

            beforeEach(function() {
                element = {
                    bind: function($event, $cb) {
                        event = $event;
                        cb = $cb;
                        isBound = true;
                    },
                    unbind: function($event) {
                        event = $event;
                        isBound = false;
                    }
                };
                sut.link(scope, element, {key:key, scope:'s', inputType:'t'})
            });

            afterEach(function() {
                event = undefined;
                cb = undefined;
            });

            it('key is exposed on scope', function() {
                expect(scope.key).toEqual(key);
            });

            it('config scope is exposed on scope', function() {
                expect(scope.scope).toEqual('s');
            });

            it('config is initialized empty', function() {
                expect(scope.config).toEqual({});
            });

            it('input type is exposed on scope', function() {
                expect(scope.inputType).toEqual('t');
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
                    expect(scope.config).toEqual({value:'V'});
                });
            });

            it('permission check did not happen', function() {
                expect(activeUserHasPermission.calls[0]).toBeUndefined();
            });

            describe('and edit.mode is toggled on', function() {
                beforeEach(inject(function(topicRegistryMock) {
                    topicRegistryMock['edit.mode'](true);
                }));

                it('scope is passed', function() {
                    expect(activeUserHasPermission.calls[0].args[0].scope).toEqual(scope);
                });

                it('we check for config.store permission', function() {
                    expect(activeUserHasPermission.calls[0].args[1]).toEqual('config.store');
                });

                describe('when permitted', function() {
                    beforeEach(function() {
                        activeUserHasPermission.calls[0].args[0].yes();
                    });

                    it('we bound to click event', function() {
                        expect(event).toEqual('click');
                    });

                    describe('and when click is fired', function() {
                        beforeEach(function() {
                            cb();
                        });

                        function renderer() {
                            return editModeRenderer.open.calls[0].args[0];
                        }

                        it('template is passed to edit mode renderer', function() {
                            expect(renderer().template).toEqual(jasmine.any(String));
                        });

                        it('child scope is passed to edit mode renderer', function() {
                            expect(childScopeWasCreated).toBeTruthy();
                            expect(renderer().scope.id).toEqual('child');
                        });

                        it('edit mode renderer scope receives copy of config from parent scope', function() {
                            expect(renderer().scope.config).toEqual(scope.config);
                        });

                        describe('and close is fired', function() {
                            beforeEach(function() {
                                child.close();
                            });

                            it('then edit mode renderer is closed', function() {
                                expect(editModeRenderer.close.calls[0]).toBeDefined();
                            });
                        });

                        describe('and save is fired', function() {
                            beforeEach(function() {
                                child.save({value:'W'});
                            });

                            function writer() {
                                return configWriter.calls[0].args[0];
                            }

                            it('then writer is executed', function() {
                                expect(writer().$scope.id).toEqual('scope');
                                expect(writer().key).toEqual(scope.key);
                                expect(writer().value).toEqual('W');
                                expect(writer().scope).toEqual('s');
                            });

                            describe('and on success', function() {
                                beforeEach(function() {
                                    editModeRenderer.close.reset();
                                    writer().success();
                                });

                                it('renderer was closed', function() {
                                    expect(editModeRenderer.close.calls[0]).toBeDefined();
                                });

                                it('updated value was exposed on scope', function() {
                                    expect(scope.config.value).toEqual('W');
                                })
                            });
                        });
                    });

                    describe('and edit.mode is toggled off', function() {
                        beforeEach(inject(function(topicRegistryMock) {
                            topicRegistryMock['edit.mode'](false);
                        }));

                        describe('and we are permitted', function() {
                            beforeEach(function() {
                                activeUserHasPermission.calls[1].args[0].yes();
                            });

                            it('then we unbind from click', function() {
                                expect(event).toEqual('click');
                                expect(isBound).toBeFalsy();
                            })
                        });
                    });
                });

                describe('when not permitted', function() {
                    beforeEach(function() {
                        activeUserHasPermission.calls[0].args[0].no();
                    });

                    it('then click is unbound', function() {
                        expect(event).toEqual('click');
                        expect(isBound).toBeFalsy();
                    })
                });
            });

            it('when linking without input type we default to text', function() {
                sut.link(scope, element, {key:key, scope:'s'});

                expect(scope.inputType).toEqual('text');
            })
        });
    });
});

