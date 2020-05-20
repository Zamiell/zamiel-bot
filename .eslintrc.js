module.exports = {
  // The linter base is the airbnb style guide, located here:
  // https://github.com/airbnb/javascript
  'extends': 'airbnb-base',

  'env': {
    'node': true,
    'es6': true,
  },

  // We modify the base for some specific things
  'rules': {
    // Airbnb disallows these because it can lead to errors with minified code;
    // we don't have to worry about this in for loops though
    // https://github.com/airbnb/javascript/blob/master/packages/eslint-config-airbnb-base/rules/style.js#L330
    'no-plusplus': ['error', { 'allowForLoopAfterthoughts': true }],

    // Clean code can arise from for-of statements if used properly
    // https://github.com/airbnb/javascript/blob/master/packages/eslint-config-airbnb-base/rules/style.js#L334
    'no-restricted-syntax': ['off', 'ForOfStatement'],

    // This allows code to be structured in a more logical order
    // https://github.com/airbnb/javascript/blob/master/packages/eslint-config-airbnb-base/rules/variables.js#L42
    'no-use-before-define': ['off'],
  },
}
