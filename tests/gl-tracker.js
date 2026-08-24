// Wraps a WebGL2 context so that every resource created through it is recorded until it is
// deleted. Tests use it to assert that an encoder does not leak GL objects.

const KINDS = ["Texture", "Buffer", "Framebuffer", "Renderbuffer", "Program", "Shader", "VertexArray", "Sampler", "Query"]

export function trackGL(gl) {
  const live = new Map() // handle -> kind

  const proxy = new Proxy(gl, {
    get(target, prop) {
      const value = target[prop]
      if (typeof value !== "function") return value

      for (const kind of KINDS) {
        if (prop === `create${kind}`) {
          return (...args) => {
            const handle = value.apply(target, args)
            if (handle) live.set(handle, kind)
            return handle
          }
        }
        if (prop === `delete${kind}`) {
          return handle => {
            live.delete(handle)
            return value.call(target, handle)
          }
        }
      }
      return value.bind(target)
    }
  })

  return {
    gl: proxy,
    live,
    /** Human-readable summary of live resources, e.g. "Texture x2, Program x1". */
    describe() {
      const counts = {}
      for (const kind of live.values()) counts[kind] = (counts[kind] ?? 0) + 1
      return Object.entries(counts)
        .map(([k, n]) => `${k} x${n}`)
        .join(", ")
    }
  }
}
