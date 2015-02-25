angular.module('config', [])
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
    .factory('configReader', ['restServiceHandler', 'usecaseAdapterFactory', 'config', ConfigReaderFactory])
    .factory('configWriter', ['usecaseAdapterFactory', 'restServiceHandler', 'config', ConfigWriterFactory])
    .directive('binConfig', ['configReader', 'activeUserHasPermission', 'editModeRenderer', 'configWriter', BinConfigDirectiveFactory])
    .run(['config', '$http', function(config, $http) {
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

function ConfigReaderFactory(restServiceHandler, usecaseAdapterFactory, config) {
    return function(args) {
        var context = usecaseAdapterFactory(args.$scope);
        context.params = {
            method:'GET',
            url: config.baseUri + 'api/entity/config/' + args.key,
            params: {
                treatInputAsId:true,
                scope:args.scope || ''
            },
            withCredentials:true
        };
        context.success = args.success;
        restServiceHandler(context);
    }
}

function ConfigWriterFactory(usecaseAdapterFactory, restServiceHandler, config) {
    return function(args) {
        var context = usecaseAdapterFactory(args.$scope);
        context.params = {
            method:'POST',
            url: config.baseUri + 'api/config',
            data: {
                id: args.key,
                value: args.value || '',
                scope: args.scope || ''
            },
            withCredentials: true
        };
        context.success = args.success;
        restServiceHandler(context);
    }
}

function BinConfigDirectiveFactory(configReader, activeUserHasPermission, editModeRenderer, configWriter) {
    return {
        restrict:'A',
        scope:true,
        link: function(scope, element, attrs) {
            scope.key = attrs.key;
            scope.scope = attrs.scope;
            configReader({
                $scope:scope,
                key:attrs.key,
                scope:attrs.scope,
                success: function(data) {
                    scope.config = data;
                    activeUserHasPermission({
                        yes: function() {
                            element.bind('click', scope.open);
                        }
                    }, 'config.store');
                }
            });

            scope.open = function() {
                var child = scope.$new();
                child.close = function() {
                    editModeRenderer.close();
                };
                child.save = function(args) {
                    configWriter({
                        $scope:scope,
                        key:scope.key,
                        value: args.value || '',
                        scope: scope.scope || '',
                        success: function() {
                            editModeRenderer.close();
                            scope.config.value = args.value;
                        }
                    })
                };
                child.config = angular.copy(scope.config);
                editModeRenderer.open({
                    template:'<form>' +
                    '<div class="form-group">' +
                    '<label i18n read-only code="config.{{key}}.name" for="configEntry">{{var}}</label>' +
                    '<input type="text" id="configEntry" ng-model="config.value">' +
                    '<small i18n read-only code="config.{{key}}.description"><i class="fa fa-info-circle"></i> {{var}}</small>' +
                    '</div>' +
                    '</form>' +

                    '<div class="dropdown-menu-buttons">' +
                    '<button type="submit" class="btn btn-primary" ng-click="save(config)">Opslaan</button>' +
                    '<button type="reset" class="btn btn-default" ng-click="close()">Annuleren</button>' +
                    '</div>',
                    scope:child
                });
            }
        }
    }
}