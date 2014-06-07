angular.module('config', [])
    .factory('config', [ConfigFactory])
    .directive('appConfig', ['config', 'topicMessageDispatcher', AppConfigDirectiveFactory]);

function ConfigFactory() {
    return {};
}

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