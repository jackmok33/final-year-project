import { existsSync, readdirSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = join(frontend, 'src')

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesIn(path) : [path]
  })
}

// Static copy, type declarations, bootstrapping and template styling are verified
// through their consumers. They do not need empty, one-assertion companion tests.
function needsCompanion(path) {
  return !(
    path.startsWith('test/') ||
    (path.startsWith('content/') && path !== 'content/formatText.ts') ||
    path.endsWith('.d.ts') ||
    [
      'main.tsx',
      'services/contracts.ts',
      'services/demo/contracts.ts',
      'mantis/config.ts',
      'mantis/types.ts',
    ].includes(path) ||
    path.startsWith('mantis/theme/') ||
    /^mantis\/layout\/(AppBarStyled|DrawerHeaderStyled|MiniDrawerStyled)\./.test(path)
  )
}

const files = filesIn(sourceRoot).filter((file) => /\.tsx?$/.test(file))
const sources = files.filter((file) => !/\.test\.tsx?$/.test(file))
const tests = files.filter((file) => /\.test\.tsx?$/.test(file))
const missing = sources.filter((file) => {
  if (!needsCompanion(relative(sourceRoot, file).split(sep).join('/'))) return false
  const stem = file.slice(0, -extname(file).length)
  return !['.test.ts', '.test.tsx'].some((extension) => existsSync(stem + extension))
})
const orphaned = tests.filter((file) => {
  const stem = file.replace(/\.test\.tsx?$/, '')
  return !['.ts', '.tsx'].some((extension) => existsSync(stem + extension))
})

for (const file of missing) console.error(`Missing companion: ${relative(frontend, file)}`)
for (const file of orphaned) console.error(`No matching source: ${relative(frontend, file)}`)
if (missing.length || orphaned.length) process.exitCode = 1
else
  console.log(
    `Test layout passed: ${tests.length} colocated test files, no missing or orphaned companions.`,
  )
