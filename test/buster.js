/**
 * unit test settings for BusterJS.
 */
var config = module.exports;

var fs = require('fs');

// ブラウザでコンパイル前のテスト
config["browser"] = {
  rootPath: "../",
  environment: "browser",
  libs: [
    "bin/pngpack.min.js"
  ],
  tests: [
    'test/browser-test.js'
  ]
};

