/**
 * @author Kuitos
 * @homepage https://github.com/kuitos/
 * @since 2015-08-06
 */
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

module.exports = {
	mode: 'production',
	devtool: 'cheap-source-map',
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
				cssProcessorPluginOptions: {
					preset: ['default', cssNanoCommonOpts]
				},
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
