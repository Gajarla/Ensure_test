const webpack = require('webpack');
const path = require('path');
const CompressionWebpackPlugin = require('compression-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

module.exports = {
  eslint: {
    enable: false // 🚀 disable ESLint during build (faster builds)
  },
  webpack: {
    configure: (webpackConfig, { env }) => {
      /** --------------------------
       * 1. Exclude unnecessary source maps
       * -------------------------- */
      const sourceMapLoaderRule = webpackConfig.module.rules.find(
        (rule) =>
          rule.enforce === 'pre' &&
          rule.use &&
          rule.use.some((useEntry) =>
            typeof useEntry === 'string'
              ? useEntry.includes('source-map-loader')
              : useEntry.loader?.includes('source-map-loader')
          )
      );

      if (sourceMapLoaderRule) {
        sourceMapLoaderRule.exclude = [
          ...(sourceMapLoaderRule.exclude || []),
          path.resolve(__dirname, 'node_modules', 'stylis-plugin-rtl')
        ];
      }

      /** --------------------------
       * 2. Handle MUI ESM imports
       * -------------------------- */
      webpackConfig.module.rules.push({
        test: /\.js$/,
        resolve: { fullySpecified: false },
        include: [
          /node_modules\/@mui\/material/,
          /node_modules\/@mui\/x-tree-view/,
          /node_modules\/@mui\/system/,
          /node_modules\/@mui\/base/,
          /node_modules\/@mui\/icons-material/
        ],
        type: 'javascript/auto'
      });

      /** --------------------------
       * 3. Node core polyfills
       * -------------------------- */
      webpackConfig.resolve = {
        ...webpackConfig.resolve,
        extensions: [...(webpackConfig.resolve?.extensions || []), '.mjs', '.js', '.jsx', '.json'],
        fallback: {
          ...webpackConfig.resolve?.fallback,
          path: require.resolve('path-browserify'),
          fs: false,
          os: require.resolve('os-browserify/browser.js'),
          buffer: require.resolve('buffer/'),
          process: require.resolve('process/browser.js'),
          stream: require.resolve('stream-browserify'),
          util: require.resolve('util/'),
          assert: require.resolve('assert/'),
          crypto: require.resolve('crypto-browserify'),
          vm: false
        }
      };

      /** --------------------------
       * 4. Global process + Buffer
       * -------------------------- */
      webpackConfig.plugins = [
        ...(webpackConfig.plugins || []),
        new webpack.ProvidePlugin({
          process: 'process/browser.js',
          Buffer: ['buffer', 'Buffer']
        })
      ];

      /** --------------------------
       * 5. Persistent caching (speeds up rebuilds)
       * -------------------------- */
      webpackConfig.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__filename]
        }
      };

      /** --------------------------
       * 6. Production-only settings
       * -------------------------- */
      if (env === 'production') {
        // Compression (gzip only - let server handle Brotli)
        webpackConfig.plugins.push(
          new CompressionWebpackPlugin({
            algorithm: 'gzip',
            test: /\.(js|css|html|svg|json)$/,
            threshold: 10 * 1024,
            minRatio: 0.8
          })
        );

        // Advanced code splitting
        webpackConfig.optimization.splitChunks = {
          chunks: 'all',
          minSize: 200000,
          maxSize: 1024000,
          maxInitialRequests: 15,
          maxAsyncRequests: 30,
          cacheGroups: {
            reactCore: {
              test: /[\\/]node_modules[\\/](react|react-dom|redux|react-router-dom)/,
              name: 'react-core-vendors',
              chunks: 'all',
              priority: 50,
              reuseExistingChunk: true
            },
            vendors: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
              enforce: true
            }
          }
        };

        webpackConfig.optimization.runtimeChunk = 'single';

        // Minification
        webpackConfig.optimization.minimize = true;
        webpackConfig.optimization.minimizer = [
          new TerserPlugin({
            terserOptions: {
              parse: { ecma: 2020 },
              compress: {
                ecma: 2015,
                drop_console: true,
                drop_debugger: true,
                passes: 1, // ⚡ faster than 3
                pure_funcs: ['console.info', 'console.debug']
              },
              format: { comments: false }
            },
            extractComments: false,
            parallel: true
          }),
          new CssMinimizerPlugin({
            parallel: true
          })
        ];
      }

      return webpackConfig;
    }
  }
};
