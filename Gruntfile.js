module.exports = function(grunt) {

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		uglify: {
			options: {
				banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
			},
			build: {
				src: 'dist/gallery.tmp.js',
				dest: 'dist/gallery.js'
			}
		},
    
		browserify: {
			main: {
				files: {
					'dist/gallery.tmp.js' : [ 'gallery.js' ]
				}
			}
		},
		
		clean: {
			build : [ 'dist/*.js', '!dist/gallery.js' ]
		}

	});

  grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-browserify');

	grunt.registerTask('default', ['browserify', 'uglify', 'clean']);

}