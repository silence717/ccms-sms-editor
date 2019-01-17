// refer to https://github.com/TheLarkInn/webpack-workshop-2018/blob/feature/0700-custom-loaders/build-utils/my-loader.js
function mySecondLoader(source) {
	return source;
}

module.exports = mySecondLoader;

