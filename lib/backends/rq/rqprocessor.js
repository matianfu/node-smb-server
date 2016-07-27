/*
 *  Copyright 2016 Adobe Systems Incorporated. All rights reserved.
 *  This file is licensed to you under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License. You may obtain a copy
 *  of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software distributed under
 *  the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 *  OF ANY KIND, either express or implied. See the License for the specific language
 *  governing permissions and limitations under the License.
 */

'use strict';

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var logger = require('winston').loggers.get('spi');
var utils = require('../../utils');
var request = require('request');
var fs = require('fs');

function RQProcessor(share, requestQueue) {
    // call the super constructor to initialize `this`
    EventEmitter.call(this);

    this.rq = requestQueue;
    this.share = share;
    this.stopped = true;
}

util.inherits(RQProcessor, EventEmitter);

/**
 * Starts the processor by initiating a loop that will run on a regular interval. The loop will check for any
 * requests that are ready to be synced and will perform the operations.
 * @param {Object} config Various configuration options for controlling how the processor will behave.
 * @param {Int} config.expiration The age, in milliseconds, that a request much reach before it will be processed.
 * @param {Int} config.frequency The amount of time, in milliseconds, between each execution of the processing workflow.
 */
RQProcessor.prototype.start = function (config) {
    var self = this;
    self.stopped = false;

    var processItems = function (cb) {
        self.rq.getProcessRequest(config.expiration, config.maxRetries, function (err, item) {
            if (err) {
                cb(err);
            } else {
                if (item) {
                    var handleError = function (path, method, err) {
                        logger.error('encountered exception while attempting to process local file %s', path, err);
                        self.emit('syncerr', {file: path, method: method, err: err});
                        self.rq.incrementRetryCount(item, function (err) {
                            if (err) {
                                logger.error('unable to update retry count for path %s', path, err);
                            }
                            processItems(cb);
                        });
                    };

                    var url = item.remoteUrl;
                    var method = item.method;
                    var path = item.localPath;

                    self.emit('syncstart', {file: path, method: method});

                    if (method == 'PUT') {
                        method = 'POST';
                    } else if (method == 'POST') {
                        method = 'PUT';
                    }

                    var options = self.share.applyRequestDefaults({
                        url: url,
                        method: method,
                        headers: {}
                    });

                    var getRequest = function () {
                        return request(options, function (err, resp, body) {
                            if (err) {
                                // failed
                                handleError(path, method, err);
                            } else if (resp.statusCode != 200 && resp.statusCode != 201) {
                                handleError(path, method, 'unexpected status code: ' + resp.statusCode);
                            } else {
                                self.rq.removeRequest(path, function (err) {
                                    if (err) {
                                        handleError(path, method, err);
                                    } else {
                                        self.emit('syncend', {file: path, method: method});
                                        processItems(cb);
                                    }
                                });
                            }
                        })
                    };

                    if (method == 'POST' || method == 'PUT') {
                        options.headers['content-type'] = utils.lookupMimeType(path);
                        var read;
                        try {
                            read = fs.createReadStream(path);
                        } catch (e) {
                            handleError(path, method, e);
                            return;
                        }

                        read.on('error', function (err) {
                            handleError(path, method, err);
                        });

                        read.pipe(getRequest());
                    } else {
                        getRequest();
                    }
                } else {
                    cb();
                }
            }
        });
    };

    var eventLoop = function () {
        self.timeout = setTimeout(function () {
            processItems(function (err) {
                if (err) {
                    self.emit('error', err);
                }

                if (!self.stopped) {
                    eventLoop();
                }
            });
        }, config.frequency);
    };
    eventLoop();
};

/**
 * Stops the processor by exiting the event loop.
 */
RQProcessor.prototype.stop = function () {
    if (this.timeout) {
        clearTimeout(this.timeout);
    }
    this.stopped = true;
};

module.exports = RQProcessor;