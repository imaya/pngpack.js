goog.provide('PngPack');

goog.require('Zlib.Util');
goog.require('Zlib.Inflate');

goog.scope(function() {

/**
 * @define {string}
 */
PngPack.ChunkName = 'plEN'; // padding length
/** @type {boolean} */
PngPack.UseTypedArray = window.Uint8Array === void 0;
/** @type {HTMLCanvasElement} */
PngPack.packCanvas =
  /** @type {HTMLCanvasElement} */
  (document.createElement('canvas'));
/** @type {CanvasRenderingContext2D} */
PngPack.packContext =
  /** @type {CanvasRenderingContext2D} */
  (PngPack.packCanvas.getContext('2d'));

/**
 * pack ByteString to PNG string.
 * @param {string} str plain byte string.
 * @return {string} compressed data PNG (DataURL, Base64 encoded).
 */
PngPack.pack = function(str) {
  /** @type {HTMLCanvasElement} */
  var canvas = PngPack.packCanvas;
  /** @type {CanvasRenderingContext2D} */
  var ctx = PngPack.packContext;
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
    pixelArray[i * 4    ] = str.charCodeAt(i * 3)     | 0;
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
  bytestring = PngPack.insertPaddingChunk(bytestring, padding);

  return bytestring;
};

PngPack.unpack = function(dataurl) {
  /** @type {string} */
  var bytestring;
  /** @type {Array.<number>} */
  var bytearray;
  /** @type {!(Array.<number>|Uint8Array)} */
  var pixelArray;
  /** @type {number} */
  var padding;
  /** @type {number} */
  var chunkLength;
  /** @type {number} */
  var nextPosition;
  /** @type {number} */
  var width;
  /** @type {number} */
  var height;
  /** @type {Array.<Array.<number>>} */
  var idat = [];
  /** @type {number} */
  var i;
  /** @type {number} */
  var il;

  // Data URL
  if (dataurl.slice(0, 22) === 'data:image/png;base64,') {
    bytestring = dataurl.slice(22);
  } else {
    bytestring = dataurl;
  }

  bytearray = Zlib.Util.stringToByteArray(bytestring);

  if (bytestring.slice(0, 8) !== String.fromCharCode(137, 80, 78, 71, 13, 10, 26, 10)) {
    throw new Error('invalid png signature');
  }

  for (i = 8, il = bytearray.length; i < il;) {
    chunkLength = (
      (bytearray[i++] << 24) |
      (bytearray[i++] << 16) |
      (bytearray[i++] <<  8) |
      (bytearray[i++]      )
    ) >>> 0;

    nextPosition = i + chunkLength + 8;

    switch (bytestring.slice(i, i += 4)) {
      case 'IHDR':
        width = (
          (bytearray[i + 0] << 24) |
          (bytearray[i + 1] << 16) |
          (bytearray[i + 2] <<  8) |
          (bytearray[i + 3]      )
        ) >>> 0;
        height = (
          (bytearray[i + 4] << 24) |
          (bytearray[i + 5] << 16) |
          (bytearray[i + 6] <<  8) |
          (bytearray[i + 7]      )
        ) >>> 0;
        break;
      case 'IDAT':
        idat.push(bytearray.slice(i, i += chunkLength));
        break;
      case PngPack.ChunkName:
        padding = (
          (bytearray[i    ] << 24) |
          (bytearray[i + 1] << 16) |
          (bytearray[i + 2] <<  8) |
          (bytearray[i + 3])
        ) >>> 0;
        break;
      default:
        break;
    }

    i = nextPosition;
  }

  pixelArray = PngPack.idatToPixelArray(
    new Zlib.Inflate(Array.prototype.concat.apply([], idat)).decompress(),
    width,
    height
  );

  return PngPack.pixelArrayToString(pixelArray, padding);
};

/**
 * @param {(Array.<number>|Uint8Array|Uint8ClampedArray)} pixelArray
 * @param {number} padding
 * @returns {string}
 */
PngPack.pixelArrayToString = function(pixelArray, padding) {
  /** @type {number} */
  var tmplen = (pixelArray.length - padding);
  /** @type {Array.<string>} */
  var data;
  /** @type {number} */
  var pos;
  /** @type {number} */
  var i;
  /** @type {number} */
  var il;

  tmplen = (tmplen / 4 | 0) * 3 + (tmplen % 4);
  data = new Array(tmplen);

  for (i = pos = 0, il = tmplen; i < il; ++i) {
    if (pos % 4 === 3) {
      pos++;
    }
    data[i] = String.fromCharCode(pixelArray[pos++]);
  }

  return data.join('');
};

/**
 * @param {!(Array.<number>|Uint8Array)} bytearray
 * @param {number} width
 * @param {number} height
 * @returns {!(Array.<number>|Uint8Array)}
 */
PngPack.idatToPixelArray = function(bytearray, width, height) {
  /** @type {!(Array.<number>|Uint8Array)} */
  var pixelArray = new (PngPack.UseTypedArray ? Uint8Array : Array)(width * height * 4);
  /** @type {number} */
  var x;
  /** @type {number} */
  var y;
  /** @type {number} */
  var filter;
  /** @type {number} */
  var readLineHead;
  /** @type {number} */
  var writeLineHead;
  /** @type {number} */
  var left;
  /** @type {number} */
  var up;
  /** @type {number} */
  var leftup;
  /** @type {number} */
  var min;
  /** @type {number} */
  var current;

  width *= 4;

  for (y = 0; y < height; ++y) {
    readLineHead = y * (1 + width);
    writeLineHead = y * width;
    filter = bytearray[readLineHead];
    for (x = 0; x < width; ++x) {
      current = bytearray[readLineHead + x + 1];
      switch (filter) {
        case 0: // None
          pixelArray[readLineHead + x] = current;
          break;
        case 1: // Sub
          left = (x < 4 ? 0 : pixelArray[writeLineHead + x - (1 * 4)]);
          pixelArray[writeLineHead + x] = (left + current) & 0xff;
          break;
        case 2: // Up
          up = (y === 0 ? 0 : pixelArray[writeLineHead + x - width]);
          pixelArray[writeLineHead + x] = up + current & 0xff;
          break;
        case 3: // Average
          left = (x < 4 ? 0 : pixelArray[writeLineHead + x - (1 * 4)]);
          up = (y === 0 ? 0 : pixelArray[writeLineHead + x - width]);
          pixelArray[writeLineHead + x] = ((left + up) / 2 | 0) + current & 0xff;
          break;
        case 4: // Paeth
          leftup = ((x < 4 || y === 0) ? 0 : pixelArray[writeLineHead + x - (1 * 4) - width]);
          left = (x < 4 ? 0 : pixelArray[writeLineHead + x - (1 * 4)]);
          up = (y === 0 ? 0 : pixelArray[writeLineHead + x - width]);
          min = Math.min([
            Math.abs(left   - current),
            Math.abs(up     - current),
            Math.abs(leftup - current)
          ]);
          if (min === Math.abs(left - current)) {
            pixelArray[writeLineHead + x] = left + current & 0xff;
          } else if (min === Math.abs(up - current)) {
            pixelArray[writeLineHead + x] = up + current & 0xff;
          } else {
            pixelArray[writeLineHead + x] = leftup + current & 0xff;
          }
          break;
        default:
          throw new Error('invalid filter');
      }
    }
  }

  return pixelArray;
};


/**
 * Unpack Data PNG.
 * @param {string} dataurl compressed data PNG URL.
 * @param {function(string)} callback unpacked data handler function.
 */
PngPack.unpackAsync = function(dataurl, callback) {
  /** @type {HTMLCanvasElement} */
  var canvas =
    /** @type {HTMLCanvasElement} */
    (document.createElement('canvas'));
  /** @type {CanvasRenderingContext2D} */
  var ctx =
    /** @type {CanvasRenderingContext2D} */
    (canvas.getContext('2d'));
  /** @type {HTMLImageElement} */
  var img =
    /** @type {HTMLImageElement} */
    (document.createElement('img'));

  // Data URL
  if (dataurl.slice(0, 5) !== 'data:') {
    dataurl = 'data:image/png;base64,' + window.btoa(dataurl);
  }

  img.addEventListener('load', function onload() {
    /** @type {ImageData} */
    var imageData;
    /** @type {CanvasPixelArray} */
    var pixelArray;
    /** @type {number} */
    var i;
    /** @type {number} */
    var il;
    /** @type {string} */
    var bytestring;
    /** @type {number} */
    var padding = 0;
    /** @type {number} */
    var chunkType;
    /** @type {number} */
    var chunkLength;

    img.removeEventListener('load', onload, false);

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
      if (chunkType === PngPack.ChunkName) {
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

    callback(PngPack.pixelArrayToString(pixelArray, padding));

    img.src = '';
  }, false);
  img.src = dataurl;
};

/**
 * insert padding chunk to png bytestring.
 * @param {string} bytestring PNG bytestring.
 * @param {number} padding padding length.
 * @return {string} PNG bytestring.
 * @private
 */
PngPack.insertPaddingChunk = function(bytestring, padding) {
  /** @type {number} */
  var pos;
  /** @type {number} */
  var chunkLength;
  /** @type {string} */
  var chunkType;
  /** @type {number} */
  var i;
  /** @type {number} */
  var il;

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
      bytestring = [
        // Before chunk
        bytestring.slice(0, pos),
        // Length
        String.fromCharCode(0, 0, 0, 4),
        // Type
        PngPack.ChunkName,
        // Data
        String.fromCharCode(
          padding >> 24 & 0xff, padding >> 16 & 0xff,
          padding >>  8 & 0xff, padding       & 0xff
        ),
        // CRC
        String.fromCharCode(0, 0, 0, 0), // XXX
        // After chunk
        bytestring.slice(pos)
      ].join('');
      break;
    }
  }

  return bytestring;
};

/**
 * single bytestring to double bytestring.
 * @param {string} bytestring single bytestring.
 * @return {string} double bytestring.
 */
PngPack.toDoubleByteString = function(bytestring) {
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
};

/**
 * double bytestring to single bytestring.
 * @param {string} dbytestring double bytestring.
 * @return {string} single bytestring.
 */
PngPack.fromDoubleByteString = function(dbytestring) {
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
    chars[pos] = String.fromCharCode(next);
  }

  return chars.join('');
};

});
/* vim:set expandtab ts=2 sw=2 tw=80: */
