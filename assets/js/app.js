!function() {


  /* ======================================================
  // Utilities
  // ------------------------------------------------------ */

  function getImageLoadPromises(files) {
    var promises = [];
    files.forEach(function (file) {
      promises.push(loadImage(file));
    });
    return promises;
  }

  function loadImage(image) {
    var promise = new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.src = image;
    });
    return promise;
  }

  function createCanvas(width, height) {
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function isSameData(data1, data2) {
    if (data1.length !== data2.length) return false;
    for (var i = 0, l = data1.length; i < l; ++i) {
      if (data1[i] !== data2[i]) return false;
    }
    return true;
  }

  function dataURItoBlob(dataURI) {
    var byteString = atob(dataURI.split(',')[1]);
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    var ab = new ArrayBuffer(byteString.length);
    var ia = new Uint8Array(ab);
    for (var i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab],{ "type" : mimeString });
  }


  /* ======================================================
  // Uploader
  // ------------------------------------------------------ */

  Vue.component('uploader', {
    data: function() {
      return {
        files: []
      }
    },
    methods: {
      onDragOver: function(e) {
        e.preventDefault();
      },
      onDrop: function(e) {
        e.preventDefault();
        var files = e.dataTransfer.files;
        this.files = _(files).chain()
          .filter(function(file) {
            return /^image\//.test(file.type);
          })
          .map(function(file) {
            return {
              type: file.type,
              name: file.name,
              src: URL.createObjectURL(file),
              keyframe: false
            }
          })
          .sortBy(function(file) { return file.name })
          .value();
        if (this.files.length) {
          this.files[0].keyframe = true;
          this.$dispatch('uploaded', this);
        }
      },
      onClick: function() {
        alert('!!!');
      }
    }
  });


  /* ======================================================
  // Arranger
  // ------------------------------------------------------ */

  Vue.component('arranger', {
    created: function() {
      this.$on('keyframe', function() {
        var keyframes = [];
        this.files.forEach(function(file, i) {
          if (file.keyframe) keyframes.push(i);
        });
        this.$data.keyframes = keyframes.join(',');
      });
    },
    data: function() {
      return {
        fps: 30,
        keyframes: '0',
        files: [],
        sheets: []
      }
    },
    watch: {
      fps: function(val, oldVal) {
        if (!val) return;
        this.rearrange();
      }
    },
    methods: {
      setFiles: function(files) {
        this.$data.files = files;
        this.rearrange();
      },
      rearrange: function() {
        var sheets = [];
        var j = 0;
        for (var i = 0, l = this.$data.files.length; i < l; ++i) {
          j = Math.floor(i / this.$data.fps);
          if (i % this.$data.fps === 0) {
            sheets[j] = {files: []};
          }
          sheets[j].files.push(this.$data.files[i]);
        }
        this.$data.sheets = sheets;
      },
      refreshFiles: function() {
        if (!this.$data.keyframes) debugger;
        var keyframes = this.$data.keyframes.split(/\s*,\s*/);
        keyframes = _(keyframes).chain()
          .filter(function(kf) { return !_.isNaN(parseInt(kf, 0)) })
          .map(function(kf) { return parseInt(kf, 0) })
          .uniq()
          .value();
        keyframes.sort(function(a, b) { return a - b });
        this.$data.keyframes = keyframes.join(',');
        this.files.forEach(function(file, i) {
          file.keyframe = keyframes.indexOf(i) >= 0;
        });
      },
      back: function() {
        //this.$root.mode = 'upload';
        this.$dispatch('back');
      },
      generate: function() {
        //this.$root.mode = 'result';
        this.$dispatch('generate', this);
      }
    }
  });


  /* ======================================================
  // File
  // ------------------------------------------------------ */

  Vue.component('file', {
    watch: {
      keyframe: function() {
        this.$dispatch('keyframe');
      }
    }
  });


  /* ======================================================
  // Result
  // ------------------------------------------------------ */

  Vue.component('result', {
    data: function() {
      return {
        generating: false,
        generatingIndex: -1,
        sheets: []
      }
    },
    watch: {
      generating: function() {
        if (!this.generating) {
          spinner.stop();
        }
      },
      generatingIndex: function() {
        var els = this.$el.querySelectorAll('.result__output');
        spinner.spin(els[this.generatingIndex]);
      }
    },
    methods: {
      start: function(data) {
        this.$data.sheets = data.sheets;
        this.$data.generating = true;
        this.$data.generatingIndex = 0;

        var files = data.files;
        var fps = data.fps;
        var keyframes = data.keyframes.split(',').map(function(kf) { return parseInt(kf, 0) });
        var promises = getImageLoadPromises(files.map(function(file) { return file.src }));
        Promise.all(promises).then(function (images) {

          // スケールは最初の画像から取得する
          var width = images[0].width;
          var height = images[0].height;

          // 差分抽出につかうバッファー1
          var canvas = createCanvas(width, height);
          var context = canvas.getContext('2d');

          // 差分抽出につかうバッファー1
          var canvas2 = createCanvas(width, height);
          var context2 = canvas2.getContext('2d');

          // 出力用キャンバス
          var canvasOut = createCanvas(width, height * fps);
          var contextOut = canvasOut.getContext('2d');

          var i = 0;
          var next = function() {
            ++i;
            if (i < images.length) {
              if (i % fps === 0) {
                this.$data.generatingIndex = i / fps;
                this.outputCanvas(i / fps - 1, canvasOut);
                canvasOut = createCanvas(width, height * fps);
                contextOut = canvasOut.getContext('2d');
              }
              setTimeout(tick, 0);
            } else {
              this.$data.generating = false;
              this.outputCanvas(Math.floor((i - 1) / fps), canvasOut);
            }
          }.bind(this);

          // 各画像に対する処理
          var tick = function() {

            if (!this.generating) return;

            if (keyframes.indexOf(i) >= 0) {
              context.drawImage(images[i], 0, 0);
              contextOut.drawImage(images[i], 0, (i % fps) * height);
              next();
              return;
            }

            context2.drawImage(images[i], 0, 0);

            // 16x16を一つのタイルとする。
            var tileSize = 16;
            var tilesX = Math.ceil(width / tileSize);
            var tilesY = Math.ceil(height / tileSize);

            var x, y, differCount = 0;
            for (var j = 0; j < tilesX; ++j) {
              for(var k = 0; k < tilesY; ++k) {
                x = tileSize * j;
                y = tileSize * k;
                var pixelData  = context.getImageData(x, y, tileSize, tileSize);
                var pixelData2 = context2.getImageData(x, y, tileSize, tileSize);
                if (!isSameData(pixelData.data, pixelData2.data)) {
                  contextOut.drawImage(canvas2, x, y, tileSize, tileSize, x, (i % fps) * height + y, tileSize, tileSize);
                  differCount++;
                }
              }
            }

            next();
          }.bind(this);

          // 処理開始
          tick();

        }.bind(this));
      },
      outputCanvas: function(i, canvasOut) {
        var blob = dataURItoBlob(canvasOut.toDataURL());
        var url = window.URL.createObjectURL(blob);
        var target = this.$el.querySelectorAll('.result__output')[i];
        var image  = new Image();
        target.appendChild(image);
        image.src = url;
      },
      back: function() {
        this.generating = false;
        this.$dispatch('back');
      }
    }
  });


  /* ======================================================
  // Initialization
  // ------------------------------------------------------ */

  var vm = new Vue({
    el: '#app',
    data: {
      mode: 'upload',
      files: []
    },
    created: function() {
      this.$on('uploaded', function(uploader) {
        this.files = uploader.files;
        this.mode = 'arrange';
        this.$.arranger.setFiles(this.files);
      });
      this.$on('back', function() {
        switch (this.mode) {
        case 'arrange':
          this.mode = 'upload';
          break;
        case 'result':
          this.mode = 'arrange';
          break;
        }
      });
      this.$on('generate', function(arranger) {
        this.mode = 'result';
        this.$.result.start({
          sheets: arranger.$data.sheets,
          files: arranger.$data.files,
          fps: arranger.$data.fps,
          keyframes: arranger.$data.keyframes
        });
      });
    }
  });

  var spinner = new Spinner({
    lines: 7, // The number of lines to draw
    length: 0, // The length of each line
    width: 5, // The line thickness
    radius: 6, // The radius of the inner circle
    corners: 1, // Corner roundness (0..1)
    rotate: 0, // The rotation offset
    direction: 1, // 1: clockwise, -1: counterclockwise
    color: '#000', // #rgb or #rrggbb or array of colors
    speed: 1, // Rounds per second
    trail: 54, // Afterglow percentage
    shadow: false, // Whether to render a shadow
    hwaccel: false, // Whether to use hardware acceleration
    className: 'spinner', // The CSS class to assign to the spinner
    zIndex: 2e9, // The z-index (defaults to 2000000000)
    top: '50%', // Top position relative to parent
    left: '50%' // Left position relative to parent
  });


}();
