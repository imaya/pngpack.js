pngpack.js
==========

pngpack.js は Canvas#toDataURL を利用した高速な byte string 圧縮ライブラリです。


## 使い方

### 圧縮

```js
/** @type {string} */
var bytestring = "hogehoge";
/** @type {string} */
var compressed = PngPack.pack(bytestring);
```

### 伸張

#### 同期

```js
/** @type {string} */
var decompressed = PngPack.unpack(compressed);
```

#### 非同期

```js
PngPack.unpackAsync(compressed, function(decompressed) {
    //...
});
```

## 仕組み

Canvas#toDataURL を利用してブラウザで実装されている ZLIB 圧縮を使用する事で JavaScript よりも高速に圧縮します。
ただし、PNG形式でデータが梱包されるため、ふつうの ZLIB 形式よりも容量を消費することがあります。
また、Canvas で premultiplied-alpha によるデータの変化を防ぐためアルファ値を必ず 255 に固定しないといけないことから、圧縮前のデータサイズが 4/3 に増加してしまいます。
ピクセルのデータ境界などの関係で必要となるパディングの情報を独自のプライベートチャンクを追加することで記録しています。
