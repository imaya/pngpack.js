/**
 * @license
 * pngpack.js
 * Fast ByteString Compressor.
 * https://github.com/imaya/pngpack.js
 *
 * The MIT License
 *
 * Copyright (c) 2012 imaya
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
(function(global) {

global.PngPack = PngPack;
global.PngUnpack = PngUnpack;

/**
 * @type {string}
 * @const
 */
var ChunkName = 'plEN'; // padding length

/** @type {HTMLCanvasElement} */
var packCanvas = document.createElement('canvas');
/** @type {CanvasRenderingContext2D} */
var packCtx = packCanvas.getContext('2d');

/**
 * pack ByteString to PNG string.
 * @param {string} str plain byte string.
 * @param {boolean=} opt_dataurl if true then return data url value.
 * @param {boolean=} opt_doublebyte if true then return double byte string.
 * @return {string} compressed data PNG (DataURL, Base64 encoded).
 */
function PngPack(str, opt_dataurl, opt_doublebyte) {
  /** @type {HTMLCanvasElement} */
  var canvas = packCanvas;
  /** @type {CanvasRenderingContext2D} */
  var ctx = packCtx;
  /** @type {ImageData} */
  var imageData;
  /** @type {CanvasPixelArray|Uint8ClampedArray} */
  var pixelArray;
  /** @type {number} */
  var i;
  /** @type {number} */
  var il;
  /** @type {number} */
  var max = 0x8000;
  /** @type {number} */
  var width;
  /** @type {number} */
  var height;
  /** @type {number} */
  var padding;
  /** @type {string} */
  var dataurl;
  /** @type {number} */
  var datastart;
  /** @type {string} */
  var bytestring;

  // calculate width, height
  width = (str.length + 2) / 3 | 0;
  height = (width / max | 0) + 1;
  width = (width + height - 1) / height | 0;

  canvas.width = width;
  canvas.height = height;
  imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  pixelArray = imageData.data;

  // Alpha 値は 255 以外にすると premultiplied alpha によって
  // RGB 値が変化してしまう
  for (i = 0, il = str.length / 3; i < il; ++i) {
    pixelArray[i * 4]     = str.charCodeAt(i * 3)     | 0;
    pixelArray[i * 4 + 1] = str.charCodeAt(i * 3 + 1) | 0;
    pixelArray[i * 4 + 2] = str.charCodeAt(i * 3 + 2) | 0;
    pixelArray[i * 4 + 3] = 255;
  }

  // calculate padding length
  padding = pixelArray.length - ((str.length / 3 | 0) * 4 + str.length % 3);

  // create PNG data
  ctx.putImageData(imageData, 0, 0);
  dataurl = canvas.toDataURL('image/png');
  datastart = dataurl.indexOf(',') + 1;

  // insert padding chunk
  bytestring = window.atob(dataurl.slice(datastart));
  bytestring = insertPaddingChunk(bytestring, padding);

  return opt_dataurl ? dataurl.slice(0, datastart) + window.btoa(bytestring) :
         opt_doublebyte ? toDoubleByteString(bytestring) :
         bytestring;
}

/**
 * Unpack Data PNG.
 * @param {string} dataurl compressed data PNG URL.
 * @param {function(string)} callback unpacked data handler function.
 * @param {boolean=} opt_doublebyte data is doublebyte encoded?
 */
function PngUnpack(dataurl, callback, opt_doublebyte) {
  /** @type {HTMLCanvasElement} */
  var canvas = document.createElement('canvas');
  /** @type {CanvasRenderingContext2D} */
  var ctx = canvas.getContext('2d');
  /** @type {HTMLImageElement} */
  var img = document.createElement('img');

  // Data URL
  if (dataurl.slice(0, 5) !== 'data:') {
    dataurl = 'data:image/png;base64,' + window.btoa(opt_doublebyte ?
        fromDoubleByteString(dataurl) :
        dataurl
    );
  }

  img.addEventListener('load', function onload() {
    /** @type {Array.<string>} */
    var data = [];
    /** @type {ImageData} */
    var imageData;
    /** @type {CanvasPixelArray|Uint8ClampedArray} */
    var pixelArray;
    /** @type {number} */
    var i;
    /** @type {number} */
    var il;
    /** @type {number} */
    var pos;
    /** @type {string} */
    var bytestring;
    /** @type {number} */
    var padding = 0;
    /** @type {number} */
    var chunkType;
    /** @type {number} */
    var chunkData;
    /** @type {number} */
    var chunkCRC32;
    /** @type {number} */
    var chunkLength;
    /** @type {number} */
    var tmplen;

    img.removeEventListener('load', onload);

    // get padding length
    bytestring = window.atob(dataurl.slice(dataurl.indexOf(',') + 1));

    for(i = 8, il = bytestring.length; i < il;) {
      // Length
      chunkLength = (
        (bytestring.charCodeAt(i++) << 24) |
        (bytestring.charCodeAt(i++) << 16) |
        (bytestring.charCodeAt(i++) <<  8) |
        (bytestring.charCodeAt(i++))
        ) >>> 0;
      // Type
      chunkType = bytestring.slice(i, i += 4);
      // Data
      if (chunkType === ChunkName) {
        padding = (
          (bytestring.charCodeAt(i    ) << 24) |
          (bytestring.charCodeAt(i + 1) << 16) |
          (bytestring.charCodeAt(i + 2) <<  8) |
          (bytestring.charCodeAt(i + 3))
        ) >>> 0;
      }
      i += chunkLength;
      // CRC-32
      i += 4;

    }

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0, img.width, img.height);

    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    pixelArray = imageData.data;

    tmplen = (pixelArray.length - padding);
    tmplen = (tmplen / 4 | 0) * 3 + (tmplen % 4);
    for (i = pos = 0, il = tmplen; i < il; ++i) {
      if (pos % 4 === 3) pos++;
      data[i] = String.fromCharCode(pixelArray[pos++]);
    }

    callback(data.join(''));

    img.src = '';
  }, false);
  img.src = dataurl;
}

/**
 * insert padding chunk to png bytestring.
 * @param {string} byteString PNG bytestring.
 * @param {number} padding padding length.
 * @return {string} PNG bytestring.
 * @private
 */
function insertPaddingChunk(bytestring, padding) {
  /** @type {string} */
  var signature;
  /** @type {number} */
  var pos;
  /** @type {number} */
  var chunkLength;
  /** @type {number} */
  var chunkType;
  /** @type {number} */
  var chunkData;
  /** @type {number} */
  var chunkCRC32;
  /** @type {string} */
  var iend;
  /** @type {number} */
  var i;
  /** @type {number} */
  var il;

  signature = bytestring.slice(0, 8);

  // enchant padding chunk
  for(i = 8, il = bytestring.length; i < il;) {
    pos = i;
    chunkLength = (
      (bytestring.charCodeAt(i++) << 24) |
      (bytestring.charCodeAt(i++) << 16) |
      (bytestring.charCodeAt(i++) <<  8) |
      (bytestring.charCodeAt(i++))
    ) >>> 0;
    chunkType = bytestring.slice(i, i += 4);
    i += chunkLength; // Data
    i += 4; // CRC-32

    // insert data padding chunk before IEND chunk
    if (chunkType === 'IEND') {
      iend = bytestring.slice(pos);

      chunkLength = String.fromCharCode(0, 0, 0, 4);
      chunkType = ChunkName;
      chunkData = String.fromCharCode(
        padding >> 24 & 0xff, padding >> 16 & 0xff,
        padding >>  8 & 0xff, padding       & 0xff
      );
      chunkCRC32 = String.fromCharCode(0, 0, 0, 0); // XXX

      bytestring = [
        bytestring.slice(0, pos),
        chunkLength, chunkType, chunkData, chunkCRC32,
        bytestring.slice(pos)
      ].join('');
      break;
    }
  }

  return bytestring;
}

/**
 * single bytestring to double bytestring.
 * @param {string} bytestring single bytestring.
 * @return {string} double bytestring.
 */
function toDoubleByteString(bytestring) {
  /** @type {Array.<string>} */
  var chars = [];
  /** @type {number} */
  var code;
  /** @type {number} */
  var next;
  /** @type {number} */
  var pos = 0;
  /** @type {number} */
  var i;
  /** @type {number} */
  var il;

  // first byte is odd or even check byte
  chars[pos++] = String.fromCharCode(bytestring.length % 2);

  for (i = 0, il = bytestring.length; i < il; i += 2) {
    code = bytestring.charCodeAt(i);
    next = bytestring.charCodeAt(i + 1) | 0;
    chars[pos++] = String.fromCharCode((code << 8) | next);
  }

  return chars.join('');
}

/**
 * double bytestring to single bytestring.
 * @param {string} bytestring double bytestring.
 * @return {string} single bytestring.
 */
function fromDoubleByteString(dbytestring) {
  /** @type {Array.<string>} */
  var chars = [];
  /** @type {number} */
  var code;
  /** @type {number} */
  var next;
  /** @type {number} */
  var pos;
  /** @type {number} */
  var i;
  /** @type {number} */
  var il;
  /** @type {number} */
  var odd = dbytestring.charCodeAt(0);

  for (pos = 0, i = 1, il = dbytestring.length - 1; i < il; ++i) {
    code = dbytestring.charCodeAt(i);
    next = code & 0xff;
    code = code >> 8 & 0xff;
    chars[pos++] = String.fromCharCode(code);
    chars[pos++] = String.fromCharCode(next);
  }

  // last character
  code = dbytestring.charCodeAt(++i);
  next = code & 0xff;
  code = code >> 8 & 0xff;
  chars[pos++] = String.fromCharCode(code);
  if (odd === 0) {
    chars[pos++] = String.fromCharCode(next);
  }

  return chars.join('');
}

}).call(this, this);

/* vim:set expandtab ts=2 sw=2 tw=80: */
