// source of inspiration: https://github.com/sindresorhus/require-fool-webpack
const requireFoolWebpack = eval(
  "typeof require !== 'undefined' " +
    '? require ' +
    ': function (module) { throw new Error(\'Module " + module + " not found.\') }'
)
export default requireFoolWebpack
