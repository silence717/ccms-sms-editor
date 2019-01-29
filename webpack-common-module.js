var path = require('path');

module.exports = {
	resolveLoader: {
		alias: {
			'my-first-loader': require.resolve('./webpack-tools/loaders/my-first-loader.js'),
			'my-second-loader': require.resolve('./webpack-tools/loaders/my-second-loader.js')
		}
	},
	module: {
		rules: [
			{
				enforce: 'pre',
				test: /\.js$/,
				exclude: /node_modules/,
				loader: 'eslint-loader',
				options: {
					formatter: require('eslint-friendly-formatter')
				},
				include: path.join(__dirname, 'src')
			},
			{
				test: /\.(js|ts)$/,
				exclude: /(node_modules|bower_components)/,
				use: ['babel-loader', 'my-first-loader']
			},
			{
				test: /\.tpl\.html$/,
				use: ['html-loader']
			}
		]
	}
};
