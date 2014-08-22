/*jshint maxdepth:10 */
'use strict';

var db = require('../../db'),
    _ = require('lodash'),
    Q = require('q'),
    maybeMongodId = /^[0-9a-fA-F]{24}$/;

/**
 * Module used for pre-loading a content object and keeping it in the context to be evaluated later.
 * This exists so that we don't have to make mulitple calls to the database if we are going to be
 * performing some form of validation.
 * @param kontx
 * @param next
 */
module.exports = function setTempContent(kontx, next){

    var content = kontx._content,
        promises = [];

    getReferences(content.fields, promises, next, kontx);
};

function getReferences(fields, promises, next, kontx) {

    _.each(fields, function(value, key) {
        getArrayReferences(fields, value, key, promises, next, kontx);
        getDirectReferences(fields, value, key, promises, next, kontx);
        getObjectReferences(fields, value, key, promises, next, kontx);
    });

    tryToSendResponse(promises, next);
}

function getObjectReferences(fields, value, key, promises, next, kontx) {
    _.each(value, function(v, k) {
        if (_.isString(v)) {
            getDirectReferences(value, v, k, promises, next, kontx);
        } else {
            getReferences(v, promises, next, kontx);
        }
    });
}

function getDirectReferences(fields, value, key, promises, next, kontx) {
    var query;

    if (!_.isString(value)) {
        return;
    }

    if (maybeMongodId.test(value)) {

        query = db.content.getById(value);
        promises.push(query);

        query.then(function(response) {
            fields[key] = response.fields;
            getReferences(response.fields, promises, next, kontx);
        })
            .catch(function(e) {console.log(e); });
    }
}

function getArrayReferences(parent, array, key, promises, next, kontx) {
    if (!_.isArray(array)) {
        return;
    }

    _.each(array, function(item, index) {
        var query;
        if (maybeMongodId.test(item)) {

            query = db.content.getById(item);
            promises.push(query);

            query.then(function(response) {
                parent[key][index] = response.fields;
                getReferences(response.fields, promises, next, kontx);
            })
                .catch(function(e) {console.log(e); });
        }
    });
}

function tryToSendResponse(promises, next) {
    var count = 0;
    _.each(promises, function(promise) {
        if (promise.isFulfilled()) {
            ++count;
        }
    });
    if (_.every(promises, function(promise) { return promise.isFulfilled(); })) {
        next();
    }
}