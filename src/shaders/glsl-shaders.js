const modules = import.meta.glob("./*.glsl", { as: "raw", eager: false })

const shaders = Object.fromEntries(
  Object.entries(modules).map(([path, module]) => {
    const name = path.replace("./", "")
    const fn = async () => await module()
    return [name, fn]
  })
)

export default shaders
