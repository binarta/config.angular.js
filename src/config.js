angular.module('config', ['config.templates', 'binarta-applicationjs-angular1', 'notifications', 'rest.client', 'angular.usecase.adapter', 'checkpoint', 'toggle.edit.mode'])
    .provider('config', function configProvider() {
        var config = {};
        return {
            add: function (params) {
                Object.keys(params).forEach(function (k) {
                    config[k] = params[k];
                });
            },
            $get: function () {
                return config;
            }
        };
    })
    .directive('appConfig', ['config', 'topicMessageDispatcher', AppConfigDirectiveFactory])
    .factory('configReader', ['$log', '$q', 'binarta', 'config', ConfigReaderFactory])
    .factory('configWriter', ['$log', '$q', 'binarta', 'config', ConfigWriterFactory])
    .directive('binConfig', ['configReader', 'configWriter', 'editModeRenderer', 'editMode', 'binarta', BinConfigDirectiveFactory])
    .directive('binConfigIf', ['config', 'configReader', BinConfigIfDirectiveFactory])
    .controller('binConfigController', ['$scope', 'configReader', 'configWriter', BinConfigController])
    .component('binToggle', new BinToggleComponent())
    .run(['config', '$http', function (config, $http) {
        if (config.namespace) $http.defaults.headers.common['X-Namespace'] = config.namespace;
    }]);

function AppConfigDirectiveFactory(config, topicMessageDispatcher) {
    return {
        restrict: 'A',
        link: function (scope, els, attrs) {
            var expression = scope.$eval(attrs.appConfig);
            Object.keys(expression).forEach(function (k) {
                config[k] = expression[k];
            });
            scope.appConfig = config;
            topicMessageDispatcher.firePersistently('config.initialized', config);
            topicMessageDispatcher.firePersistently('app.start', 'ok');
        }
    };
}

function ConfigReaderFactory($log, $q, binarta, config) {
    return function (args) {
        $log.warn('@deprecated - ConfigReader() - use binarta.application.config.findPublic() or findSystem() instead!');
        var d = $q.defer();
        binarta.schedule(function () {
            if (args.scope == 'public') {
                binarta.application.config.findPublic(args.key, function (value) {
                    var data = {value: value};
                    var promiseData = {data: {value: value}};
                    config[args.key] = value;
                    if (value) {
                        if (args.success)
                            args.success(data);
                        d.resolve(promiseData);
                    } else {
                        if(args.notFound) args.notFound();
                        d.reject();
                    }
                });
            } else {
                binarta.application.config.findSystem(args.key, {
                    success: function (value) {
                        var data = {value: value};
                        var promiseData = {data: {value: value}};
                        if (value != '') {
                            if (args.success) args.success(data);
                            d.resolve(promiseData);
                        } else {
                            if (args.notFound) args.notFound();
                            d.reject();
                        }
                    }
                });
            }
        });
        return d.promise;
    }
}

function ConfigWriterFactory($log, $q, binarta, config) {
    return function (args) {
        $log.warn('@deprecated - ConfigWriter() - use binarta.application.config.addPublic() or addSystem() instead!');
        var d = $q.defer();
        binarta.schedule(function () {
            var request = {id: args.key, value: args.value};
            var response = {
                success: function (it) {
                    if (args.success) args.success(it);
                    d.resolve(it);
                }
            };
            if (args.scope == 'public') {
                var delegate = response.success;
                response.success = function (it) {
                    config[args.key] = it;
                    delegate(it);
                };
                binarta.application.config.addPublic(request, response);
            } else
                binarta.application.config.addSystem(request, response);
        });
        return d.promise;
    }
}

function BinConfigController($scope, configReader, configWriter) {
    var key, scope;

    this.init = function (args) {
        key = args.key;
        scope = args.scope || '';

        configReader({
            $scope: $scope,
            key: key,
            scope: scope,
            success: function (data) {
                $scope.config = data;
            }
        });
    };

    this.submit = function (value) {
        if (value !== undefined) $scope.config.value = value;
        configWriter({
            $scope: $scope,
            key: key,
            value: $scope.config.value || '',
            scope: scope
        });
    };
}

function BinConfigDirectiveFactory(configReader, configWriter, editModeRenderer, editMode, binarta) {
    return {
        restrict: 'A',
        scope: true,
        link: function (scope, element, attrs) {
            scope.key = attrs.key;
            scope.scope = attrs.scope;
            scope.config = {};
            scope.inputType = attrs.inputType || 'text';

            if (scope.scope == 'public')
                binarta.schedule(function () {
                    scope.$on('$destroy', binarta.application.config.observePublic(scope.key, function (value) {
                        scope.config = {value: value};
                    }).disconnect);
                });
            else
                configReader({
                    $scope: scope,
                    key: attrs.key,
                    scope: attrs.scope,
                    success: function (data) {
                        scope.config = data;
                    }
                });

            editMode.bindEvent({
                scope: scope,
                element: element,
                permission: 'config.store',
                onClick: open
            });

            function open() {
                var rendererScope = angular.extend(scope.$new(), {
                    close: function () {
                        editModeRenderer.close();
                    },
                    save: function (args) {
                        configWriter({
                            $scope: scope,
                            key: scope.key,
                            value: args.value || '',
                            scope: scope.scope || '',
                            success: function () {
                                editModeRenderer.close();
                                scope.config.value = args.value;
                            }
                        })
                    },
                    config: angular.copy(scope.config)
                });

                editModeRenderer.open({
                    template: '<form ng-submit="save(config)">' +
                    '<div class="bin-menu-edit-body">' +
                    '<div class="form-group">' +
                    '<label i18n read-only code="config.{{key}}.label" for="configEntry">{{var}}</label>' +
                    '<input type="{{inputType}}" id="configEntry" ng-model="config.value">' +
                    '<small i18n read-only code="config.{{key}}.info"><i class="fa fa-info-circle"></i> <span ng-bind-html="var"></span></small>' +
                    '</div>' +
                    '</div>' +
                    '<div class="bin-menu-edit-actions">' +
                    '<button type="submit" class="btn btn-primary" i18n code="clerk.menu.save.button" read-only>{{var}}</button>' +
                    '<button type="reset" class="btn btn-default" ng-click="close()" i18n code="clerk.menu.cancel.button" read-only>{{var}}</button>' +
                    '</div>' +
                    '</form>',
                    scope: rendererScope
                });
            }
        }
    }
}

function BinConfigIfDirectiveFactory(config, configReader) {
    return {
        restrict: 'A',
        transclude: 'element',
        priority: 600,
        link: function (scope, element, attrs, ctrl, transclude) {
            var key = attrs.binConfigIf;
            var value = attrs.equals;
            var expression = attrs.expression;
            var childScope, childElement;

            var strategy = expression != null ? new ExpressionStrategy(expression) : new ValueStrategy(value);

            if (config[key] == undefined) {
                configReader({
                    $scope: scope,
                    key: key,
                    scope: 'public'
                });
            }

            scope.$watch(function () {
                return strategy.evaluate(config[key]);
            }, function (value) {
                if (value) {
                    transclude(function (clone, newScope) {
                        childScope = newScope;
                        childElement = clone;
                        element.after(clone);
                    });
                } else {
                    if (childElement) {
                        childElement.remove();
                        childScope.$destroy();
                    }
                }
            });
            
            function ValueStrategy(expected) {
                this.evaluate = function(value) {
                    return value == scope.$eval(expected);
                }
            }
            
            function ExpressionStrategy(expression) {
                this.evaluate = function(value) {
                    return scope.$eval(expression, {$value: value});
                }
            }
        }
    }
}

function BinToggleComponent() {
    this.bindings = {
        value: '<',
        onChange: '&',
        onOff: '<'
    };
    this.templateUrl = 'bin-toggle.html';
    this.controller = [function () {
        var self = this;

        this.$onInit = function () {
            if (this.onOff === undefined) this.onOff = false;
        };

        this.change = function () {
            this.onChange({value: self.value})
        }
    }]
}