/* =========================================================================
 *
 * router.js
 *  Setups router
 *
 * ========================================================================= */
// External Dependencies
// ------------------------------------
import React from 'react';
// import logger from 'bragi-browser';

import { Route, NotFoundRoute } from 'react-router';
import { create, HistoryLocation } from 'react-router';

// Internal Dependencies
// ------------------------------------
// Component imports
import App from './components/app.js';
import Home from './components/home.js';
import About from './components/about.js';
import Gallery from './components/gallery.js';
import Block from './components/block.js';
import User from './components/user.js';

import NotFound from './components/not-found.js';

// ========================================================================
//
// Functionality
//
// ========================================================================
// The editor is deployed under bl.ockss.org/build, so every route lives
// beneath the /build prefix.
var routes = (
  <Route handler={App} >
    <Route name='home' path='/build' handler={Home}></Route>
    <Route name='about' path='/build/about' handler={About}></Route>
    <Route name='gallery' path='/build/gallery' handler={Gallery}></Route>
    <Route name='user' path='/build/:username' handler={User}></Route>
    <Route name='block' path='/build/:username/:gistId' handler={Block}></Route>
    <NotFoundRoute handler={NotFound}/>
  </Route>
);

export default create({
  routes: routes,
  location: HistoryLocation
});
