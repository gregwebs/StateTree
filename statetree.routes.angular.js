(function (_, undefined) {
    var routeGenerator = function (routeProvider, $location) {
        return function (state, route, get, set) {
            var nParams = 0;
            var routeVars = [];
            var routeStr = '/' + _.map(route, function (piece, i) {
                if(angular.isString(piece)) {
                    return piece;
                }
                nParams = nParams + 1;
                var routeVar = i.toString();
                routeVars.push({
                    name: routeVar,
                    transform: piece
                });
                return ':' + routeVar;
            }).join('/');
            if(nParams > 0) {
                if(!get || !set) {
                    throw new Error("expected a get & set function");
                }
                if(set.length !== nParams) {
                    throw new Error("Expected set functions to take " + nParams + " params. However, set takes " + set.length + " params");
                }
            }
            routeProvider.when(routeStr, {
                template: '<div></div>',
                controller: [
                    '$routeParams', 
                    function ($routeParams) {
                        try  {
                            var transformedVars = _.map(routeVars, function (routeVar) {
                                return routeVar.transform($routeParams[routeVar.name]);
                            });
                        } catch (e) {
                            console.log("error parsing routes, redirecting to root");
                            console.log(e.toString());
                            $location.path('/');
                        }
                        var promise = set.apply(null, transformedVars);
                        var goTo = function () {
                            state.goTo({
                                urlAlreadySet: true
                            });
                        };
                        if(promise && promise.then) {
                            promise.then(goTo);
                        } else {
                            goTo();
                        }
                    }                ]
            });
            state.enter(function (_state, data) {
                if(data && data.urlAlreadySet) {
                    return;
                }
                var paramValues = get();
                if(!angular.isArray(paramValues)) {
                    throw new Error("expected an array from route get function for: " + _state.name);
                }
                if(paramValues.length !== routeVars.length) {
                    throw new Error("Expected get function to return " + routeVars.length + " values.");
                }
                var routeVarsPosition = 0;
                $location.path(_.map(route, function (piece, i) {
                    if(angular.isString(piece)) {
                        return piece;
                    }
                    routeVarsPosition = routeVarsPosition + 1;
                    return paramValues[routeVarsPosition - 1];
                }).join('/'));
            });
        }
    };
    if(typeof window !== "undefined") {
        window.routeGenerator = routeGenerator;
    }
    if(typeof ender === 'undefined') {
        this['routeGenerator'] = routeGenerator;
    }
    if(typeof define === "function" && define.amd) {
        define("routeGenerator", [], function () {
            return routeGenerator;
        });
    }
}).call(this, lodash);
//@ sourceMappingURL=statetree.routes.angular.js.map
