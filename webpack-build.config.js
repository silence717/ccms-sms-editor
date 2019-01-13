var path = require('path');
var webpack = require('webpack');
var CleanPlugin = require('clean-webpack-plugin');
var MiniCssExtractPlugin = require('mini-css-extract-plugin');
var UglifyJsPlugin = require('uglifyjs-webpack-plugin');
var cssNanoCommonOpts = {
	discardComments: {removeAll: true},
	discardDuplicates: true,
	discardOverridden: true,
	discardUnused: true,
	minifyGradients: true
};
var OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');
var loaders = require('./webpack-common-loaders');

loaders.push(
	{
		test: /\.(sc|c)ss$/,
		use: [{
			loader: MiniCssExtractPlugin.loader
		}, {
			loader: 'css-loader',
			options: {
				sourceMap: true
			}
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

module.exports = {
	mode: 'production',
	devtool: 'source-map',
	entry: {
		'ccms-sms-editor': './src/index.js'
	},
	output: {
		path: path.join(__dirname, 'dist'),
		filename: '[name].js'
	},
	externals: {
		'angular': 'angular'
	},
	optimization: {
		minimizer: [
			new UglifyJsPlugin({
				cache: true,
				parallel: true,
				sourceMap: true
			}),
			// 处理extract出来的css
			new OptimizeCssAssetsPlugin({
				assetNameRegExp: /\.css$/g,
				cssProcessor: require('cssnano'),
				cssProcessorOptions: Object.assign({
					core: false,
					map: {
						inline: false
					}
				}, cssNanoCommonOpts),
				canPrint: true
			})
		]
	},
	plugins: [
		new CleanPlugin(['dist']),
		new MiniCssExtractPlugin({
			filename: '[name].css',
			chunkFilename: '[id].css'
		})
	],
	resolve: {
		extensions: ['.js']
	},
	module: {
		rules: loaders
	}
};

// if you want debug webpack, please run 'npm run debug:build' on console, then open the chrome, input chrome://inspect
