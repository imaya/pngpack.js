goog.require('PngPack');

/** @define {boolean} */
var PNGPACK_EXPORT = false;

if (PNGPACK_EXPORT) {
  goog.exportSymbol(
    'PngPack.pack',
    PngPack.pack
  );

  goog.exportSymbol(
    'PngPack.unpack',
    PngPack.unpack
  );

  goog.exportSymbol(
    'PngPack.unpackAsync',
    PngPack.unpackAsync
  );

  goog.exportSymbol(
    'PngPack.toDoubleByteString',
    PngPack.toDoubleByteString
  );

  goog.exportSymbol(
    'PngPack.fromDoubleByteString',
    PngPack.fromDoubleByteString
  );
}
