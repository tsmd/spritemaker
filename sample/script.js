/* ======================================================
//
//   Player
//
// ====================================================== */


!function(){

	var timer = 0;

	function promisesLoadImage(file) {
		var deferred = new $.Deferred();
		var image = new Image();
		image.onload = function() { deferred.resolve(image) };
		image.onerror = function() { deferred.reject() };
		image.src = file;
		return deferred.promise();
	}

	function stopAnimate() {
		if (timer) {
			clearInterval(timer);
			timer = 0;
		}
	}

	/**
	 * アニメーションする
	 * @param {string} dir ディレクトリ
	 * @param {number} width アニメーションの幅
	 * @param {number} height アニメーションの高さ
	 * @param {number} framesPerSheet シートあたりのフレーム数
	 * @param {number} length 画像枚数
   * @param {number} fps フレームレート
	 * @param {Array.<number>} keyframe キーフレーム
	 */
	function animate(dir, width, height, framesPerSheet, length, keyframe, fps) {
		var promises = [];

		for (var i = 0, l = Math.ceil(length / framesPerSheet); i < l; ++i) {
			promises.push(promisesLoadImage(dir + '/' + i + '.png'));
		}
		$.when.apply($, promises).then(function() {

			var widthHeight = {width: width, height: height};
			var $container = $('.container').css(widthHeight);
			var $buffer = $('.buffer').css(widthHeight);
			var $background = $('.background').css(widthHeight);
			var $foreground = $('.foreground').css(widthHeight);

			var i = 0;
			timer = setInterval(function() {
				var imageNum = Math.floor(i / framesPerSheet);
				var j = i % framesPerSheet;

				// 各画像の最初のフレームの場合はバッファを使用する
				// バッファにはあらかじめ次の画像が描画されているので、z-index を操作して手前にもってくる。
				if (j === 0) {
					$buffer.css({zIndex: 1});
				}
				// 次のフレームですぐにバッファを隠す。
				else if (j === 1) {
					$buffer.css({zIndex: ''});
				}

				// オーバーレイするレイヤー。常に動き続ける。
				$foreground.css({
					background: 'url("' + dir + '/' + imageNum + '.png") no-repeat',
					backgroundPosition: '0 -' + (j * height) + 'px'
				});

				// キーフレームだった場合、背景を切り替える。
				if (keyframe.indexOf(i) >= 0) {
					$background.css({
						background: 'url("' + dir + '/' + imageNum + '.png") no-repeat',
						backgroundPosition: '0 -' + (j * height) + 'px'
					});
				}

				// 次の画像をあらかじめ読み込んでおく
				if (j === 1 && imageNum + 1 < Math.ceil(length / framesPerSheet)) {
					$buffer.css({
						background: 'url("' + dir + '/' + (imageNum + 1) + '.png") no-repeat 0 0'
					});
				}

				if (++i === length) {
					clearInterval(timer);
				}
			}, 1000 / fps)

		}, function() {
			console.error('An error has occurred while loading images.');
		})
	}

	function rotateBuffer() {

	}

	$(function() {
		$('button').on('click', function(e) {
			var $button = $(this);
			var dir = $button.data('dir');
			var width = $button.data('width');
			var height = $button.data('height');
			var framesPerSheet = $button.data('framesPerSheet');
			var length = $button.data('length');
			var keyframe = $button.data('keyframe').split(',').map(function(a) {
				return parseInt(a);
			});
      var fps = $button.data('fps');

			stopAnimate();
			animate(dir, width, height, framesPerSheet, length, keyframe, fps);
		});
	});

}();
