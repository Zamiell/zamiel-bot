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
        // airbnb uses 2 spaces, but it is harder to read block intendation at a glance
        'indent': ['warn', 4],

        // It can be bad to remove unused arguments from a function copied an API example
        'no-unused-vars': [
            'warn', {
                'vars': 'local',
                'args': 'none',
            }
        ],

        // airbnb disallows "++" because it can lead to errors with minified code
        // We don't have to worry about this in for loops though
        'no-plusplus': ['error', {'allowForLoopAfterthoughts': true}],

        // Object destructuring can lead to more confusing code, especially for beginners to JavaScript
        'prefer-destructuring': ['off'],

        // Clean code can arise from for-of statements if used properly
        'no-restricted-syntax': ['off', 'ForOfStatement'],
    },
}
