const config = require('./webpack.base.config');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

const rendererConfig = { ...config };
rendererConfig.target = 'electron-renderer';
rendererConfig.entry = {
  'preload': './src/preload/preload.ts',
};

rendererConfig.plugins = [...(config.plugins || [])];

rendererConfig.plugins.push(new HtmlWebpackPlugin({
  template: './src/renderer/overlay.html',
  filename: path.join(__dirname, './dist/renderer/overlay.html'),
  inject: false,
}));

rendererConfig.plugins.push(new HtmlWebpackPlugin({
  template: './src/renderer/main.html',
  filename: path.join(__dirname, './dist/renderer/main.html'),
  inject: false,
}));

rendererConfig.plugins.push(new HtmlWebpackPlugin({
  template: './src/renderer/champ-select.html',
  filename: path.join(__dirname, './dist/renderer/champ-select.html'),
  inject: false,
}));

module.exports = rendererConfig;
