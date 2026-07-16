import { VERTEX_SHADER, type ShaderDef } from "./shaders"

export type MediaSource =
  | { kind: "image"; el: HTMLImageElement; width: number; height: number }
  | { kind: "video"; el: HTMLVideoElement; width: number; height: number }

export type CanvasSettings = {
  width: number
  height: number
  offsetX: number // -1..1 pan across canvas
  offsetY: number // -1..1
  zoom: number // scale multiplier on top of contain-fit
  bgMode: 0 | 1 | 2 // 0 none (transparent), 1 solid color, 2 image
  bgColor: [number, number, number] // 0..1
}

export const DEFAULT_CANVAS: Omit<CanvasSettings, "width" | "height"> = {
  offsetX: 0,
  offsetY: 0,
  zoom: 1,
  bgMode: 0,
  bgColor: [0.06, 0.06, 0.06],
}

// Compose pass: places the media into the canvas with fit + zoom + offset over a background.
const COMPOSE_FRAGMENT = `
  precision highp float;
  varying vec2 v_uv;
  uniform sampler2D u_media;
  uniform sampler2D u_bg;
  uniform vec2 u_canvasSize;
  uniform vec2 u_mediaSize;
  uniform vec2 u_offset;
  uniform float u_zoom;
  uniform float u_bgMode;
  uniform vec3 u_bgColor;

  void main() {
    float fit = min(u_canvasSize.x / u_mediaSize.x, u_canvasSize.y / u_mediaSize.y);
    vec2 disp = u_mediaSize * fit * u_zoom;
    vec2 p = (v_uv - 0.5) * u_canvasSize;
    vec2 off = u_offset * u_canvasSize * 0.5;
    vec2 muv = (p - off) / disp + 0.5;

    vec4 bg;
    if (u_bgMode < 0.5) {
      bg = vec4(0.0);
    } else if (u_bgMode < 1.5) {
      bg = vec4(u_bgColor, 1.0);
    } else {
      bg = texture2D(u_bg, v_uv);
    }

    if (muv.x < 0.0 || muv.x > 1.0 || muv.y < 0.0 || muv.y > 1.0) {
      gl_FragColor = bg;
    } else {
      vec4 m = texture2D(u_media, muv);
      gl_FragColor = mix(bg, m, m.a);
    }
  }
`

// Passthrough pass: blits a texture straight to the target (used when no shader is enabled).
const PASSTHROUGH_FRAGMENT = `
  precision highp float;
  varying vec2 v_uv;
  uniform sampler2D u_texture;
  void main() { gl_FragColor = texture2D(u_texture, v_uv); }
`

type CompiledLayer = { program: WebGLProgram; params: Record<string, number> }

// Multi-pass WebGL renderer: compose media into a framed texture, then run a chain
// of shader passes over it via ping-pong framebuffers.
export class ShaderRenderer {
  private gl: WebGLRenderingContext
  private canvas: HTMLCanvasElement
  private composeProgram: WebGLProgram
  private passthroughProgram: WebGLProgram
  private positionBuffer: WebGLBuffer
  private mediaTexture: WebGLTexture
  private bgTexture: WebGLTexture
  private composedTexture: WebGLTexture
  private pingTexture: WebGLTexture
  private pongTexture: WebGLTexture
  private framebuffer: WebGLFramebuffer
  private media: MediaSource | null = null
  private settings: CanvasSettings | null = null
  private hasBgImage = false
  private startTime = performance.now()
  private raf = 0
  private layers: CompiledLayer[] = []
  private programCache = new Map<string, WebGLProgram>()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true, premultipliedAlpha: false })
    if (!gl) throw new Error("WebGL is not supported in this browser")
    this.gl = gl

    this.positionBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)

    this.mediaTexture = this.createTexture(true)
    this.bgTexture = this.createTexture(true)
    this.composedTexture = this.createTexture(false)
    this.pingTexture = this.createTexture(false)
    this.pongTexture = this.createTexture(false)
    this.framebuffer = gl.createFramebuffer()!

    this.composeProgram = this.buildProgram(VERTEX_SHADER, COMPOSE_FRAGMENT)
    this.passthroughProgram = this.buildProgram(VERTEX_SHADER, PASSTHROUGH_FRAGMENT)
  }

  private createTexture(flipY: boolean): WebGLTexture {
    const gl = this.gl
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    // Store flipY intent on the object for later uploads.
    ;(tex as unknown as { _flipY: boolean })._flipY = flipY
    return tex
  }

  private compile(type: number, source: string): WebGLShader {
    const gl = this.gl
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader)
      gl.deleteShader(shader)
      throw new Error("Shader compile error: " + log)
    }
    return shader
  }

  private buildProgram(vsSource: string, fsSource: string): WebGLProgram {
    const gl = this.gl
    const vs = this.compile(gl.VERTEX_SHADER, vsSource)
    const fs = this.compile(gl.FRAGMENT_SHADER, fsSource)
    const program = gl.createProgram()!
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error("Program link error: " + gl.getProgramInfoLog(program))
    }
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    return program
  }

  // Build the shader chain from the enabled layers, caching programs by fragment source.
  setLayers(layers: { shader: ShaderDef; params: Record<string, number> }[]) {
    this.layers = layers.flatMap(({ shader, params }) => {
      let program = this.programCache.get(shader.fragment)
      if (!program) {
        program = this.buildProgram(VERTEX_SHADER, shader.fragment)
        this.programCache.set(shader.fragment, program)
      }
      // Progressive blur runs as a true 2-pass separable Gaussian (H then V).
      if (shader.id === "progressiveBlur") {
        return [
          { program, params: { ...params, pass: 0 } },
          { program, params: { ...params, pass: 1 } },
        ]
      }
      return [{ program, params }]
    })
  }

  setMedia(media: MediaSource) {
    this.media = media
  }

  setSettings(settings: CanvasSettings) {
    this.settings = settings
    this.resize()
  }

  setBackgroundImage(img: HTMLImageElement | null) {
    if (!img) {
      this.hasBgImage = false
      return
    }
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.bgTexture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    this.hasBgImage = true
  }

  private resize() {
    if (!this.settings) return
    const maxDim = 1920
    const { width, height } = this.settings
    const scale = Math.min(1, maxDim / Math.max(width, height))
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))
    if (this.canvas.width === w && this.canvas.height === h) return
    this.canvas.width = w
    this.canvas.height = h

    // (Re)allocate the intermediate target textures to match canvas size.
    const gl = this.gl
    for (const tex of [this.composedTexture, this.pingTexture, this.pongTexture]) {
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    }
  }

  private uploadMedia() {
    if (!this.media) return
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.mediaTexture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.media.el)
    } catch {
      // Video frame may not be ready yet.
    }
  }

  private bindQuad(program: WebGLProgram) {
    const gl = this.gl
    const posLoc = gl.getAttribLocation(program, "a_position")
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)
  }

  private composePass() {
    const gl = this.gl
    if (!this.media || !this.settings) return
    const w = this.canvas.width
    const h = this.canvas.height

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.composedTexture, 0)
    gl.viewport(0, 0, w, h)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(this.composeProgram)
    this.bindQuad(this.composeProgram)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.mediaTexture)
    gl.uniform1i(gl.getUniformLocation(this.composeProgram, "u_media"), 0)

    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.bgTexture)
    gl.uniform1i(gl.getUniformLocation(this.composeProgram, "u_bg"), 1)

    const s = this.settings
    const bgMode = s.bgMode === 2 && !this.hasBgImage ? 0 : s.bgMode
    gl.uniform2f(gl.getUniformLocation(this.composeProgram, "u_canvasSize"), w, h)
    gl.uniform2f(gl.getUniformLocation(this.composeProgram, "u_mediaSize"), this.media.width, this.media.height)
    gl.uniform2f(gl.getUniformLocation(this.composeProgram, "u_offset"), s.offsetX, s.offsetY)
    gl.uniform1f(gl.getUniformLocation(this.composeProgram, "u_zoom"), s.zoom)
    gl.uniform1f(gl.getUniformLocation(this.composeProgram, "u_bgMode"), bgMode)
    gl.uniform3f(gl.getUniformLocation(this.composeProgram, "u_bgColor"), s.bgColor[0], s.bgColor[1], s.bgColor[2])

    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  // Render a single pass: sample srcTexture with `program`, output to `targetTex`
  // (null = draw to the screen).
  private renderPass(
    program: WebGLProgram,
    srcTexture: WebGLTexture,
    targetTex: WebGLTexture | null,
    params: Record<string, number>,
  ) {
    const gl = this.gl
    if (targetTex) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targetTex, 0)
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(program)
    this.bindQuad(program)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, srcTexture)
    const texLoc = gl.getUniformLocation(program, "u_texture")
    if (texLoc) gl.uniform1i(texLoc, 0)

    const resLoc = gl.getUniformLocation(program, "u_resolution")
    if (resLoc) gl.uniform2f(resLoc, this.canvas.width, this.canvas.height)

    const timeLoc = gl.getUniformLocation(program, "u_time")
    if (timeLoc) gl.uniform1f(timeLoc, (performance.now() - this.startTime) / 1000)

    for (const [key, value] of Object.entries(params)) {
      const loc = gl.getUniformLocation(program, "u_" + key)
      if (loc) gl.uniform1f(loc, value)
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  private shaderChain() {
    // No enabled effects: blit the composed frame straight to the screen.
    if (this.layers.length === 0) {
      this.renderPass(this.passthroughProgram, this.composedTexture, null, {})
      return
    }

    let src = this.composedTexture
    const targets = [this.pingTexture, this.pongTexture]
    for (let i = 0; i < this.layers.length; i++) {
      const isLast = i === this.layers.length - 1
      const target = isLast ? null : targets[i % 2]
      this.renderPass(this.layers[i].program, src, target, this.layers[i].params)
      if (!isLast) src = targets[i % 2]
    }
  }

  private draw() {
    if (!this.media || !this.settings) return
    this.uploadMedia()
    this.composePass()
    this.shaderChain()
  }

  start() {
    const loop = () => {
      this.draw()
      this.raf = requestAnimationFrame(loop)
    }
    cancelAnimationFrame(this.raf)
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    cancelAnimationFrame(this.raf)
  }

  capture(): string {
    this.draw()
    return this.canvas.toDataURL("image/png")
  }

  dispose() {
    this.stop()
    const gl = this.gl
    for (const program of this.programCache.values()) gl.deleteProgram(program)
    this.programCache.clear()
    gl.deleteProgram(this.composeProgram)
    gl.deleteProgram(this.passthroughProgram)
    gl.deleteBuffer(this.positionBuffer)
    gl.deleteTexture(this.mediaTexture)
    gl.deleteTexture(this.bgTexture)
    gl.deleteTexture(this.composedTexture)
    gl.deleteTexture(this.pingTexture)
    gl.deleteTexture(this.pongTexture)
    gl.deleteFramebuffer(this.framebuffer)
  }
}
