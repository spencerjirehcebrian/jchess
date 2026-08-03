// Mock HTMLCanvasElement WebGL context to prevent Three.js WebGL context creation warnings in Happy DOM
if (typeof window !== 'undefined' && HTMLCanvasElement.prototype) {
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof originalGetContext>) {
    const contextId = args[0]
    if (contextId === 'webgl' || contextId === 'webgl2' || contextId === 'experimental-webgl') {
      return {
        getExtension: () => null,
        getParameter: () => 0,
        getShaderPrecisionFormat: () => ({ precision: 23, rangeMin: 127, rangeMax: 127 }),
        createTexture: () => ({}),
        bindTexture: () => {},
        texParameteri: () => {},
        createBuffer: () => ({}),
        bindBuffer: () => {},
        bufferData: () => {},
        createFramebuffer: () => ({}),
        bindFramebuffer: () => {},
        createRenderbuffer: () => ({}),
        bindRenderbuffer: () => {},
        renderbufferStorage: () => {},
        framebufferRenderbuffer: () => {},
        checkFramebufferStatus: () => 36053, // FRAMEBUFFER_COMPLETE
        clearColor: () => {},
        clearDepth: () => {},
        clearStencil: () => {},
        clear: () => {},
        enable: () => {},
        disable: () => {},
        depthFunc: () => {},
        blendFunc: () => {},
        viewport: () => {},
        createShader: () => ({}),
        shaderSource: () => {},
        compileShader: () => {},
        getShaderParameter: () => true,
        createProgram: () => ({}),
        attachShader: () => {},
        linkProgram: () => {},
        getProgramParameter: () => true,
        useProgram: () => {},
        getAttribLocation: () => 0,
        getUniformLocation: () => ({}),
        enableVertexAttribArray: () => {},
        vertexAttribPointer: () => {},
        drawArrays: () => {},
        drawElements: () => {},
        deleteShader: () => {},
        deleteProgram: () => {},
        deleteBuffer: () => {},
        deleteTexture: () => {},
        deleteFramebuffer: () => {},
        deleteRenderbuffer: () => {},
        canvas: this,
      } as any
    }
    return originalGetContext.apply(this, args as any)
  }
}
