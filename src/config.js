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
    .directive('binConfig', ['configReader', 'configWriter', 'binTemplate', 'topicMessageDispatcher', BinConfigDirectiveFactory])
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
        var context = usecaseAdapterFactory(args.scope);
        context.params = {
            method:'GET',
            url: config.baseUri + 'api/config/' + args.key,
            withCredentials:true
        };
        context.success = args.success;
        restServiceHandler(context);
    }
}

function ConfigWriterFactory(usecaseAdapterFactory, restServiceHandler, config) {
    return function(args) {
        var context = usecaseAdapterFactory(args.scope);
        context.params = {
            method:'POST',
            url: config.baseUri + 'api/config',
            data: {
                id: args.key,
                value: args.value
            },
            withCredentials: true
        };
        context.success = args.success;
        restServiceHandler(context);
    }
}

function BinConfigDirectiveFactory(configReader, configWriter, binTemplate, topicMessageDispatcher) {
    return {
        restrict:'ECA',
        scope:true,
        template: '<div ng-include="templateUrl"></div>',
        link: function(scope, els, attrs) {
            scope.key = attrs.key;
            scope.default = attrs.default;
            configReader({
                scope:scope,
                key:attrs.key,
                success: function(data) {
                    scope.value = data.value;
                }
            });

            scope.submit = function() {
                configWriter({
                    scope:scope,
                    key: attrs.key,
                    value: scope.value,
                    success: function() {
                        topicMessageDispatcher.fire('system.success', {
                            code:'config.item.updated',
                            default:'Config item was successfully updated'
                        })
                    }
                })
            };

            binTemplate.setTemplateUrl({
                scope:scope,
                module:'config',
                name:'config-entry.html',
                permission:'config.resolve'
            })
        }
    }
}