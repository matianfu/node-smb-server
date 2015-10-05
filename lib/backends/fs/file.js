/*************************************************************************
 *
 * ADOBE CONFIDENTIAL
 * ___________________
 *
 *  Copyright 2015 Adobe Systems Incorporated
 *  All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Adobe Systems Incorporated and its suppliers,
 * if any.  The intellectual and technical concepts contained
 * herein are proprietary to Adobe Systems Incorporated and its
 * suppliers and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Adobe Systems Incorporated.
 **************************************************************************/

'use strict';

var util = require('util');
var Path = require('path');
var fs = require('fs');

var File = require('../../spi/file');

/**
 * Creates an instance of File.
 *
 * @constructor
 * @this {FSFile}
 * @param {String} filePath normalized file path
 * @param {fs.Stats} stats fs.Stats object
 */
var FSFile = function (filePath, stats) {
  if (! (this instanceof FSFile)) {
    return new FSFile(filePath, stats);
  }
  this.stats = stats;

  File.call(this, filePath);
};

// the FSFile prototype inherits from File
util.inherits(FSFile, File);

/**
 * Return a flag indicating whether this is a file.
 *
 * @return {Boolean} <code>true</code> if this is a file;
 *         <code>false</code> otherwise
 */
FSFile.prototype.isFile = function () {
  return this.stats.isFile();
};

/**
 * Return a flag indicating whether this is a directory.
 *
 * @return {Boolean} <code>true</code> if this is a directory;
 *         <code>false</code> otherwise
 */
FSFile.prototype.isDirectory = function () {
  return this.stats.isDirectory();
};

/**
 * Return the file size.
 *
 * @return {Number} file size, in bytes
 */
FSFile.prototype.size = function () {
  return this.stats.size;
};

/**
 * Return the number of bytes that are allocated to the file.
 *
 * @return {Number} allocation size, in bytes
 */
FSFile.prototype.allocationSize = function () {
  return this.stats.blocks * this.stats.blksize;
};

/**
 * Return the time of last modification, in milliseconds since
 * Jan 1, 1970, 00:00:00.0.
 *
 * @return {Number} time of last modification
 */
FSFile.prototype.lastModified = function () {
  return this.stats.mtime.getTime();
};

/**
 * Return the time when file status was last changed, in milliseconds since
 * Jan 1, 1970, 00:00:00.0.
 *
 * @return {Number} when file status was last changed
 */
FSFile.prototype.lastChanged = function () {
  return this.stats.ctime.getTime();
};

/**
 * Return the create time, in seconds since Jan 1, 1970, 00:00:00.0.
 * Jan 1, 1970, 00:00:00.0.
 *
 * @return {Number} time created
 */
FSFile.prototype.created = function () {
  return this.stats.birthtime.getTime();
};

/**
 * Return the time of last access, in seconds since Jan 1, 1970, 00:00:00.0.
 * Jan 1, 1970, 00:00:00.0.
 *
 * @return {Number} time of last access
 */
FSFile.prototype.lastAccessed = function () {
  return this.stats.atime.getTime();
};

/**
 * Read bytes at a certain position inside the file.
 *
 * @param {Buffer} buffer the buffer that the data will be written to
 * @param {Number} offset the offset in the buffer to start writing at
 * @param {Number} length the number of bytes to read
 * @param {Number} position offset where to begin reading from in the file
 * @param {Function} cb callback called with the bytes actually read
 * @param {String|Error} cb.error error (non-null if an error occurred)
 * @param {Number} cb.bytesRead number of bytes actually read
 * @param {Buffer} cb.buffer buffer holding the bytes actually read
 */
FSFile.prototype.read = function (buffer, offset, length, position, cb) {
  fs.open(this.filePath, 'r', function (err, fd) {
    if (err) {
      cb(err);
      return;
    }
    fs.read(fd, buffer, offset, length, position, function (err, bytesRead, buffer) {
      fs.close(fd, function (ignored) {
        cb(err, bytesRead, buffer);
      });
    });
  });
};

/**
 * Write bytes at a certain position inside the file.
 *
 * @param {Buffer} data buffer to write
 * @param {Number} position position inside file
 * @param {Function} cb callback called on completion
 * @param {String|Error} cb.error error (non-null if an error occurred)
 */
FSFile.prototype.write = function (data, position, cb) {
  fs.open(this.filePath, 'r+', function (err, fd) {
    if (err) {
      cb(err);
      return;
    }
    fs.write(fd, data, 0, data.length, position, function (err, bytesWritten, buffer) {
      fs.close(fd, function (ignored) {
        cb(err);
      });
    });
  });
};

/**
 * Sets the file length.
 *
 * @param {Number} length file length
 * @param {Function} cb callback called on completion
 * @param {String|Error} cb.error error (non-null if an error occurred)
 */
FSFile.prototype.setLength = function (length, cb) {
  fs.truncate(this.filePath, length, cb);
};

/**
 * Delete this file or directory. If this file denotes a directory, it must
 * be empty in order to be deleted.
 *
 * @param {Function} cb callback called on completion
 * @param {String|Error} cb.error error (non-null if an error occurred)
 */
FSFile.prototype.delete = function (cb) {
  fs.unlink(this.filePath, cb);
};

/**
 * Flush the contents of the file to disk.
 *
 * @param {Function} cb callback called on completion
 * @param {String|Error} cb.error error (non-null if an error occurred)
 */
FSFile.prototype.flush = function (cb) {
  // there's nothing to do here
  process.nextTick(function () { cb(); });
};

/**
 * Close this file, releasing any resources.
 *
 * @param {Function} cb callback called on completion
 * @param {String|Error} cb.error error (non-null if an error occurred)
 */
FSFile.prototype.close = function (cb) {
  // there's nothing to do here
  process.nextTick(function () { cb(); });
};

module.exports = FSFile;

