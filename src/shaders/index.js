const modules = import.meta.glob("./*.wgsl", { query: "?raw&inline" })

const shaders = Object.fromEntries(
  Object.entries(modules).map(([path, module]) => {
    const name = path.replace("./", "")
    const fn = async () => (await module()).default
    return [name, fn]
  })
)

export default shaders
