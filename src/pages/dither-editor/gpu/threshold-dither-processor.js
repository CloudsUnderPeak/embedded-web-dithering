(function (app) {
    // ThresholdDitherProcessor 用 WebGL 加速 ordered / halftone 類逐像素 threshold dither。
    // Tri Mix 保留 CPU，避免 shader 組合量過大且難以維持 palette mapping 語意。
    var MAX_PALETTE_COLORS = 32;
    var processor = null;
    var disabled = false;
    var lastRunBackend = 'cpu';

    function mappingMode(id) {
        var normalized = app.pages.ditherEditor.paletteMapping.normalizeId(id);
        if (normalized === 'nearest-color') {
            return 0;
        }
        if (normalized === 'pair-mix') {
            return 1;
        }
        return -1;
    }

    function canUseGpu(options) {
        return options && options.ditherBackend !== 'cpu'
            && options.palette
            && options.palette.length > 0
            && options.palette.length <= MAX_PALETTE_COLORS
            && mappingMode(options.paletteMapping) !== -1
            && distanceMode(options.colorDistance) !== -1;
    }

    function apply(imageData, options, thresholdConfig, fallback) {
        lastRunBackend = 'cpu';
        if (disabled || !canUseGpu(options)) {
            if (options && options.ditherBackend === 'gpu') {
                throw new Error('Threshold GPU backend does not support the current dither options.');
            }
            return fallback();
        }
        try {
            processor = processor || createProcessor();
            if (!processor) {
                disabled = true;
                return fallback();
            }
            lastRunBackend = 'gpu';
            return processor.run(imageData, options, thresholdConfig);
        } catch (error) {
            lastRunBackend = 'cpu';
            if (options && options.ditherBackend === 'gpu') {
                throw error;
            }
            disabled = true;
            return fallback();
        }
    }

    function createProcessor() {
        if (typeof document === 'undefined') {
            return null;
        }
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
            thresholdMap: gl.getUniformLocation(program, 'u_thresholdMap'),
            imageSize: gl.getUniformLocation(program, 'u_imageSize'),
            matrixSize: gl.getUniformLocation(program, 'u_matrixSize'),
            thresholdLevels: gl.getUniformLocation(program, 'u_thresholdLevels'),
            paletteLength: gl.getUniformLocation(program, 'u_paletteLength'),
            palette: gl.getUniformLocation(program, 'u_palette'),
            thresholdScale: gl.getUniformLocation(program, 'u_thresholdScale'),
            thresholdStrength: gl.getUniformLocation(program, 'u_thresholdStrength'),
            thresholdCellScale: gl.getUniformLocation(program, 'u_thresholdCellScale'),
            distanceMode: gl.getUniformLocation(program, 'u_distanceMode'),
            mappingMode: gl.getUniformLocation(program, 'u_mappingMode')
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

        var imageTexture = createTexture(gl);
        var thresholdTexture = createTexture(gl);
        var thresholdCacheKey = null;

        return {
            run: function run(imageData, options, thresholdConfig) {
                var width = imageData.width;
                var height = imageData.height;
                var matrixSize = thresholdConfig.matrixSize;
                canvas.width = width;
                canvas.height = height;
                gl.viewport(0, 0, width, height);
                gl.useProgram(program);

                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, imageTexture);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
                gl.uniform1i(uniforms.image, 0);

                if (thresholdCacheKey !== thresholdConfig.cacheKey) {
                    gl.activeTexture(gl.TEXTURE1);
                    gl.bindTexture(gl.TEXTURE_2D, thresholdTexture);
                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                    gl.texImage2D(
                        gl.TEXTURE_2D,
                        0,
                        gl.RGBA,
                        matrixSize,
                        matrixSize,
                        0,
                        gl.RGBA,
                        gl.UNSIGNED_BYTE,
                        encodeThresholdRanks(thresholdConfig.thresholds, thresholdConfig.levels)
                    );
                    thresholdCacheKey = thresholdConfig.cacheKey;
                } else {
                    gl.activeTexture(gl.TEXTURE1);
                    gl.bindTexture(gl.TEXTURE_2D, thresholdTexture);
                }
                gl.uniform1i(uniforms.thresholdMap, 1);

                gl.uniform2f(uniforms.imageSize, width, height);
                gl.uniform1f(uniforms.matrixSize, matrixSize);
                gl.uniform1f(uniforms.thresholdLevels, thresholdConfig.levels);
                gl.uniform1i(uniforms.paletteLength, options.palette.length);
                gl.uniform3fv(uniforms.palette, paletteUniform(options.palette));
                gl.uniform1f(uniforms.thresholdScale, thresholdConfig.thresholdScale / 255);
                gl.uniform1f(uniforms.thresholdStrength, thresholdConfig.thresholdStrength || 1);
                gl.uniform1f(uniforms.thresholdCellScale, thresholdConfig.thresholdCellScale || 1);
                gl.uniform1i(uniforms.distanceMode, distanceMode(options.colorDistance));
                gl.uniform1i(uniforms.mappingMode, mappingMode(options.paletteMapping));

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

    function createTexture(gl) {
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        return texture;
    }

    function encodeThresholdRanks(thresholds, levels) {
        var output = new Uint8Array(thresholds.length * 4);
        for (var i = 0; i < thresholds.length; i += 1) {
            var value = Math.max(0, Math.min(65535, Math.floor(thresholds[i] * levels)));
            var index = i * 4;
            output[index] = (value >> 8) & 255;
            output[index + 1] = value & 255;
            output[index + 2] = 0;
            output[index + 3] = 255;
        }
        return output;
    }

    function paletteUniform(palette) {
        var values = new Float32Array(MAX_PALETTE_COLORS * 3);
        for (var i = 0; i < palette.length && i < MAX_PALETTE_COLORS; i += 1) {
            var offset = i * 3;
            values[offset] = paletteChannel(palette[i].r);
            values[offset + 1] = paletteChannel(palette[i].g);
            values[offset + 2] = paletteChannel(palette[i].b);
        }
        return values;
    }

    // 與 CPU normalizedPalette 相同的 round + clamp，確保 GPU 最近色判斷一致。
    function paletteChannel(value) {
        var number = Number(value);
        if (!Number.isFinite(number)) {
            return 0;
        }
        return app.core.colorUtils.clampByte(number) / 255;
    }

    function distanceMode(id) {
        var normalized = app.core.paletteUtils.normalizeColorDistanceId(id);
        if (normalized === 'euclidean-bt709') {
            return 0;
        }
        if (normalized === 'euclidean-rgb') {
            return 1;
        }
        if (normalized === 'manhattan-bt709') {
            return 2;
        }
        if (normalized === 'manhattan-rgb') {
            return 3;
        }
        return -1;
    }

    function flipRows(pixels, width, height) {
        var rowSize = width * 4;
        var output = new Uint8ClampedArray(pixels.length);
        for (var y = 0; y < height; y += 1) {
            var sourceStart = (height - y - 1) * rowSize;
            output.set(pixels.subarray(sourceStart, sourceStart + rowSize), y * rowSize);
        }
        return output;
    }

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

    function createShader(gl, type, source) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader));
        }
        return shader;
    }

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

    function fragmentShaderSource() {
        return [
            'precision highp float;',
            '#define MAX_PALETTE_COLORS 32',
            'uniform sampler2D u_image;',
            'uniform sampler2D u_thresholdMap;',
            'uniform vec2 u_imageSize;',
            'uniform float u_matrixSize;',
            'uniform float u_thresholdLevels;',
            'uniform int u_paletteLength;',
            'uniform vec3 u_palette[MAX_PALETTE_COLORS];',
            'uniform float u_thresholdScale;',
            'uniform float u_thresholdStrength;',
            'uniform float u_thresholdCellScale;',
            'uniform int u_distanceMode;',
            'uniform int u_mappingMode;',
            'varying vec2 v_texCoord;',
            'float thresholdAt(vec2 pixel) {',
            '  vec2 cell = mod(floor(pixel * u_thresholdCellScale), vec2(u_matrixSize));',
            '  vec2 uv = (cell + vec2(0.5)) / u_matrixSize;',
            '  vec4 encoded = texture2D(u_thresholdMap, uv);',
            '  float rank = encoded.r * 65280.0 + encoded.g * 255.0;',
            '  return (rank + 0.5) / u_thresholdLevels;',
            '}',
            'float distanceTo(vec3 a, vec3 b) {',
            '  vec3 delta = a - b;',
            '  if (u_distanceMode == 1) {',
            '    return dot(delta, delta);',
            '  }',
            '  if (u_distanceMode == 2) {',
            '    vec3 absolute = abs(delta);',
            '    return dot(absolute, vec3(0.2126, 0.7152, 0.0722));',
            '  }',
            '  if (u_distanceMode == 3) {',
            '    vec3 absoluteRgb = abs(delta);',
            '    return absoluteRgb.r + absoluteRgb.g + absoluteRgb.b;',
            '  }',
            '  vec3 weighted = delta * delta;',
            '  return dot(weighted, vec3(0.2126, 0.7152, 0.0722));',
            '}',
            'vec3 nearestColor(vec3 target) {',
            '  vec3 best = u_palette[0];',
            '  float bestDistance = distanceTo(target, best);',
            '  for (int i = 1; i < MAX_PALETTE_COLORS; i += 1) {',
            '    if (i < u_paletteLength) {',
            '      float currentDistance = distanceTo(target, u_palette[i]);',
            '      if (currentDistance < bestDistance) {',
            '        bestDistance = currentDistance;',
            '        best = u_palette[i];',
            '      }',
            '    }',
            '  }',
            '  return best;',
            '}',
            'vec3 pairMixColor(vec3 target, float cutoff) {',
            '  vec3 bestA = nearestColor(target);',
            '  vec3 bestB = bestA;',
            '  float bestRatio = 0.0;',
            '  float bestDistance = 1.0e20;',
            '  for (int a = 0; a < MAX_PALETTE_COLORS; a += 1) {',
            '    if (a < u_paletteLength) {',
            '      for (int b = 0; b < MAX_PALETTE_COLORS; b += 1) {',
            '        if (b < u_paletteLength && b > a) {',
            '          vec3 colorA = u_palette[a];',
            '          vec3 vectorAB = u_palette[b] - colorA;',
            '          float lengthSq = dot(vectorAB, vectorAB);',
            '          if (lengthSq > 0.0) {',
            '            float ratio = dot(target - colorA, vectorAB) / lengthSq;',
            '            ratio = clamp(ratio, 0.0, 1.0);',
            '            vec3 mixed = colorA + vectorAB * ratio;',
            '            float currentDistance = distanceTo(target, mixed);',
            '            if (currentDistance < bestDistance) {',
            '              bestA = colorA;',
            '              bestB = u_palette[b];',
            '              bestRatio = ratio;',
            '              bestDistance = currentDistance;',
            '            }',
            '          }',
            '        }',
            '      }',
            '    }',
            '  }',
            '  return bestRatio > cutoff ? bestB : bestA;',
            '}',
            'void main() {',
            '  vec4 source = texture2D(u_image, v_texCoord);',
            '  vec2 pixel = vec2(floor(gl_FragCoord.x), floor(u_imageSize.y - gl_FragCoord.y));',
            '  float threshold = thresholdAt(pixel);',
            '  if (u_mappingMode == 1) {',
            '    float cutoff = 0.5 + (threshold - 0.5) * u_thresholdStrength;',
            '    gl_FragColor = vec4(pairMixColor(source.rgb, cutoff), 1.0);',
            '  } else {',
            '    float offset = (threshold - 0.5) * u_thresholdScale;',
            '    gl_FragColor = vec4(nearestColor(source.rgb + vec3(offset)), 1.0);',
            '  }',
            '}'
        ].join('\n');
    }

    app.pages.ditherEditor = app.pages.ditherEditor || {};
    app.pages.ditherEditor.thresholdDitherProcessor = {
        apply: apply,
        lastRunBackend: function lastRunBackendValue() {
            return lastRunBackend;
        }
    };
})(window.DitherApp);
