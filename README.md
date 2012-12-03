# StateTree: simple javascript statechart implemenation.

# About


## What is a state chart?

A statechart is similar to a FSM (finite state machine), but extends the concept with hierarchy, concurrency, and communication.

## Why statecharts?

Most applications have a lot of implicit and ad-hoc state mutation that is difficult to understand and leads to bugs.
In a simple app it is easy enough to manage by paying attention to detail.
However, as applications become complex this gives every new feature the potential to break existing features.
Statecharts were originally created to wrangle the complexity of jet fighter software, but I think they can scale down nicely also.
Rather than having implicit state mutation, Statecharts allow us to be very explicit about state and how it can be changed.
This leads to fewer defects and even lets us explain how our application operates to non-programmers.

## Why not FSMs?

FSMs lack nested and concurrent states


## Why not routing?

Routing is often used to describe application state. However, routing has difficulty handling concurrent states, handling nested state transitions, and maintaining history of different branches.
Ember.js has taken a great approach of combining routing with a statechart. However, their code, including the underlying statemachine library does not work outside of the Ember framework.


## StateTree

StateTree is a simplification of the statechart concept. 
Our statechart is modeled as a tree (hierarchy) with multiple active branches (concurrency).
There are no library features for the broadcast communication aspect of statecharts.

StateTree was developed for managing the state of a typical client-side UI where the user is able to navigate around the entire UI.
There are few illegal state transitions in such a scenario, so this library provides no tools to restrict state transitions, although you can achieve this to a certain extent by making states private.

As a result, StateTree is smaller and simpler than any other statechart library I have found.
You may find its features to be lacking.
However, switching to using a more featureful statechart library should be straightforward because StateTree should be a subset.

* Stativus is a fully-featured statechart library.
* If you are using Ember, they have their own statechart library.
* here is a GPL statechart library that has not been updated in a while: https://github.com/DavidDurman/statechart


## Safety and TypeScript

Most other statechart libraries ask you to give a large JSON structure to describe your state chart.
JSON hierarchy looks nice, but these structures normally rely on strings that are a typo away from silent error.
StateTree instead uses setter methods because they will always fail immediately at runtime if mistyped.
StateTree leverages TypeScript to reduce bugs in the implementation.
You can also use TypeScript in your usage of this library to move some errors from runtime to compile time and also to get better autocompletion.


# Dependencies

lodash/underscore (this dependency can be removed in the future)


# Development Requirements

TypeScript


# Usage

Changing the state is done with `state.goTo()`
You do not indicate what the originating state is.
The state tree 
 * determines which concurrent substate the new state is in and moves within that concurrent substate
 * moves up the tree as necessary, exiting (invoke exit callback for) each state and setting history states.
 * moves down the tree and enters (invoke enter callback for) each state


## Example: Application & UI state

     function login(){} // login service

     var tree = makeStateTree()
     var authenticate = tree.root.subState("authenticate")
       .enter(function(){ login.onApplicationStart(function(){ loggedin.goTo()}})

     var loggedin      = authenticate.subState("loggedin")
       .concurrentSubStates()
       .enter(function(){ main.goTo()})

     var main = loggedin.subState("main")

     var popup  = loggedin.subState("popup")
     var open   = popup.subState("open")
     var closed = popup.subState("closed")
       .enter(function(){ UI.unmask() })

     var tab1 = main.subState('tab1')
       .defaultSubState()
       .enter(function(){ UI.activateTab('tab1')})
     var tab2 = main.subState('tab2')
       .enter(function(){ UI.activateTab('tab2')})

     // start up the application
     authenticate.goTo()


* loggedin has concurrent substates (main and popup)
* tab1 is the default substate of main
* When the user enters the loggedin state, then enter callback will start the main state.
* The main state will enter the tab1 state because it is the default sub state.
* The popup can be opened and closed without effecting the main state.


## History states

History states let us know the previous substate so we can easily restore previous application state.

    // access the previous sub-state
    state.history

    // if there is a history state always go to it instead of the default state
    tree.defaultToHistoryState()


## Events

There is no event sytem.
If you want to send data with a transition, just create a wrapper function (and tie it to an event if you want).

     // wrapper function
     function goToStateA(arg1) {
       // do something with arg1
       stateA.goTo()
     } 

     // event hook: use your own event system
     myEventSystem.on('stateAEvent', goToStateA)


## Limiting/Enforcing transitions

If you want to limit access, just export a new object rather than all of the states.
Instead of exporting states, you can export functions.
These can handle data and limit usage to only valid state transitions.

     return {
       goToStateA: goToStateA
     , stateB: stateB // public
     }
