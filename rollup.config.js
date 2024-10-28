import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import terser from '@rollup/plugin-terser'

export default {
    input: 'src/index.js',
    output: { dir: 'dist' },
    plugins: [nodeResolve(), commonjs(), json(), terser()],
}
