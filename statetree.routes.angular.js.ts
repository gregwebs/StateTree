/// <reference path="../../common/types/angular-1.0.d.ts" />
/// <reference path="./statetree.d.ts" />
declare var lodash
declare var angular

// for exports
declare var ender
declare var define
declare var module

interface RouteMaker {
  (state:State, route: any[], get?: () => any[], set?:(...params:any[]) => ng.IHttpPromise):void;
}
interface Window { routeGenerator:(routeProvider:any, $location:any) => RouteMaker; }

// Uses AngularJS routing system which is not a great match for our needs
// You must add an <ng-view> tag to your app for this to work, and going to a route specified here will fill it with an empty div
// please note that it also wants the routeProvider: you can save that off to a variable and then pass it in.
//
// If you want the route to be removed on exit, just manually clear the location on exit
//   state.exit(function(){ $location.path('/') })
(function(_, undefined){
  var routeGenerator = (routeProvider:any, $location:any) =>
    // The get and set parameterers are callbacks.
    // If the set callback should return nothing or a promise.
    // If it returns a promise, the state transition will not occur until the promise is resolved
    (state: State, route: any[], get?: () => any[], set?:(...params:any[]) => ng.IHttpPromise):void => {
      var nParams = 0
      var routeVars = []
      var routeStr = '/' + _.map(route, (piece, i) => {
        if (angular.isString(piece)) return piece
        nParams = nParams + 1
        var routeVar = i.toString()
        routeVars.push({name: routeVar, transform:piece})
        return ':' + routeVar
      }).join('/')

      if (nParams > 0) {
        if (!get || !set) throw new Error("expected a get & set function")
        if (set.length !== nParams)
          throw new Error(
            "Expected set functions to take " + nParams +
            " params. However, set takes " +
            set.length + " params"
          )
      }

      routeProvider.when(routeStr, {
        template:'<div></div>'
      , controller: [<any>'$routeParams', ($routeParams) => {
          var promise = set.apply(null, 
            _.map(routeVars, (routeVar) => routeVar.transform($routeParams[routeVar.name]))
          )
          var goTo = () => { state.goTo({urlAlreadySet: true}) }
          if (promise) { promise.then(goTo) } else { goTo() }
        }]
      })

      state.enter((_state, data) => {
        if (data && data.urlAlreadySet) return

        var paramValues = get()
        if (!angular.isArray(paramValues)) {
          throw new Error("expected an array from route get function for: " + _state.name)
        }

        if (paramValues.length !== routeVars.length) {
          throw new Error ("Expected get function to return " +
            routeVars.length + " values."
          )
        }

        var routeVarsPosition = 0
        $location.path(
          _.map(route, (piece, i) => {
            if (angular.isString(piece)) return piece
            routeVarsPosition = routeVarsPosition + 1
            return paramValues[routeVarsPosition - 1]
          }).join('/')
        )
      })
    }

  // module is a reserved word in TypeScript, guess I need to use their module thing
  // if(typeof this.module !== "undefined" && module.exports) { module.exports = makeStateTree; }
  if (typeof window !== "undefined") { window.routeGenerator = routeGenerator; }
  if (typeof ender === 'undefined') { this['routeGenerator'] = routeGenerator; }
  if (typeof define === "function" && define.amd) { define("routeGenerator", [], function () { return routeGenerator; }); }
}).call(this, lodash)
