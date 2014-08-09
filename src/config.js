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
    .directive('appConfig', ['config', 'topicMessageDispatcher', AppConfigDirectiveFactory]);

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