describe('config.js', function () {
    angular.module('binarta-alljs-tpls-angular1', []);
    angular.module('testApp', [])
        .config(function (configProvider) {
            configProvider.add({
                key: 'value',
                foo: 'bar'
            });
            configProviderSpy = configProvider;
        });

    var $rootScope, binarta, config, scope = {}, dispatcher, rest, response;
    var configProviderSpy;
    var baseUri = 'B/';

    angular.module('checkpoint', []);
    angular.module('toggle.edit.mode', []);

    beforeEach(module('config'));
    beforeEach(module('rest.client'));
    beforeEach(module('notifications'));
    beforeEach(module('angular.usecase.adapter'));
    beforeEach(module('testApp'));

    afterEach(function() {
        sessionStorage.removeItem('binarta:config:K');
    });

    describe('isolate injection', function () {
        beforeEach(inject(function (_$rootScope_, _binarta_, _restServiceHandler_, _config_) {
            $rootScope = _$rootScope_;
            binarta = _binarta_;
            rest = _restServiceHandler_;
            rest.and.returnValue({
                success: function () {
                }
            });
            config = _config_;
            config.namespace = 'namespace';
            _config_.baseUri = baseUri;
            scope.$eval = function (it) {
                return it;
            };
            dispatcher = {
                firePersistently: function (topic, msg) {
                    dispatcher[topic] = msg;
                }
            };
            response = jasmine.createSpyObj('response', ['success']);

            binarta.application.gateway.updateApplicationProfile({supportedLanguages: ['en', 'nl']});
            binarta.application.refresh();
            binarta.application.setLocaleForPresentation('en');
        }));

        function request() {
            return rest.calls.first().args[0];
        }

        describe('config provider', function () {
            it('config param is available', inject(function (config) {
                expect(config.key).toEqual('value');
                expect(config.foo).toEqual('bar');
            }));
        });

        describe('app-config directive', function () {
            var directive, element, attrs, registry;

            beforeEach(function () {
                attrs = {};
                registry = {};
                directive = AppConfigDirectiveFactory(registry, dispatcher);
            });

            it('restrict', function () {
                expect(directive.restrict).toEqual('A');
            });

            describe('when linked', function () {
                beforeEach(function () {
                    attrs.appConfig = {key: 'value'};
                    directive.link(scope, element, attrs);
                });

                it('installs config in registry', function () {
                    expect(registry).toEqual(attrs.appConfig);
                });

                it('expose config on scope', function () {
                    expect(scope.appConfig).toEqual({key: 'value'});
                });

                it('raises config.initialized event with the current config as payload', function () {
                    expect(dispatcher['config.initialized']).toEqual(attrs.appConfig);
                });

                it('raises app.start event to inform components configuration has been set, delivered to all interested components and are ready for use', function () {
                    expect(dispatcher['app.start']).toEqual('ok');
                });
            });
        });

        describe('config reader', function () {
            var sut, usecaseAdapterFactory;
            var success, notFound;

            beforeEach(inject(function (_configReader_, _usecaseAdapterFactory_) {
                sut = _configReader_;
                usecaseAdapterFactory = _usecaseAdapterFactory_;

                binarta.application.gateway.addConfig({scope: 'public', id: 'K', value: 'P'});
                binarta.application.gateway.addConfig({scope: 'system', id: 'K', value: 'S'});
                binarta.application.refresh();
            }));

            function readKnownSystemConfig() {
                return sut({
                    $scope: scope,
                    key: 'K',
                    success: function (data) {
                        success = data
                    },
                    notFound: function () {
                        notFound = true;
                    }
                });
            }

            function readUnknownSystemConfig() {
                return sut({
                    $scope: scope,
                    key: '-',
                    success: function (data) {
                        success = data
                    },
                    notFound: function () {
                        notFound = true;
                    }
                });
            }

            function readKnownPublicConfig() {
                return sut({
                    $scope: scope,
                    scope: 'public',
                    key: 'K',
                    success: function (data) {
                        success = data
                    },
                    notFound: function () {
                        notFound = true;
                    }
                });
            }

            function readUnknownPublicConfig() {
                return sut({
                    $scope: scope,
                    scope: 'public',
                    key: '-',
                    success: function (data) {
                        success = data
                    },
                    notFound: function () {
                        notFound = true;
                    }
                });
            }

            it('service returns promise', function () {
                var value;
                readKnownSystemConfig().then(function (it) {
                    value = it;
                });
                $rootScope.$digest();
                expect(value).toEqual({data: {value: 'S'}});
            });

            describe('on success', function () {
                beforeEach(function () {
                    readKnownSystemConfig();
                });

                it('payload is passed to success handler', function () {
                    expect(success).toEqual({value: 'S'});
                });

                it('and config value is not public, value is not on config provider', function () {
                    expect(config['K']).toBeUndefined();
                });

                describe('and config value is public', function () {
                    it('update value on config provider', function () {
                        readKnownPublicConfig();
                        expect(config['K']).toEqual('P');
                    });

                    it('resolves promise when known', function () {
                        var value;
                        readKnownPublicConfig().then(function (it) {
                            value = it;
                        });
                        $rootScope.$digest();
                        expect(value).toEqual({data: {value: 'P'}});
                    });

                    it('rejects promise when unknown', function () {
                        var rejected = false;
                        readUnknownPublicConfig().then(function () {
                        }, function () {
                            rejected = true;
                        });
                        $rootScope.$digest();
                        expect(rejected).toBeTruthy();
                    });

                    it('notFound handler is executed when unknown', function () {
                        readUnknownPublicConfig();
                        expect(notFound).toBeTruthy();
                    });
                });
            });

            describe('on not found', function () {
                it('notFound handler is optional', function () {
                    sut({key: '-'});
                    sut({scope:'public', key: '-'});
                });

                it('notFound handler is executed', function () {
                    readUnknownSystemConfig();
                    expect(notFound).toBeTruthy();
                });

                it('promise is rejected', function () {
                    var rejected = false;
                    readUnknownSystemConfig().then(function () {
                    }, function () {
                        rejected = true;
                    });
                    $rootScope.$digest();
                    expect(rejected).toBeTruthy();
                });
            });
        });

        describe('config writer', function () {
            var sut, usecaseAdapterFactory;
            var success;

            function writeToPublicScope() {
                return sut({
                    $scope: scope,
                    key: 'K',
                    value: 'V',
                    scope: 'public',
                    success: function (data) {
                        success = data
                    }
                });
            }

            function writeToSystemScope() {
                return sut({
                    $scope: scope,
                    key: 'K',
                    value: 'V',
                    success: function (data) {
                        success = data
                    }
                });
            }

            beforeEach(inject(function (_configWriter_, _usecaseAdapterFactory_) {
                sut = _configWriter_;
                usecaseAdapterFactory = _usecaseAdapterFactory_;
            }));

            it('service returns promise for public scope', function () {
                var value;
                writeToPublicScope().then(function (it) {
                    value = it;
                });
                $rootScope.$digest();
                expect(value).toEqual('V');
            });

            it('service returns promise for system scope', function () {
                var value;
                writeToSystemScope().then(function (it) {
                    value = it;
                });
                $rootScope.$digest();
                expect(value).toEqual('V');
            });

            it('0 values can be stored in config and will not be considered as not found when reading', function () {
                sut({key: 'K', value: 0});
                binarta.application.config.findSystem('K', response);
                expect(response.success).toHaveBeenCalledWith(0);
            });

            it('$scope is optional', function () {
                sut({
                    key: 'K',
                    value: 'V'
                });

                expect(usecaseAdapterFactory).not.toHaveBeenCalled();
            });

            describe('on write to public success', function () {
                beforeEach(function () {
                    writeToPublicScope();
                });

                it('then success handler receives config value', function () {
                    expect(success).toEqual('V');
                });

                it('then binarta.application.config caches the key-value pair', function () {
                    var spy = jasmine.createSpy('on-success-handler');
                    binarta.application.config.findPublic('K', spy);
                    expect(spy).toHaveBeenCalledWith('V');
                });

                it('and config value is public update value on config provider', function () {
                    sut({
                        $scope: scope,
                        key: 'K',
                        value: 'D',
                        scope: 'public'
                    });
                    expect(config['K']).toEqual('D');
                });
            });

            describe('on write to system success', function () {
                beforeEach(function () {
                    writeToSystemScope();
                });

                it('then success handler receives config value', function () {
                    expect(success).toEqual('V');
                });

                it('value is not on config provider', function () {
                    expect(config['K']).toBeUndefined();
                });
            });
        });

        describe('binConfigController', function () {
            var ctrl;
            var configReader = jasmine.createSpy('configReader');
            var configWriter = jasmine.createSpy('configWriter');
            var key = 'key';

            beforeEach(inject(function ($controller) {
                ctrl = $controller('binConfigController', {
                    $scope: scope,
                    configReader: configReader,
                    configWriter: configWriter
                });
            }));

            afterEach(function () {
                configReader.calls.reset();
                configWriter.calls.reset();
            });

            describe('on init', function () {
                beforeEach(function () {
                    ctrl.init({key: key, scope: 'public'});
                });

                it('reader puts value on scope', function () {
                    expect(configReader.calls.first().args[0].key).toEqual(key);
                    expect(configReader.calls.first().args[0].$scope).toEqual(scope);
                    expect(configReader.calls.first().args[0].scope).toEqual('public');
                });


                describe('on config reader success', function () {
                    beforeEach(function () {
                        configReader.calls.first().args[0].success({value: 'value'});
                    });

                    it('value is exposed on scope', function () {
                        expect(scope.config).toEqual({value: 'value'});
                    });

                    describe('and on submit', function () {
                        beforeEach(function () {
                            scope.config.value = 'new value';
                            ctrl.submit();
                        });


                        it('then writer is executed', function () {
                            expect(writer().$scope).toEqual(scope);
                            expect(writer().key).toEqual(key);
                            expect(writer().value).toEqual('new value');
                            expect(writer().scope).toEqual('public');
                        });
                    });

                    describe('and on submit with new value', function () {
                        beforeEach(function () {
                            ctrl.submit('new value');
                        });

                        it('new value was exposed on scope', function () {
                            expect(scope.config.value).toEqual('new value');
                        });

                        it('then writer is executed', function () {
                            expect(writer().$scope).toEqual(scope);
                            expect(writer().key).toEqual(key);
                            expect(writer().value).toEqual('new value');
                            expect(writer().scope).toEqual('public');
                        })
                    });
                });

                function writer() {
                    return configWriter.calls.first().args[0];
                }

            });
        });

        describe('bin-config directive', function () {
            var sut;
            var configReader = jasmine.createSpy('configReader');
            var configWriter = jasmine.createSpy('configWriter');
            var editModeRenderer = jasmine.createSpyObj('editModeRenderer', ['open', 'close']);
            var child;
            var childScopeWasCreated = false;
            var editMode = jasmine.createSpyObj('editMode', ['bindEvent']);

            beforeEach(function () {
                child = {id: 'child'};
                scope.id = 'scope';
                scope.$new = function () {
                    childScopeWasCreated = true;
                    return child;
                };
                sut = BinConfigDirectiveFactory(configReader, configWriter, editModeRenderer, editMode);
            });

            afterEach(function () {
                configReader.calls.reset();
                configWriter.calls.reset();
            });

            it('restrict to classes attributes and elements', function () {
                expect(sut.restrict).toEqual('A');
            });

            it('scope is created', function () {
                expect(sut.scope).toBeTruthy();
            });

            describe('on link', function () {
                var key = 'K';
                var element = 'element';
                var event, cb;
                var isBound = false;

                beforeEach(function () {
                    sut.link(scope, element, {key: key, scope: 's', inputType: 't'})
                });

                afterEach(function () {
                    event = undefined;
                });

                it('key is exposed on scope', function () {
                    expect(scope.key).toEqual(key);
                });

                it('config scope is exposed on scope', function () {
                    expect(scope.scope).toEqual('s');
                });

                it('config is initialized empty', function () {
                    expect(scope.config).toEqual({});
                });

                it('input type is exposed on scope', function () {
                    expect(scope.inputType).toEqual('t');
                });

                it('config reader is called', function () {
                    expect(configReader.calls.first().args[0].key).toEqual(key);
                    expect(configReader.calls.first().args[0].$scope).toEqual(scope);
                    expect(configReader.calls.first().args[0].scope).toEqual('s');
                });

                describe('on config reader success', function () {
                    beforeEach(function () {
                        configReader.calls.first().args[0].success({value: 'V'});
                    });

                    it('value is exposed on scope', function () {
                        expect(scope.config).toEqual({value: 'V'});
                    });
                });

                it('install editMode event binder', function () {
                    expect(editMode.bindEvent).toHaveBeenCalledWith({
                        scope: scope,
                        element: element,
                        permission: 'config.store',
                        onClick: jasmine.any(Function)
                    });
                });

                describe('and when click is fired', function () {
                    beforeEach(function () {
                        editMode.bindEvent.calls.first().args[0].onClick();
                    });

                    function renderer() {
                        return editModeRenderer.open.calls.first().args[0];
                    }

                    it('template is passed to edit mode renderer', function () {
                        expect(renderer().template).toEqual(jasmine.any(String));
                    });

                    it('child scope is passed to edit mode renderer', function () {
                        expect(childScopeWasCreated).toBeTruthy();
                        expect(renderer().scope.id).toEqual('child');
                    });

                    it('edit mode renderer scope receives copy of config from parent scope', function () {
                        expect(renderer().scope.config).toEqual(scope.config);
                    });

                    describe('and close is fired', function () {
                        beforeEach(function () {
                            child.close();
                        });

                        it('then edit mode renderer is closed', function () {
                            expect(editModeRenderer.close.calls.first()).toBeDefined();
                        });
                    });

                    describe('and save is fired', function () {
                        beforeEach(function () {
                            child.save({value: 'W'});
                        });

                        function writer() {
                            return configWriter.calls.first().args[0];
                        }

                        it('then writer is executed', function () {
                            expect(writer().$scope.id).toEqual('scope');
                            expect(writer().key).toEqual(scope.key);
                            expect(writer().value).toEqual('W');
                            expect(writer().scope).toEqual('s');
                        });

                        describe('and on success', function () {
                            beforeEach(function () {
                                editModeRenderer.close.calls.reset();
                                writer().success();
                            });

                            it('renderer was closed', function () {
                                expect(editModeRenderer.close.calls.first()).toBeDefined();
                            });

                            it('updated value was exposed on scope', function () {
                                expect(scope.config.value).toEqual('W');
                            })
                        });
                    });
                });

                it('when linking without input type we default to text', function () {
                    sut.link(scope, element, {key: key, scope: 's'});

                    expect(scope.inputType).toEqual('text');
                })
            });
        });

        describe('binToggle', function () {
            var $componentController;
            var bindings;
            var component;
            var capturedValue;

            beforeEach(inject(function (_$componentController_) {
                bindings = {
                    value: 'value',
                    onChange: function (value) {
                        capturedValue = value;
                    }
                };
                $componentController = _$componentController_;
                component = $componentController('binToggle', null, bindings);
            }));

            it('onOff can be configured', function () {
                bindings.onOff = true;
                component = $componentController('binToggle', null, bindings);
                component.$onInit();
                expect(component.onOff).toEqual(true);
            });

            describe('upon construction', function () {
                beforeEach(function () {
                    component.$onInit();
                });

                it('onOff defaults to false', function () {
                    expect(component.onOff).toEqual(false);
                });

                describe('and change()', function () {
                    beforeEach(function () {
                        component.change();
                    });

                    it('then output function is called with available context', function () {
                        expect(capturedValue).toEqual({value: component.value});
                    })
                });
            });
        });

    });

    describe('bin-config-if directive', function () {
        var html, scope, config, $rootScope, $compile, node, contents, configReader, configReaderSpy, configReaderDeferred;

        beforeEach(function () {
            module(function ($provide) {
                $provide.factory('configReader', ['$q', function ($q) {
                    return function(args) {
                        configReaderDeferred = $q.defer();
                        configReaderSpy = args;
                        return configReaderDeferred.promise;
                    }
                }]);
            });
        });

        function hasTranscludedContent() {
            expect(node.children().length).toBe(1);
            expect(contents[1].firstChild.nodeValue).toEqual('transcluded content');
        }

        function hasNoTranscludedContent() {
            expect(node.children().length).toBe(0);
        }

        function checkContent() {
            scope.$apply();
            contents = node.contents();
        }

        beforeEach(inject(function (_config_, _$rootScope_, _$compile_) {
            config = _config_;
            $rootScope = _$rootScope_;
            scope = $rootScope.$new();
            $compile = _$compile_;

            html = '<div><div bin-config-if="key" equals="\'new-value\'">{{"transcluded content"}}</div></div>';
        }));

        describe('with expression', function() {
            beforeEach(function() {
                html = '<div><div bin-config-if="key" expression="$value == \'new-value\'">transcluded content</div></div>';
            });

            it('transcludes the content when the simple expression is true', function() {
                config.key = 'new-value';
                node = $compile(html)(scope);
                checkContent();

                hasTranscludedContent();
            });

            it('does not transclude the content when the simple expression is false', function() {
                config.key = 'wrong-value';
                node = $compile(html)(scope);
                checkContent();

                hasNoTranscludedContent();
            });

            it('transcludes the content when a complex expression is used', function() {
                config.key = '';
                html = '<div><div bin-config-if="key" expression="$value == \'\' || $value == \'true\'">transcluded content</div></div>';
                node = $compile(html)(scope);
                checkContent();

                hasTranscludedContent();

                config.key = 'false';
                checkContent();

                hasNoTranscludedContent();

                config.key = 'true';
                checkContent();

                hasTranscludedContent();
            });
        });

        describe('true case', function () {
            beforeEach(function () {
                config.key = 'new-value';
                node = $compile(html)(scope);
                checkContent();
            });

            it('transcluded content is compiled', function () {
                hasTranscludedContent();
            });

            it('and value changed', function () {
                config.key = 'changed';
                scope.$apply();

                hasNoTranscludedContent();
            });
        });

        describe('false case', function () {
            beforeEach(function () {
                config.value = false;
                node = $compile(html)(scope);
                checkContent();
            });

            it('no transcluded content', function () {
                hasNoTranscludedContent();
            });
        });

        describe('when key is not in config', function () {
            beforeEach(function () {
                config.key = undefined;
            });

            it('retrieve from configReader', function () {
                node = $compile(html)(scope);

                expect(configReaderSpy).toEqual({
                    $scope: scope,
                    key: 'key',
                    scope: 'public'
                });
            });

            it('does not trigger change detection before a value is retrieved', function() {
                node = $compile(html)(scope);
                checkContent();

                hasNoTranscludedContent();

                expect(configReaderSpy).toEqual({
                    $scope: scope,
                    key: 'key',
                    scope: 'public'
                });

                config.key = 'new-value';
                hasNoTranscludedContent();

                configReaderDeferred.resolve();
                checkContent();
                hasTranscludedContent();
            })
        });
    });
});

