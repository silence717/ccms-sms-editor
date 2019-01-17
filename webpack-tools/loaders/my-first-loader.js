// refer to https://github.com/TheLarkInn/webpack-workshop-2018/blob/feature/0700-custom-loaders/build-utils/my-loader.js
/**
 * How to Use it
 * */
/*
 resolveLoader: {
    alias: {
        "my-loader": require.resolve("./build-utils/my-loader.js")
    }
 },
*/
function myFirstLoader(source) {
	// do nothing
	return source;
}

module.exports = myFirstLoader;

