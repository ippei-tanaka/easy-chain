var gulp = require('gulp'),
    karma  = require('gulp-karma'),
    notify = require('gulp-notify'),
    runSequence = require('run-sequence'),
    uglify = require('gulp-uglify'),
    clean = require('gulp-clean'),
    rename = require("gulp-rename"),
    packageJson = require('./package.json');

gulp.task('default', function (next) {
    runSequence(
        'test-with-jquery1',
        'test-with-jquery2',
        'clean',
        'build'
    );
    next();
});

gulp.task('test', function (next) {
    runSequence(
        'test-with-jquery1'
    );
    next();
});

gulp.task('build', function () {
    return gulp.src('src/*.js')
        .pipe(rename(function (path) {
            path.basename += "-" + packageJson.version;
        }))
        .pipe(gulp.dest('dist'))
        .pipe(rename(function (path) {
            path.basename += ".min";
        }))
        .pipe(uglify())
        .pipe(gulp.dest('dist'))
});

gulp.task('clean', function () {
    return gulp.src('dist')
        .pipe(clean({force: true}));
});

gulp.task('test-with-jquery1', function () {
    return gulp
        .src([
            './lib/jquery-1.11.2.js',
            './lib/underscore.js',
            './src/*.js',
            './test/*.js'
        ])
        .pipe(karma({
            configFile: 'karma.conf.js',
            action: 'run'
        }))
        .on('error', notify.onError({
            title: 'Jasmine Test Failed',
            message: 'One or more tests failed, see the cli for details.'
        }));
});

gulp.task('test-with-jquery2', function () {
    return gulp
        .src([
            './lib/jquery-2.1.3.js',
            './lib/underscore.js',
            './src/*.js',
            './test/*.js'
        ])
        .pipe(karma({
            configFile: 'karma.conf.js',
            action: 'run'
        }))
        .on('error', notify.onError({
            title: 'Jasmine Test Failed',
            message: 'One or more tests failed, see the cli for details.'
        }));
});