var path = require('path');

module.exports = [
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
		test: /\.js$/,
		exclude: /(node_modules|bower_components)/,
		use: ['babel-loader']
	},
	{
		test: /\.tpl\.html$/,
		use: ['html-loader']
	}
];
