import { defineConfig, type UserConfig } from 'tsdown'

const PLUGIN_ID = 'dsh-phanthy-connect'

/**
 * 浏览器半身：DSH 的模块加载器交给 bundle 一个 `require` shim 并读
 * `module.exports`，所以输出是「CJS 包在 loader 调用里」。React 与所有
 * DSH 客户端包都由宿主提供，绝不能打进来。
 *
 * 宿主半身（index.js）是手写的零依赖 ESM，不参与构建。
 */
const client: UserConfig = {
  entry: { client: 'src/client/index.tsx' },
  outDir: 'lib',
  format: ['cjs'],
  platform: 'browser',
  dts: false,
  clean: false,
  deps: {
    neverBundle: [
      'react',
      'react/jsx-runtime',
      '@deepseek-ai/cordis',
      '@deepseek-ai/dsh-client-locale',
      '@deepseek-ai/dsh-client-ui-primitives',
      '@deepseek-ai/dsh-client-ui-renderer',
      '@deepseek-ai/dsh-client-ui-plugin-manager',
      '@deepseek-ai/dsh-client-ui-settings',
      '@deepseek-ai/dsh-client-ui-slots',
    ],
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default defineConfig([client])
