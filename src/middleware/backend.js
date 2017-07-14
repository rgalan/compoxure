var HttpStatus = require('http-status-codes');
var _ = require('lodash');
var utils = require('../utils');

var lowerCaseKeys = function (obj) {
  return _.mapKeys(obj, function(value, key) {
    return key.toLowerCase();
  });
}

function validateBackends(backend) {
  if (!backend) {
    return;
  }
  var names = {};
  var dupes = [];

  backend.forEach(function (b) {
    if (!b.name) {
      return;
    }
    if (names[b.name] === 1) {
      dupes.push(b.name);
    }
    names[b.name] = names[b.name] || 0;
    names[b.name]++;
  });

  if (dupes.length) {
    throw new Error('Duplicate backend names: ' + dupes.join(', '));
  }
}

module.exports = function (config) {

  // Switch keyed object to an array here on startup, not on each request
  var backendIsArray = Array.isArray(config.backend);
  var backendArray = backendIsArray ? config.backend : _.values(config.backend);
  if (backendIsArray) {
    validateBackends(backendArray);
  }

  var backendDefaults = _.defaults(config.backendDefaults || {}, {
    quietFailure: false,
    replaceOuter: false,
    dontPassUrl: true,
    leaveContentOnFail: true,
    ttl: '5m',
    noCache: false,
    timeout: '2s',
    addResponseHeaders: {},
    headers: [],
    passThroughHeaders: []
  });

  return function selectBackend(req, res, next) {

    var headerBackend = {};
    if (req.get) {
      headerBackend = {
        name: req.get('x-compoxure-backend'),
        target: req.get('x-compoxure-backend-target'),
        ttl: req.get('x-compoxure-backend-ttl'),
        noCache: req.get('x-compoxure-backend-nocache'),
        timeout: req.get('x-compoxure-backend-timeout')
      };
    }

    if (backendArray) {
      // First try to match based on header and use header values
      if (headerBackend.target) {
        if (headerBackend.name) {
          if (backendArray) {
            req.backend = _.find(backendArray, function (server) {
              return (server.name === headerBackend.name);
            });
          } else {
            // It is an object, we can just retrieve by key
            req.backend = config.backend[headerBackend.name];
          }
        }
      } else {
        req.backend = utils.getBackendConfig(config, backendArray, req.url, req);
      }
    }

    // If we haven't matched but have headers, lets just use these
    if (!req.backend && headerBackend.target) {
      req.backend = headerBackend;
    }

    if (!req.backend) {
      if (!res.headersSent) {
        res.writeHead(HttpStatus.NOT_FOUND);
      }
      return next({
        level: 'warn',
        message: 'Backend not found'
      });
    }

    req.backend = _.defaults(_.clone(req.backend), headerBackend, backendDefaults);
    var backendNoCache = !req.backend.cacheKey || req.backend.noCache;
    if (backendNoCache && config.cache.defaultNoCacheHeaders) {
      req.backend.addResponseHeaders = _.defaults(lowerCaseKeys(req.backend.addResponseHeaders), lowerCaseKeys(config.cache.defaultNoCacheHeaders));
    }
    req.backend.target = utils.render(req.backend.target, req.templateVars);
    req.backend.cacheKey = req.backend.cacheKey ? utils.render(req.backend.cacheKey, req.templateVars) : null;
    return next();
  }
}
