/*
 * grunt-buster
 * https://github.com/gboyegadada/grunt-buster
 *
 * Copyright (c) 2019 Gboyega Dada
 * Licensed under the MIT license.
 */

'use strict';

var crypto = require('crypto');
var through = require('through');
var Promise = require('bluebird');
var path = require('path');
var assign = require('object-assign');

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('buster', 'Cache buster plugin for Grunt"', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
      fileName: 'busters.json',
      algo: 'md5',
      length: 0,
      transform: Object,
      formatter: JSON.stringify,
      relativePath: '.',
      separator: "\n"
    });

    var 
    hashesStore = {}, // options.fileName: { relativePath: hash }
    hashes = hashesStore[options.fileName] = hashesStore[options.fileName] || {},
    hashingPromises = [];
    
    function hash(file, options) {
      return typeof options.algo === 'function' 
        ? options.algo.call(undefined, file) 
        : crypto.createHash(options.algo).update(file).digest('hex');
    }

    function sliceHash(hash, options) {
      // positive length = leading characters; negative = trailing
      return options.length
        ? options.length > 0
          ? hash.slice(0, options.length)
          : hash.slice(options.length)
        : hash;
    }

    function relativePath(projectPath, relPath, filePath) {
      return path.relative(path.join(projectPath, relPath), filePath).replace(/\\/g, '/');
    }

    function hashFile(file) {
      // start hashing files as soon as they are received for maximum concurrency
      hashingPromises.push(
        Promise.try(hash.bind(undefined, file.content, options)).then(function(hashed) {
          if (typeof hashed !== 'string') grunt.util.error('Return/fulfill value of `options.algo` must be a string');
          hashes[relativePath(file.cwd, options.relativePath, file.path)] = sliceHash(hashed, options);
        })
      );
    }

    // Iterate over all specified file groups.
    this.files.forEach(function(f) {
      // Concat specified files.
      var src = f.src.filter(function(filepath) {
        // Warn on and remove invalid source files (if nonull was set).
        if (!grunt.file.exists(filepath)) {
          grunt.log.warn('Source file "' + filepath + '" not found.');
          return false;
        } else {
          return true;
        }
      }).map(function(filepath) {
        // Read file source.
        return grunt.file.read(filepath);
      }).join(grunt.util.normalizelf(options.separator));

      // Write the destination file.
      grunt.file.write(f.dest, src);

      // Read file source.
      hashFile({ 
        cwd: '.',
        path: f.dest, 
        content: src
      });

      // Print a success message.
      grunt.log.writeln('File "' + f.dest + '" created.');
    });
    

    Promise.all(hashingPromises).bind(this).then(function() {
      return options.transform.call(undefined, assign({}, hashes));
    }).then(function(transformed) {
      return options.formatter.call(undefined, transformed);
    }).then(function(formatted) {
      if (typeof formatted !== 'string') grunt.util.error('Return/fulfill value of `options.formatter` must be a string');

      grunt.file.write(path.join('./', options.fileName), formatted);
    }).catch(function(err) {
      grunt.log.writeln('error', err);
    });

  });

};
