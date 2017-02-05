var gulp = require('gulp'),
    minifyHtml = require('gulp-minify-html'),
    template = require('gulp-template'),
    templateCache = require('gulp-angular-templatecache');

var minifyHtmlOpts = {
    empty: true,
    cdata: true,
    conditionals: true,
    spare: true,
    quotes: true
};

gulp.task('config-bootstrap3', function () {
    gulp.src('template/bootstrap3/*.html')
        .pipe(minifyHtml(minifyHtmlOpts))
        .pipe(templateCache('config-tpls-bootstrap3.js', {standalone: true, module: 'config.templates'}))
        .pipe(gulp.dest('src'));
});

gulp.task('default', ['config-bootstrap3']);