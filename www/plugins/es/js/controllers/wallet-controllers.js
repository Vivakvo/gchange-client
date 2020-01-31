angular.module('cesium.es.wallet.controllers', ['cesium.es.services'])

  .config(function(PluginServiceProvider, csConfig) {
    'ngInject';

    var enable = csConfig.plugins && csConfig.plugins.es;
    if (enable) {
      PluginServiceProvider.extendState('app.view_wallet', {
          points: {
            'hero': {
              templateUrl: "plugins/es/templates/wallet/view_wallet_extend.html",
              controller: 'ESWalletLikesCtrl'
            },
            'after-general': {
              templateUrl: "plugins/es/templates/wallet/view_wallet_extend.html",
              controller: 'ESWalletViewCtrl'
            }
          }
        })
      ;
    }

  })

 .controller('ESWalletViewCtrl', ESWalletViewController)

 .controller('ESWalletLikesCtrl', ESWalletLikesController)

;

function ESWalletViewController($scope, $controller, $state, csWallet, esModals) {
  'ngInject';

  // Initialize the super class and extend it.
  angular.extend(this, $controller('ESExtensionCtrl', {$scope: $scope}));

  /* -- modals -- */

  $scope.showNewPageModal = function() {
    return esModals.showNewPage();
  };
}


function ESWalletLikesController($scope, $controller, esProfile) {
    'ngInject';

  $scope.options = $scope.options || {};
  $scope.options.like = {
    kinds: ['LIKE', 'STAR', 'FOLLOW', 'ABUSE'],
    service: esProfile.like
  };
  $scope.likeData = {
    likes: {},
    stars: {},
    follows: {},
    abuses: {}
  };

  $scope.canEdit = true; // Avoid to change like counter itself

  // Initialize the super class and extend it.
  angular.extend(this, $controller('ESExtensionCtrl', {$scope: $scope}));

  // Initialize the super class and extend it.
  angular.extend(this, $controller('ESLikesCtrl', {$scope: $scope}));

  // Load likes, when profile loaded
  $scope.$watch('formData.pubkey', function(pubkey) {
      if (pubkey) {
          $scope.loadLikes(pubkey);
      }
  });
}
