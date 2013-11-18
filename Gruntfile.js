module.exports = function (grunt) {
  grunt.initConfig({
    concat: {
      "firecalcjs": {
        options: {
          banner: [
            '/*',
            ' * firecalc',
            ' *',
            ' * Copyright 2013 Clement Wehrung',
            ' * with code from ot.js (Copyright 2012-2013 Tim Baumann) and Michael Lehenbauer (Firepad)',
            ' */\n',
            'var Firecalc = (function() {\n'
          ].join('\n'),
          footer: "\nreturn firecalc.Firecalc; })();"
        },
        "src": [
          "lib/utils.js",
          "lib/cursor.js",
          "lib/operation.js",
          "lib/firebase-adapter.js",
          "lib/client.js",
          "lib/editor-client.js",
          "lib/socialcalc-adapter.js",
          "lib/firecalc.js"
        ],
        "dest": "build/firecalc.js"
      }
    },
    uglify: {
      "firecalc-min-js": {
        src: "build/firecalc.js",
        dest: "build/firecalc-min.js"
      }
    },
    copy: {
      toBuild: {
        files: [
          {
            src: 'font/firecalc.eot',
            dest: 'build/firecalc.eot'
          }
        ]
      },
      toExamples: {
        files: [
          {
            src: 'build/firecalc.js',
            dest: 'examples/firecalc.js'
          },
          {
            src: 'build/firecalc.eot',
            dest: 'examples/firecalc.eot'
          },
        ]
      }
    },
    compress: {
      zip: {
        options: {
          archive: 'build/firecalc.zip',
        },
        files: [
          {
            cwd: 'build/',
            expand: true,
            src: ['firecalc.js', 'firecalc-min.js', 'firecalc.eot' ],
            dest: './'
          }
        ]
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-compress');

  grunt.registerTask('default', ['concat', 'uglify', 'copy', 'compress']);
};

