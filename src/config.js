angular.module('config', ['binartajs-angular1', 'notifications', 'rest.client', 'angular.usecase.adapter', 'checkpoint', 'toggle.edit.mode'])
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
    .factory('configReader', ['$log', 'binarta', 'restServiceHandler', 'usecaseAdapterFactory', 'config', ConfigReaderFactory])
    .factory('configWriter', ['usecaseAdapterFactory', 'restServiceHandler', 'config', ConfigWriterFactory])
    .directive('binConfig', ['configReader', 'configWriter', 'editModeRenderer', 'editMode', BinConfigDirectiveFactory])
    .directive('binConfigIf', ['config', 'configReader', BinConfigIfDirectiveFactory])
    .controller('binConfigController', ['$scope', 'configReader', 'configWriter', BinConfigController])
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

function ConfigReaderFactory($log, binarta, restServiceHandler, usecaseAdapterFactory, config) {
    return function (args) {
        if(args.scope == 'public')
            $log.warn('@deprecated - ConfigReader() - use binarta.application.config.findPublic() instead!');

        var context = args.$scope ? usecaseAdapterFactory(args.$scope) : {};
        context.params = {
            method: 'GET',
            url: config.baseUri + 'api/entity/config/' + args.key,
            params: {
                treatInputAsId: true,
                scope: args.scope || ''
            },
            withCredentials: true,
            headers: {
                'X-Namespace': config.namespace
            }
        };
        context.success = function (data) {
            if (args.scope == 'public') config[args.key] = data.value;
            if (args.success) args.success(data);
        };
        context.notFound = function () {
            if (args.notFound) args.notFound();
        };
        return restServiceHandler(context);
    }
}

function ConfigWriterFactory(usecaseAdapterFactory, restServiceHandler, config) {
    return function (args) {
        var context = args.$scope ? usecaseAdapterFactory(args.$scope) : {};
        context.params = {
            method: 'POST',
            url: config.baseUri + 'api/config',
            data: {
                id: args.key,
                value: !angular.isUndefined(args.value) ? args.value : '',
                scope: args.scope || ''
            },
            withCredentials: true,
            headers: {
                'X-Namespace': config.namespace
            }
        };
        context.success = function (data) {
            if (args.scope == 'public') config[args.key] = args.value;
            if (args.success) args.success(data);
        };
        return restServiceHandler(context);
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

    this.submit = function () {
        configWriter({
            $scope: $scope,
            key: key,
            value: $scope.config.value || '',
            scope: scope
        });
    };
}

function BinConfigDirectiveFactory(configReader, configWriter, editModeRenderer, editMode) {
    return {
        restrict: 'A',
        scope: true,
        link: function (scope, element, attrs) {
            scope.key = attrs.key;
            scope.scope = attrs.scope;
            scope.config = {};
            scope.inputType = attrs.inputType || 'text';
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
            var childScope, childElement;

            if (config[key] == undefined) {
                configReader({
                    $scope: scope,
                    key: key,
                    scope: 'public'
                });
            }

            scope.$watch(function () {
                return config[key] == scope.$eval(value);
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

        }
    }
}