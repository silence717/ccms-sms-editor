var path = require('path');
var webpack = require('webpack');
var merge = require('webpack-merge');
var commonModule = require('./webpack-common-module');
var commonPlugins = require('./webpack-common-plugins');

commonModule.module.rules.push(
	{
		test: /\.(sc|c)ss$/,
		use: [{
			loader: 'style-loader'
		}, {
			loader: 'css-loader'
		}, {
			loader: 'postcss-loader'
		}, {
			loader: 'resolve-url-loader'
		}, {
			loader: 'sass-loader',
			options: {
				sourceMap: true
			}
		}],
		exclude: /(node_modules|bower_components)/
	}
);

module.exports = merge(commonModule, commonPlugins, {
	mode: 'development',
	devtool: 'source-map',
	entry: {
		components: ['webpack-hot-middleware/client?path=/__webpack_hmr&reload=true', './src/index.js']
	},
	output: {
		path: path.join(__dirname, 'build'),
		filename: '[name].js',
		publicPath: '/' // hot loader publish dir
	},
	plugins: [
		new webpack.HotModuleReplacementPlugin()
	],
	resolve: {
		extensions: ['.js']
	}
});
