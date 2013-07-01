(function() {

var size = 100000;

buster.testCase(
  "browser",
  {
    setUp: function() {
      this.timeout = 1000;
    },
    tearDown: function() {
    },
    "sequential": function(done) {
      var sequential = "";
      var packed;
      var unpacked;
      var i;

      for (i = 0; i < size; ++i) {
        sequential += String.fromCharCode(i & 0xff);
      }

      // pack
      packed = PngPack.pack(sequential);

      // unpack sync
      unpacked = PngPack.unpack(packed);
      assert(unpacked, sequential);

      // async
      PngPack.unpackAsync(packed, function(unpacked) {
        assert(unpacked, sequential);
        done();
      });
    },
    "random": function(done) {
      var random = "";
      var packed;
      var unpacked;
      var i;

      for (i = 0; i < size; ++i) {
        random += String.fromCharCode((Math.random() * 256) | 0);
      }

      // pack
      packed = PngPack.pack(random);

      // unpack sync
      unpacked = PngPack.unpack(packed);
      assert(unpacked, random);

      // unpack async
      PngPack.unpackAsync(packed, function(unpacked) {
        assert(unpacked, random);
        done();
      });
    }
  }
);

})();
