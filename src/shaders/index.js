const modules = import.meta.glob("./*.wgsl", { query: "?raw&inline" })

const shaders = Object.fromEntries(
  await Promise.all(
    Object.entries(modules).map(async function ([path, module]) {
      const { default: shader } = await module(),
        name = path.replace("./", "")
      return [name, shader]
    })
  )
)

export default shaders
