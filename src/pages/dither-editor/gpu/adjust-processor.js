(function (app) {
    // AdjustProcessor 嘗試用 WebGL 加速亮度、對比、飽和度。
    // 若瀏覽器不支援 WebGL 或 shader 失敗，就永久降級到呼叫端提供的 CPU fallback。
    var processor = null;
    var disabled = false;

    function apply(imageData, settings, fallback) {
        // 失敗後設為 disabled，避免每次滑桿調整都重複建立 WebGL context。
        if (disabled) {
            return fallback();
        }
        try {
            processor = processor || createProcessor();
            if (!processor) {
                disabled = true;
                return fallback();
            }
            return processor.run(imageData, settings);
        } catch (error) {
            disabled = true;
            return fallback();
        }
    }

    function createProcessor() {
        // 建立一個離畫面 canvas，將整張圖當 texture 丟到 fragment shader 逐像素處理。
        var canvas = document.createElement('canvas');
        var gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: true }) ||
            canvas.getContext('experimental-webgl', { antialias: false, preserveDrawingBuffer: true });
        if (!gl) {
            return null;
        }

        var program = createProgram(gl, vertexShaderSource(), fragmentShaderSource());
        var positionLocation = gl.getAttribLocation(program, 'a_position');
        var texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
        var uniforms = {
            image: gl.getUniformLocation(program, 'u_image'),
            brightnessFactor: gl.getUniformLocation(program, 'u_brightnessFactor'),
            contrastFactor: gl.getUniformLocation(program, 'u_contrastFactor'),
            saturationFactor: gl.getUniformLocation(program, 'u_saturationFactor')
        };

        var positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
            gl.STATIC_DRAW
        );

        var texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
            gl.STATIC_DRAW
        );

        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        return {
            run: function run(imageData, settings) {
                // WebGL 的 readPixels 會從左下角開始讀，所以最後要 flipRows 回 canvas/ImageData 慣用方向。
                var width = imageData.width;
                var height = imageData.height;
                canvas.width = width;
                canvas.height = height;
                gl.viewport(0, 0, width, height);
                gl.useProgram(program);

                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
                gl.uniform1i(uniforms.image, 0);
                gl.uniform1f(uniforms.brightnessFactor, cssFactor(Number(settings.brightness || 0)));
                gl.uniform1f(uniforms.contrastFactor, cssFactor(Number(settings.contrast || 0)));
                gl.uniform1f(uniforms.saturationFactor, cssFactor(Number(settings.saturation || 0)));

                gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                gl.enableVertexAttribArray(positionLocation);
                gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
                gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
                gl.enableVertexAttribArray(texCoordLocation);
                gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
                gl.drawArrays(gl.TRIANGLES, 0, 6);

                var pixels = new Uint8Array(width * height * 4);
                gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                return new ImageData(flipRows(pixels, width, height), width, height);
            }
        };
    }

    // 將 UI 百分比轉成 shader 使用的倍率。
    function cssFactor(value) {
        return Math.max(0.01, 1 + value / 100);
    }

    // 將 WebGL readPixels 的上下顛倒結果翻回 ImageData 座標系。
    function flipRows(pixels, width, height) {
        var rowSize = width * 4;
        var output = new Uint8ClampedArray(pixels.length);
        for (var y = 0; y < height; y += 1) {
            var sourceStart = (height - y - 1) * rowSize;
            output.set(pixels.subarray(sourceStart, sourceStart + rowSize), y * rowSize);
        }
        return output;
    }

    // 編譯並連結 vertex/fragment shader。
    function createProgram(gl, vertexSource, fragmentSource) {
        var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
        var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
        var program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(program));
        }
        return program;
    }

    // 建立單支 shader，若編譯失敗就丟出錯誤讓外層 fallback。
    function createShader(gl, type, source) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    // Vertex shader 繪製覆蓋整個畫布的兩個三角形。
    function vertexShaderSource() {
        return [
            'attribute vec2 a_position;',
            'attribute vec2 a_texCoord;',
            'varying vec2 v_texCoord;',
            'void main() {',
            '  gl_Position = vec4(a_position, 0.0, 1.0);',
            '  v_texCoord = a_texCoord;',
            '}'
        ].join('\n');
    }

    // Fragment shader 逐像素套用 brightness/contrast/saturation。
    function fragmentShaderSource() {
        return [
            'precision highp float;',
            'uniform sampler2D u_image;',
            'uniform float u_brightnessFactor;',
            'uniform float u_contrastFactor;',
            'uniform float u_saturationFactor;',
            'varying vec2 v_texCoord;',
            'void main() {',
            '  vec4 color = texture2D(u_image, v_texCoord);',
            '  vec3 rgb = color.rgb;',
            '  rgb *= u_brightnessFactor;',
            '  rgb = (rgb - 0.5) * u_contrastFactor + 0.5;',
            '  float gray = dot(rgb, vec3(0.2126, 0.7152, 0.0722));',
            '  rgb = vec3(gray) + (rgb - vec3(gray)) * u_saturationFactor;',
            '  rgb = clamp(rgb, 0.0, 1.0);',
            '  gl_FragColor = vec4(rgb, 1.0);',
            '}'
        ].join('\n');
    }

    app.pages.ditherEditor = app.pages.ditherEditor || {};
    app.pages.ditherEditor.adjustProcessor = {
        apply: apply
    };
})(window.DitherApp);
