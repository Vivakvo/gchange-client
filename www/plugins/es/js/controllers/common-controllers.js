angular.module('cesium.es.common.controllers', ['ngResource', 'cesium.es.services'])

  .controller('ESPicturesEditCtrl', ESPicturesEditController)

  .controller('ESPicturesEditCtrl', ESPicturesEditController)

  .controller('ESSocialsEditCtrl', ESSocialsEditController)

  .controller('ESSocialsViewCtrl', ESSocialsViewController)

  .controller('ESCommentsCtrl', ESCommentsController)

  .controller('ESCategoryModalCtrl', ESCategoryModalController)

  .controller('ESAvatarModalCtrl', ESAvatarModalController)

  .controller('ESPositionEditCtrl', ESPositionEditController)

  .controller('ESLookupPositionCtrl', ESLookupPositionController)

  .controller('ESSearchPositionItemCtrl', ESSearchPositionItemController)

  .controller('ESSearchPositionModalCtrl', ESSearchPositionModalController)

  .controller('ESLikesCtrl', ESLikesController)
;


function ESPicturesEditController($scope, UIUtils, $q, Device) {
    'ngInject';

    $scope.selectNewPicture = function(inputSelector) {
        if (Device.enable){
            $scope.openPicturePopup();
        }
        else {
            var fileInput = angular.element(document.querySelector(inputSelector||'#pictureFile'));
            if (fileInput && fileInput.length > 0) {
                fileInput[0].click();
            }
        }
    };

    $scope.openPicturePopup = function() {
        Device.camera.getPicture()
            .then(function(imageData) {
                $scope.pictures.push({
                    src: "data:image/png;base64," + imageData,
                    isnew: true // use to prevent visibility hidden (if animation)
                });
            })
            .catch(UIUtils.onError('ERROR.TAKE_PICTURE_FAILED'));
    };

    $scope.fileChanged = function(event) {
        if (!event.target.files || !event.target.files.length) return;
        UIUtils.loading.show();
        var file = event.target.files[0];
        return UIUtils.image.resizeFile(file)
          .then(function(imageData) {
            $scope.pictures.push({
              src: imageData,
              isnew: true // use to prevent visibility hidden (if animation)
            });
            event.target.value = ""; // reset input[type=file]
            UIUtils.loading.hide(100);
          })
          .catch(function(err) {
              console.error(err);
              event.target.value = ""; // reset input[type=file]
              UIUtils.loading.hide();
          });
    };

    $scope.removePicture = function(index){
        $scope.pictures.splice(index, 1);
    };

    $scope.favoritePicture = function(index){
        if (index > 0) {
            var item = $scope.pictures[index];
            $scope.pictures.splice(index, 1);
            $scope.pictures.splice(0, 0, item);
        }
    };

    $scope.rotatePicture = function(index){
        var item = $scope.pictures[index];
        UIUtils.image.rotateSrc(item.src)
            .then(function(dataURL){
                item.src = dataURL;
            });
    };
}


function ESCategoryModalController($scope, UIUtils, $timeout, parameters) {
    'ngInject';

    $scope.loading = true;
    $scope.allCategories = [];
    $scope.categories = [];
    this.searchText = '';

    // modal title
    this.title = parameters && parameters.title;

    $scope.afterLoad = function(result) {
        $scope.categories = result;
        $scope.allCategories = result;
        $scope.loading = false;
        $timeout(function() {
            UIUtils.ink();
        }, 10);
    };

    this.doSearch = function() {
        var searchText = this.searchText.toLowerCase().trim();
        if (searchText.length > 1) {
            $scope.loading = true;
            $scope.categories = $scope.allCategories.reduce(function(result, cat) {
                if (cat.parent && cat.name.toLowerCase().search(searchText) != -1) {
                    return result.concat(cat);
                }
                return result;
            }, []);

            $scope.loading = false;
        }
        else {
            $scope.categories = $scope.allCategories;
        }
    };

    // load categories
    if (parameters && parameters.categories) {
        $scope.afterLoad(parameters.categories);
    }
    else if (parameters && parameters.load) {
        parameters.load()
            .then(function(res){
                $scope.afterLoad(res);
            });
    }

}



function ESCommentsController($scope, $filter, $state, $focus, $timeout, $anchorScroll, UIUtils) {
    'ngInject';

    $scope.loading = true;
    $scope.defaultCommentSize = 5;
    $scope.formData = {};
    $scope.comments = {};

    $scope.$on('$recordView.enter', function(e, state) {
        // First enter
        if ($scope.loading) {
            $scope.anchor = state && state.stateParams.anchor;
        }
        // second call (when using cached view)
        else if ($scope.id) {
            $scope.load($scope.id, {animate: false});
        }
    });

    $scope.$on('$recordView.load', function(event, id, service) {
        $scope.id = id || $scope.id;
        $scope.service = service.comment || $scope.service;
        console.debug("[ES] [comment] Will use {" + $scope.service.index + "} service");
        if ($scope.id) {
            $scope.load($scope.id)
              .then(function() {
                  return $timeout(function() {
                      // Scroll to anchor
                      $scope.scrollToAnchor();
                  }, 500);
              });
        }
    });

    $scope.load = function(id, options) {
        options = options || {};
        options.from = options.from || 0;
        // If anchor has been defined, load all comments
        options.size = options.size || ($scope.anchor && -1/*all*/);
        options.size = options.size || $scope.defaultCommentSize;
        options.animate = angular.isDefined(options.animate) ? options.animate : true;
        options.loadAvatarAllParent = angular.isDefined(options.loadAvatarAllParent) ? options.loadAvatarAllParent : true;
        $scope.loading = true;
        return $scope.service.load(id, options)
            .then(function(data) {
                if (!options.animate && data.result.length) {
                    _.forEach(data.result, function(cmt) {
                        cmt.isnew = true;
                    });
                }
                $scope.comments = data;
                $scope.comments.hasMore = (data.total > data.result.length);
                $scope.loading = false;
                $scope.service.changes.start(id, data, $scope);

                // Set Motion
                $scope.motion.show({
                    selector: '.comments .item',
                    ink: false
                });
            });
    };

    $scope.$on('$recordView.beforeLeave', function(){
        if ($scope.comments) {
            if (!$scope.service) {
                console.error('[comment] Comment controller has no service ! Unable to listen changes...');
                return;
            }
            $scope.service.changes.stop($scope.comments);
        }
    });

    $scope.scrollToAnchor = function() {
        if (!$scope.anchor) return;
        var elemList = document.getElementsByName($scope.anchor);
        // Waiting for the element
        if (!elemList || !elemList.length) {
            return $timeout($scope.scrollToAnchor, 500);
        }
        // If many, remove all anchor except the last one
        for (var i = 0; i<elemList.length-1; i++) {
            angular.element(elemList[i]).remove();
        }
        // Scroll to the anchor
        $anchorScroll($scope.anchor);
        // Remove the anchor. This will the CSS class 'positive-100-bg' on the comment
        $timeout(function () {
            $scope.anchor = null;
        }, 1500);
    };

    $scope.showMore = function(){
        var from = 0;
        var size = -1;
        $scope.load($scope.id, {from: from, size: size, loadAvatarAllParent: false})
            .then(function() {
                // Set Motion
                $scope.motion.show({
                    selector: '.card-avatar'
                });
            });
    };

    $scope.onKeypress = function(event) {
        // If Ctrl + Enter: submit
      if (event && event.charCode == 10 && event.ctrlKey) {
        $scope.save();
        event.preventDefault();
      }
    };

    $scope.save = function() {
        if (!$scope.formData.message || !$scope.formData.message.length) return;

        $scope.loadWallet({minData: true, auth: true})
            .then(function() {
                UIUtils.loading.hide();
                var comment = $scope.formData;
                $scope.formData = {};
                $scope.focusNewComment();
                return $scope.service.save($scope.id, $scope.comments, comment);
            })
            .then(function() {
                $scope.comments.total++;
            })
            .catch(UIUtils.onError('COMMENTS.ERROR.FAILED_SAVE_COMMENT'));
    };

    $scope.share = function(event, comment) {
        var params = angular.copy($state.params);
        var stateUrl;
        if (params.anchor) {
            params.anchor= $filter('formatHash')(comment.id);
            stateUrl = $state.href($state.current.name, params, {absolute: true});
        }
        else {
            stateUrl = $state.href($state.current.name, params, {absolute: true}) + '/' + $filter('formatHash')(comment.id);
        }
        var index = _.findIndex($scope.comments.result, {id: comment.id});
        var url = stateUrl + '?u=' + (comment.uid||$filter('formatPubkey')(comment.issuer));
        UIUtils.popover.show(event, {
            templateUrl: 'templates/common/popover_share.html',
            scope: $scope,
            bindings: {
                titleKey: 'COMMENTS.POPOVER_SHARE_TITLE',
                titleValues: {number: index ? index + 1 : 1},
                date: comment.creationTime,
                value: url,
                postUrl: stateUrl,
                postMessage: comment.message
            },
            autoselect: '.popover-share input'
        });
    };

    $scope.edit = function(comment) {
        var newComment = new Comment();
        newComment.copy(comment);
        $scope.formData = newComment;
    };

    $scope.remove = function(comment) {
        if (!comment) {return;}
        comment.remove();
        $scope.comments.total--;
    };

    $scope.reply = function(parent) {
        if (!parent || !parent.id) {return;}

        $scope.formData = {
            parent: parent
        };

        $scope.focusNewComment(true);
    };

    $scope.cancel = function() {
        $scope.formData = {};
        $scope.focusNewComment();
    };

    $scope.focusNewComment = function(forceIfSmall) {
        if (!UIUtils.screen.isSmall()) {
            $focus('comment-form-textarea');
        }
        else {
            if (forceIfSmall) $focus('comment-form-input');
        }
    };

    $scope.removeParentLink = function() {
        delete $scope.formData.parent;
        delete $scope.formData.reply_to;
        $scope.focusNewComment();
    };

    $scope.toggleExpandedReplies = function(comment, index) {
        comment.expandedReplies = comment.expandedReplies || {};
        comment.expandedReplies[index] = !comment.expandedReplies[index];
    };

    $scope.toggleExpandedParent = function(comment, index) {
        comment.expandedParent = comment.expandedParent || {};
        comment.expandedParent[index] = !comment.expandedParent[index];
    };
}

function ESSocialsEditController($scope, $focus, $filter, UIUtils, SocialUtils)  {
    'ngInject';

    $scope.socialData = {
        url: null,
        reorder: false
    };

    $scope.addSocialNetwork = function() {
        if (!$scope.socialData.url || $scope.socialData.url.trim().length === 0) {
            return;
        }

        $scope.formData.socials = $scope.formData.socials || [];
        var url = $scope.socialData.url.trim();

        var exists = _.findWhere($scope.formData.socials, {url: url});
        if (exists) { // duplicate entry
            $scope.socialData.url = '';
            return;
        }

        var social = SocialUtils.get(url);
        if (!social) {
            UIUtils.alert.error('PROFILE.ERROR.INVALID_SOCIAL_NETWORK_FORMAT');
            $focus('socialUrl');
            return; // stop here
        }
        $scope.formData.socials.push(social);
        $scope.socialData.url = '';

        // Set Motion
        $scope.motion.show({
            selector: '#social-' + $filter('formatSlug')(social.url),
            startVelocity: 10000
        });
    };

    $scope.editSocialNetwork = function(index) {
        var social = $scope.formData.socials[index];
        $scope.formData.socials.splice(index, 1);
        $scope.socialData.url = social.url;
        $focus('socialUrl');
    };

    $scope.reorderSocialNetwork = function(social, fromIndex, toIndex) {
        if (!social || fromIndex == toIndex) return; // no changes
        $scope.formData.socials.splice(fromIndex, 1);
        $scope.formData.socials.splice(toIndex, 0, social);
    };

    $scope.filterFn = function(social) {
        return !social.recipient || social.valid;
    };
}

function ESSocialsViewController($scope)  {
    'ngInject';

    $scope.openSocial = function(event, social) {
        event.stopPropagation();
        return $scope.openLink(event, social.url, {
            type: social.type
        });
    };


    $scope.filterFn = function(social) {
        return !social.recipient || social.valid;
    };

}



function ESAvatarModalController($scope) {

    $scope.formData = {
        initCrop: false,
        imageCropStep: 0,
        imgSrc: undefined,
        result: undefined,
        resultBlob: undefined
    };

    $scope.openFileSelector = function() {
        var fileInput = angular.element(document.querySelector('.modal-avatar #fileInput'));
        if (fileInput && fileInput.length > 0) {
            fileInput[0].click();
        }
    };

    $scope.fileChanged = function(e) {

        var files = e.target.files;
        var fileReader = new FileReader();
        fileReader.readAsDataURL(files[0]);

        fileReader.onload = function(e) {
            var res = this.result;
            $scope.$applyAsync(function() {
                $scope.formData.imgSrc = res;
            });
        };
    };

    $scope.doNext = function() {
        if ($scope.formData.imageCropStep == 2) {
            $scope.doCrop();
        }
        else if ($scope.formData.imageCropStep == 3) {
            $scope.closeModal($scope.formData.result);
        }
    };

    $scope.doCrop = function() {
        $scope.formData.initCrop = true;
    };

    $scope.clear = function() {
        $scope.formData = {
            initCrop: false,
            imageCropStep: 1,
            imgSrc: undefined,
            result: undefined,
            resultBlob: undefined
        };
    };

}


function ESPositionEditController($scope, csConfig, esGeo, ModalUtils) {
    'ngInject';

    // The default country used for address localisation
    var defaultCountry = csConfig.plugins && csConfig.plugins.es && csConfig.plugins.es.defaultCountry;

    var loadingCurrentPosition = false;
    $scope.options = $scope.options || {};
    $scope.options.position = $scope.options.position || {
        showCheckbox: true,
        required: false
    };
    $scope.formPosition = {
        loading: false,
        enable: angular.isDefined($scope.options.position.required) ? $scope.options.position.required : false
    };

    $scope.tryToLocalize = function() {
        if ($scope.formPosition.loading || loadingCurrentPosition) return;

        var searchText = $scope.getAddressToSearch();

        // No address, so try to localize by device
        if (!searchText) {
            loadingCurrentPosition = true;
            return esGeo.point.current()
                .then($scope.updateGeoPoint)
                .then(function() {
                    loadingCurrentPosition = false;
                })
                .catch(function(err) {
                    console.error(err); // Silent
                    loadingCurrentPosition = false;
                });
        }

        $scope.formPosition.loading = true;
        return esGeo.point.searchByAddress(searchText)
            .then(function(res) {
                if (res && res.length == 1) {
                    return $scope.updateGeoPoint(res[0]);
                }
                return $scope.openSearchLocationModal({
                    text: searchText,
                    results: res||[],
                    forceFallback: !res || !res.length // force fallback search first
                });
            })
            .then(function() {
                $scope.formPosition.loading = false;
            })
            .catch(function(err) {
                console.error(err); // Silent
                $scope.formPosition.loading = false;
            });
    };

    $scope.onCityChanged = function() {
        if ($scope.loading) return;
        if ($scope.formPosition.enable) {
          if ($scope.formData.geoPoint) {
            // Invalidate the position
            $scope.formData.geoPoint.lat = undefined;
            $scope.formData.geoPoint.lon = undefined;
          }
          return $scope.tryToLocalize();
        }
    };

    $scope.onUseGeopointChanged = function() {
        if ($scope.loading) return;
        if (!$scope.formPosition.enable) {
            if ($scope.formData.geoPoint) {
                $scope.formData.geoPoint.lat = undefined;
                $scope.formData.geoPoint.lon = undefined;
                $scope.dirty = true;
            }
        }
        else {
            $scope.tryToLocalize();
        }
    };

    $scope.onGeopointChanged = function() {
        if ($scope.loading) {
            $scope.formPosition.enable = $scope.formData.geoPoint && !!$scope.formData.geoPoint.lat && !!$scope.formData.geoPoint.lon;
        }
    };
    $scope.$watch('formData.geoPoint', $scope.onGeopointChanged);

    $scope.getAddressToSearch = function() {
        return $scope.formData.address && $scope.formData.city ?
            [$scope.formData.address.trim(), $scope.formData.city.trim()].join(', ') :
        $scope.formData.city || $scope.formData.address || $scope.formData.location ;
    };

    $scope.updateGeoPoint = function(res) {
        // user cancel
        if (!res || !res.lat || !res.lon) {
            // nothing to do
            return;
        }

        $scope.dirty = true;
        $scope.formData.geoPoint = $scope.formData.geoPoint || {};
        $scope.formData.geoPoint.lat =  parseFloat(res.lat);
        $scope.formData.geoPoint.lon =  parseFloat(res.lon);

        if (res.address && res.address.city) {
            var cityParts = [res.address.city];
            if (res.address.postcode) {
                cityParts.push(res.address.postcode);
            }
            if (res.address.country != defaultCountry) {
                cityParts.push(res.address.country);
            }
            $scope.formData.city = cityParts.join(', ');
        }
    };

    /* -- modal -- */

    $scope.openSearchLocationModal = function(options) {

        options = options || {};

        var parameters = {
            text: options.text || $scope.getAddressToSearch(),
            results: options.results,
            fallbackText: options.fallbackText || $scope.formData.city,
            forceFallback: angular.isDefined(options.forceFallback) ? options.forceFallback : undefined
        };

        return ModalUtils.show(
            'plugins/es/templates/common/modal_location.html',
            'ESSearchPositionModalCtrl',
            parameters,
            {
                focusFirstInput: true
                //,scope: $scope
            }
        )
            .then($scope.updateGeoPoint);
    };
}


function ESLookupPositionController($scope, $q, csConfig, esGeo, ModalUtils) {
  'ngInject';

  // The default country used for address localisation
  var defaultCountry = csConfig.plugins && csConfig.plugins.es && csConfig.plugins.es.defaultCountry;
  var loadingPosition = false;

  $scope.geoDistanceLabels = [5,10,20,50,100,250,500].reduce(function(res, distance){
      res[distance] = {
        labelKey: 'LOCATION.DISTANCE_OPTION',
        labelParams: {value: distance}
      };
      return res;
    }, {});
  $scope.geoDistances = _.keys($scope.geoDistanceLabels);

  $scope.searchPosition = function(searchText) {
    if (loadingPosition) return $q.when();

    loadingPosition = true;

    // No address, so try to localize by device
    var promise = !searchText ?
        esGeo.point.current() :
        esGeo.point.searchByAddress(searchText)
            .then(function(res) {
                if (res && res.length == 1) {
                    res[0].exact = true;
                    return res[0];
                }
                return $scope.openSearchLocationModal({
                    text: searchText,
                    results: res||[],
                    forceFallback: !res || !res.length // force fallback search first
                })
                    .then(function(res) {
                        // Compute point name
                        if (res && res.address && res.address.city) {
                            var cityParts = [res.address.city];
                            if (res.address.postcode) {
                                cityParts.push(res.address.postcode);
                            }
                            if (res.address.country != defaultCountry) {
                                cityParts.push(res.address.country);
                            }
                            res.shortName = cityParts.join(', ');
                        }
                        return res;
                    });
            });

    promise
        .then(function(res) {

            loadingPosition = false;

            // user cancel
            if (!res || !res.lat || !res.lon) return;

            return {
                lat: parseFloat(res.lat),
                lon: parseFloat(res.lon),
                name: res.shortName,
                exact: res.exact
            };

        })
        .catch(function(err) {
            console.error(err); // Silent
            loadingPosition = false;
        });

    return promise;
  };


  /* -- modal -- */

  $scope.openSearchLocationModal = function(options) {

    options = options || {};

    var parameters = {
        text: options.text || $scope.getAddressToSearch(),
        results: options.results,
        fallbackText: options.fallbackText || $scope.search.location,
        forceFallback: angular.isDefined(options.forceFallback) ? options.forceFallback : undefined
    };

    return ModalUtils.show(
        'plugins/es/templates/common/modal_location.html',
        'ESSearchPositionModalCtrl',
        parameters,
        {
            focusFirstInput: true
            //,scope: $scope
        }
    );
  };
}

function ESSearchPositionItemController($scope, $timeout, UIUtils, ModalUtils, csConfig, esGeo) {
  'ngInject';

  // The default country used for address localisation
  var defaultCountry = csConfig.plugins && csConfig.plugins.es && csConfig.plugins.es.defaultCountry;

  var loadingPosition = false;
  var minLength = 3;
  $scope.locations = undefined;
  $scope.selectLocationIndex = -1;

  $scope.onKeydown = function(e) {

    switch(e.keyCode)
    {
      case 27://Esc
        $scope.hideDropdown();
        break;
      case 13://Enter
        if($scope.locations && $scope.locations.length)
          $scope.onEnter();
        break;
      case 38://Up
        $scope.onArrowUpOrDown(-1);
        e.preventDefault();
        break;
      case 40://Down
        $scope.onArrowUpOrDown(1);
        e.preventDefault();
        break;
      case  8://Backspace
      case 45://Insert
      case 46://Delete
        break;
      case 37://Left
      case 39://Right
      case 16://Shift
      case 17://Ctrl
      case 35://End
      case 36://Home
        break;
      default://All keys
        $scope.showDropdown();
    }
  };

  $scope.onEnter = function() {
    if ($scope.selectLocationIndex > -1) {
      $scope.selectLocation($scope.locations[$scope.selectLocationIndex]);
    }
    else {
      $scope.selectLocation($scope.locations[0]);
    }
  };

  $scope.onArrowUpOrDown = function(velocity) {
    if (!$scope.locations) return;

    $scope.selectLocationIndex+=velocity;
    if ($scope.selectLocationIndex >= $scope.locations.length) {
      $scope.selectLocationIndex = 0;
    }
    if ($scope.selectLocationIndex < 0) {
      $scope.selectLocationIndex = $scope.locations.length-1;
    }

    _.forEach($scope.locations||[], function(item, index) {
      item.selected = (index == $scope.selectLocationIndex);
    });

    // TODO: scroll to item ?
  };

  $scope.onLocationChanged = function() {
    if (loadingPosition || $scope.search.loading) return;
    $scope.search.geoPoint = undefined; // reset geo point

    $scope.showDropdown();
  };

  $scope.showDropdown = function() {
    var text = $scope.search.location && $scope.search.location.trim();
    if (!text || text.length < minLength) {
        return $scope.hideDropdown(true/*force, if still loading*/);
    }

    // Compute a request id, to apply response only if current request
    var requestId = ($scope.requestId && $scope.requestId + 1) || 1;
    $scope.requestId = requestId;

    loadingPosition = true;

    // Execute the given query
    return esGeo.point.searchByAddress(text)
      .then(function(res) {
        if ($scope.requestId != requestId) return; // Skip apply if not same request:

        loadingPosition = false;
        $scope.locations = res||[];
        $scope.license = res && res.length && res[0].license;
      })
      .catch(function(err) {
        $scope.hideDropdown();
        throw err;
      });
  };

  $scope.hideDropdown = function(force) {
    // force, even if still loading
    if (force) {
      $scope.locations = undefined;
      $scope.selectLocationIndex = -1;
      $scope.license = undefined;
      loadingPosition = false;
      return;
    }

    return $timeout(function() {
      if (loadingPosition) return;
      $scope.locations = undefined;
      $scope.license = undefined;
      loadingPosition = false;
    }, 500);
  };

  $scope.selectLocation = function(res, exactMatch) {
    loadingPosition = true; // avoid event
    if (res) {
      // Update position
      $scope.search.geoPoint = $scope.search.geoPoint || {};
      $scope.search.geoPoint.lat =  parseFloat(res.lat);
      $scope.search.geoPoint.lon =  parseFloat(res.lon);

      if (exactMatch) {
        $scope.search.geoPoint.exact = true;
      }
      else {
        // Update location name
        if (res && res.address && res.address.city) {
          var cityParts = [res.address.city];
          if (res.address.postcode) {
            cityParts.push(res.address.postcode);
          }
          if (res.address.country != defaultCountry) {
            cityParts.push(res.address.country);
          }
          $scope.search.location = cityParts.join(', ');
        }
      }
    }

    $scope.hideDropdown(true);
  };

  /* -- modal -- */

  $scope.openSearchLocationModal = function(options) {

    options = options || {
      text: $scope.search.location
    };

    var parameters = {
      text: options.text || $scope.search.location
    };

    return ModalUtils.show(
        'plugins/es/templates/common/modal_location.html',
        'ESSearchPositionModalCtrl',
        parameters,
        {
          focusFirstInput: true
        }
      )
      .then($scope.selectLocation);
  };

  /* -- popover -- */

  $scope.showDistancePopover = function(event) {
      UIUtils.popover.show(event, {
          templateUrl: 'plugins/es/templates/common/popover_distances.html',
          scope: $scope,
          autoremove: true,
          afterShow: function(popover) {
              $scope.actionsPopover = popover;
          }
      });
  };

  $scope.selectDistance = function(value) {
      $scope.search.geoDistance = value;
      if ($scope.actionsPopover) {
          $scope.actionsPopover.hide();
      }
  };

}

function ESSearchPositionModalController($scope, $q, $translate, esGeo, parameters) {
    'ngInject';

    $scope.search = {
        text: parameters.text || '',
        fallbackText: parameters.fallbackText || undefined,
        forceFallback: angular.isDefined(parameters.forceFallback) ? parameters.forceFallback : false,
        loading: false,
        results: parameters.results || undefined
    };

    $scope.$on('modal.shown', function() {
        // Load search
        $scope.doSearch(true/*first search*/);
    });

    $scope.doSearch = function(firstSearch) {

        var text = $scope.search.text && $scope.search.text.trim();
        if (!text) {
            return $q.when(); // nothing to search
        }

        $scope.search.loading = true;

        // Compute alternative query text
        var fallbackText = firstSearch && $scope.search.fallbackText && $scope.search.fallbackText.trim();
        fallbackText = fallbackText && fallbackText != text ? fallbackText : undefined;

        // Execute the given query
        return ((firstSearch && $scope.search.forceFallback && $scope.search.results) ?
                $q.when($scope.search.results) :
                esGeo.point.searchByAddress(text)
        )
            .then(function(res) {
                if (res && res.length || !fallbackText) return res;

                // Fallback search
                return $q.all([
                    $translate('LOCATION.MODAL.ALTERNATIVE_RESULT_DIVIDER', {address: fallbackText}),
                    esGeo.point.searchByAddress(fallbackText)
                ])
                    .then(function (res) {
                        var dividerText = res[0];
                        res = res[1];
                        if (!res || !res.length) return res;

                        return [{name: dividerText}].concat(res);
                    });
            })
            .then(function(res) {
                $scope.search.loading = false;
                $scope.search.results = res||[];

                $scope.license = res && res.length && res[0].license;
            })
            .catch(function(err) {
                $scope.search.loading = false;
                $scope.search.results = [];
                $scope.license = undefined;
                throw err;
            })
            ;
    };

}


function ESLikesController($scope, $q, $timeout, $translate, $ionicPopup, UIUtils, csWallet, esHttp) {
    'ngInject';

    $scope.entered = false;
    $scope.abuseData = {};
    $scope.abuseLevels = [
        {value: 1, label: 'LOW'},
        {value: 2, label: 'LOW'}
    ];
    $scope.staring = false;
    $scope.options = $scope.options || {};
    $scope.options.like = $scope.options.like || {
        kinds: esHttp.constants.like.KINDS,
        index: undefined,
        type: undefined,
        id: undefined
    };

    $scope.$on('$recordView.enter', function(e, state) {
        // First enter
        if (!$scope.entered) {
            $scope.entered = false;
           // Nothing to do: main controller will trigger '$recordView.load' event
        }
        // second call (e.g. if cache)
        else if ($scope.id) {
            $scope.loadLikes($scope.id);
        }
    });

    $scope.$on('$recordView.load', function(event, id) {
        $scope.id = id || $scope.id;
        if ($scope.id) {
            $scope.loadLikes($scope.id);
        }
    });

    // Init Like service
    $scope.initLikes = function() {
      if (!$scope.likeData) {
        throw Error("Missing 'likeData' in scope. Cannot load likes counter");
      }
      if (!$scope.options.like.service) {
        if (!$scope.options.like.index || !$scope.options.like.type) {
          throw Error("Missing 'options.like.index' or 'options.like.type' in scope. Cannot load likes counter");
        }
        $scope.options.like.service = {
          count: esHttp.like.count($scope.options.like.index, $scope.options.like.type),
          add: esHttp.like.add($scope.options.like.index, $scope.options.like.type),
          remove: esHttp.like.remove($scope.options.like.index, $scope.options.like.type),
          toggle: esHttp.like.toggle($scope.options.like.index, $scope.options.like.type)
        };
      }
      if (!$scope.options.like.kinds) {
        // Get scope's kinds (e.g. defined in the parent scope)
        $scope.options.like.kinds = _.filter(esHttp.constants.like.KINDS, function (kind) {
            var key = kind.toLowerCase() + 's';
            return angular.isDefined($scope.likeData[key]);
        });
      }
    };

    $scope.loadLikes = function(id) {
      if ($scope.likeData.loading) return;// Skip

      id = id || $scope.likeData.id;
      $scope.initLikes();

      var kinds = $scope.options.like.kinds || [];
      if (!kinds.length) return; // skip

      $scope.likeData.loading = true;
      var now = Date.now();
      console.debug("[ES] Loading counter of {0}... ({1})".format(id.substring(0,8), kinds));

      return $q.all(_.map(kinds, function(kind) {
          var key = kind.toLowerCase() + 's';
          return $scope.options.like.service.count(id, {issuer: csWallet.isLogin() ? csWallet.data.pubkey : undefined, kind: kind})
            .then(function (res) {
                // Store result to scope
                if ($scope.likeData[key]) {
                    angular.merge($scope.likeData[key], res);
                }
            });
        }))
        .then(function () {
          $scope.likeData.id = id;
          console.debug("[ES] Loading counter of {0} [OK] in {1}ms".format(id.substring(0,8), Date.now()-now));

          if (_.contains(kinds, 'VIEW') && !$scope.canEdit) {
            $scope.markAsView();
          }

          // Publish to parent scope (to be able to use it in action popover's buttons)
          if ($scope.$parent) {
            console.debug("[ES] [likes] Adding data and functions to parent scope");
            $scope.$parent.toggleLike = $scope.toggleLike;
            $scope.$parent.reportAbuse = $scope.reportAbuse;
          }

          $scope.likeData.loading = false;
        })
        .catch(function (err) {
          console.error(err && err.message || err);
          $scope.likeData.loading = false;
        });
    };

    $scope.markAsView = function() {
      if (!$scope.likeData || !$scope.likeData.views || $scope.likeData.views.wasHit) return; // Already view
      var canEdit = $scope.canEdit || $scope.formData && csWallet.isUserPubkey($scope.formData.issuer);
      if (canEdit) return; // User is the record's issuer: skip

      var timer = $timeout(function() {
          if (csWallet.isLogin()) {
              $scope.options.like.service.add($scope.likeData.id, {kind: 'view'}).then(function() {
                  $scope.likeData.views.total = ($scope.likeData.views.total||0) + 1;
              });
          }
          timer = null;
      }, 3000);

      $scope.$on("$destroy", function() {
          if (timer) $timeout.cancel(timer);
      });
    };

    $scope.toggleLike = function(event, options) {
      $scope.initLikes();
      if (!$scope.likeData.id) throw Error("Missing 'likeData.id' in scope. Cannot apply toggle");

      options = options || {};
      options.kind = options.kind && options.kind.toUpperCase() || 'LIKE';
      var key = options.kind.toLowerCase() + 's';

      $scope.likeData[key] = $scope.likeData[key] || {};

      // Avoid too many call
      if ($scope.likeData[key].loading === true || $scope.likeData.loading) {
        event.preventDefault();
        return $q.reject();
      }

      // Like/dislike should be inversed
      if (options.kind === 'LIKE' && $scope.dislikes && $scope.dislikes.wasHit) {
        return $scope.toggleLike(event, {kind: 'dislike'})
          .then(function() {
            $scope.toggleLike(event, options);
          });
      }
      else if (options.kind === 'DISLIKE' && $scope.likes && $scope.likes.wasHit) {
        return $scope.toggleLike(event, {kind: 'LIKE'})
          .then(function() {
            $scope.toggleLike(event, options);
          });
      }

      $scope.likeData[key].loading = true;

      // Make sure user is log in
      return (csWallet.isLogin() ? $q.when() : $scope.loadWallet({minData: true}))
        .then(function() {
          // Apply like
          return $scope.options.like.service.toggle($scope.likeData.id, options);
        })
        .then(function(delta) {
          UIUtils.loading.hide();
          if (delta !== 0) {
            $scope.likeData[key].total = ($scope.likeData[key].total || 0) + delta;
            $scope.likeData[key].wasHit = delta > 0;
          }
          $timeout(function() {
            $scope.likeData[key].loading = false;
          }, 1000);
        })
        .catch(function(err) {
          console.error(err);
          $scope.likeData[key].loading = false;
          UIUtils.loading.hide();
          event.preventDefault();
         });
    };

    $scope.setAbuseForm = function(form) {
        $scope.abuseForm = form;
    };

    $scope.showAbuseCommentPopover = function(event) {
        return $translate(['COMMON.REPORT_ABUSE.TITLE', 'COMMON.REPORT_ABUSE.SUB_TITLE','COMMON.BTN_SEND', 'COMMON.BTN_CANCEL'])
            .then(function(translations) {

                UIUtils.loading.hide();

                return $ionicPopup.show({
                    templateUrl: 'plugins/es/templates/common/popup_report_abuse.html',
                    title: translations['COMMON.REPORT_ABUSE.TITLE'],
                    subTitle: translations['COMMON.REPORT_ABUSE.SUB_TITLE'],
                    cssClass: 'popup-report-abuse',
                    scope: $scope,
                    buttons: [
                        {
                            text: translations['COMMON.BTN_CANCEL'],
                            type: 'button-stable button-clear gray'
                        },
                        {
                            text: translations['COMMON.BTN_SEND'],
                            type: 'button button-positive  ink',
                            onTap: function(e) {
                                $scope.abuseForm.$submitted=true;
                                if(!$scope.abuseForm.$valid || !$scope.abuseData.comment) {
                                    //don't allow the user to close unless he enters a uid
                                    e.preventDefault();
                                } else {
                                    return $scope.abuseData;
                                }
                            }
                        }
                    ]
                });
            })
            .then(function(res) {
                $scope.abuseData = {};
                if (!res || !res.comment) { // user cancel
                    UIUtils.loading.hide();
                    return undefined;
                }
                return res;
            });
    };


    $scope.reportAbuse = function(event, options) {
        if ($scope.likeData && $scope.likeData.abuses && $scope.likeData.abuses.wasHit) return; // Abuse already reported

        options = options || {};

        if (!options.comment) {
            return (csWallet.isLogin() ? $q.when() : $scope.loadWallet({minData: true}))
                // Ask a comment
                .then(function() {
                    return $scope.showAbuseCommentPopover(event);
                })
                // Loop, with options.comment filled
                .then(function(res) {
                    if (!res || !res.comment) return; // Empty comment: skip
                    options.comment = res.comment;
                    options.level = res.level || (res.delete && 5) || undefined;
                    return $scope.reportAbuse(event, options); // Loop, with the comment
                });
        }

        // Send abuse report
        options.kind = 'ABUSE';
        return $scope.toggleLike(event, options)
            .then(function() {
                UIUtils.toast.show('COMMON.REPORT_ABUSE.CONFIRM.SENT');
            });
    };


    $scope.addStar = function(level) {
      if ($scope.starsPopover) {
        return $scope.starsPopover.hide()
          .then(function() {
            $scope.starsPopover = null;
            $scope.addStar(level); // Loop
          });
      }
      if ($scope.likeData.loading || !$scope.likeData.stars || $scope.likeData.stars.loading) return; // Avoid multiple call

      if (!csWallet.isLogin()) {
        return $scope.loadWallet({minData: true})
          .then(function(walletData) {
            if (!walletData) return; // skip
            UIUtils.loading.show();
            // Reload the counter, to known if user already has
            return $scope.options.like.service.count($scope.likeData.id, {issuer: walletData.pubkey, kind: 'STAR'})
              .then(function(stars) {
                  angular.merge($scope.stars, stars);
                  $scope.addStar(level); // Loop
              });
          })
          .catch(function(err) {
            if (err === 'CANCELLED') return; // User cancelled
            // Refresh current like
          });
      }

      $scope.likeData.stars.loading = true;
      var stars = angular.merge(
        {total: 0, levelAvg: 0, levelSum: 0, level: 0, wasHit: false, wasHitId: undefined},
        $scope.likeData.stars);

      var successFunction = function() {
        stars.wasHit = true;
        stars.level = level;
        // Compute AVG (round to near 0.5)
        stars.levelAvg = Math.floor((stars.levelSum / stars.total + 0.5) * 10) / 10 - 0.5;
        // Update the star level
        angular.merge($scope.likeData.stars, stars);
        UIUtils.loading.hide();
      };

      // Already hit: remove previous star, before inserted a new one
      if (stars.wasHitId) {
          console.debug("[ES] Deleting previous star level... " + stars.wasHitId);
          return $scope.options.like.service.remove(stars.wasHitId)
            .catch(function(err) {
                // Not found, so continue
                if (err && err.ucode === 404) return;
                else throw err;
            })
            .then(function() {
                console.debug("[ES] Deleting previous star level [OK]");
                stars.levelSum = stars.levelSum - stars.level + level;
                successFunction();
                // Add the star (after a delay, to make sure deletion has been executed)
                return $timeout(function() {
                    console.debug("[ES] Sending new star level...");
                    return $scope.options.like.service.add($scope.likeData.id, {kind: 'star', level: level || 1});
                }, 2000);
            })
            .then(function(newHitId) {
                stars.wasHitId = newHitId;
                console.debug("[ES] Star level successfully sent... " + newHitId);
                UIUtils.loading.hide();
                return $timeout(function() {
                    $scope.likeData.stars.loading = false;
                }, 1000);
            })
            .catch(function(err) {
                console.error(err && err.message || err);
                $scope.likeData.stars.loading = false;
                UIUtils.onError('MARKET.WOT.ERROR.FAILED_STAR_PROFILE')(err);
                // Reload, to force refresh state
                $scope.loadLikes();
            });
      }

      return $scope.options.like.service.add($scope.likeData.id, {kind: 'star', level: level || 1})
        .then(function(newHitId) {
            stars.levelSum += level;
            stars.wasHitId = newHitId;
            stars.total += 1;
            successFunction();
            console.debug("[ES] Star level successfully sent... " + newHitId);
            $scope.likeData.stars.loading = false;
            UIUtils.loading.hide();
        })
        .catch(function(err) {
            console.error(err && err.message || err);
            $scope.likeData.stars.loading = false;
            UIUtils.onError('MARKET.WOT.ERROR.FAILED_STAR_PROFILE')(err);
        });
    };

  $scope.removeStar = function(event) {
    if ($scope.starsPopover) $scope.starsPopover.hide();
    if ($scope.likeData.loading) return; // Skip
    $scope.likeData.stars.level = undefined;
    $scope.toggleLike(event, {kind: 'star'})
      .then(function() {
          return $timeout(function() {
              $scope.loadLikes(); // refresh
          }, 1000);
      });

  };

  $scope.showStarPopover = function(event) {
    $scope.initLikes();
    if ($scope.likeData.stars.loading) return; // Avoid multiple call

    if (angular.isUndefined($scope.likeData.stars.level)) {
      $scope.likeData.stars.level = 0;
    }

    UIUtils.popover.show(event, {
      templateUrl: 'plugins/es/templates/common/popover_star.html',
      scope: $scope,
      autoremove: true,
      afterShow: function(popover) {
        $scope.starsPopover = popover;
      }
    });
  };

  csWallet.api.data.on.reset($scope, function() {
    _.forEach($scope.options.like.kinds||[], function(kind) {
      var key = kind.toLowerCase() + 's';
      if ($scope.likeData[key]) {
        $scope.likeData[key].wasHit = false;
        $scope.likeData[key].wasHitId = undefined;
        $scope.likeData[key].level = undefined;
      }
    });
  }, this);

}
