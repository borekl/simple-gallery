# simple-gallery

Minimalistic no-frills image gallery that puts images/videos into the centre of user's experience. It supports responsive images, navigation with keyboard and has some support for collections of galleries.

The gallery is a personal project primarily designed to power [this](https://voyager.lupomesky.cz/fotky/tracy/) gallery. Therefore, it is not very polished and might contain all kinds of stuff specific to my own use.

## Components used

* backend script that generates the index files is written in [perl 5](https://www.perl.org/), using few common modules
* for videos [avprobe](https://libav.org/documentation/avprobe.html) (component of [libav](https://libav.org/)) must be installed on the system running the backend, it is used to get video frame width/height
* [jQuery](https://jquery.com/)
* [perfect-layout](https://github.com/axyz/perfect-layout) for gallery page layout
* [screenfull.js](https://github.com/sindresorhus/screenfull.js/) for some help with fullscreen videos
* [Font Awesome](https://fortawesome.github.io/Font-Awesome/) for few icons
* [Google Fonts](https://www.google.com/fonts) for some better sans serif font than Arial

## How It Works

### Gallery Directory Structure

    my_gallery/
      1x/
      2x/
      video/
      info.json
      index.json
      thumb.1x.jpg
      thumb.2x.jpg

Pictures are stored in **1x**, **2x**, **3x**, **4x** directories. The number before the x is *display pixel ratio*. The **1x** folder is required, the other three are optional. If the higher DPRs are used, they should be of proper size related to the 1x size (ie. 2x should have twice the height/width than 1x etc.)

Videos are put into the **video** directory. Currently only files ending in **.mp4** are ever considered. If there is file that has the same basename as the video file but ends in **.jpg**, it is used as [poster](http://www.w3schools.com/tags/att_video_poster.asp) attribute in the VIDEO element.

**thumb._x.jpg** is only used for collection of galleries and it is the image used to represent the whole gallery. The _x part determines the DPR as expected (currently, only DPRs of 1 and 2 are supported).

### info.json

This file is required and contains some meta-info about the gallery. It looks like this:

    {
      "title" : "My Amazing Party Gallery",
      "date" : "January 16, 2016",
      "backlink" : true,
      "captions" : {
        "IMG_6017.jpg" : "Me doing crazy stuff",
        "IMG_6023.jpg" : "Me doing even more crazy stuff"
      }
    }

The **title** and **date** keys are required; **backlink** is only there for use by gallery collections; **captions** is optional.

Once you have the image/video files and the *info.json* in place, you run the back-end script, **gallery.pl** in the gallery directory. The script will scan the contents and generate **index.json** file, that is then used by the client-side JavaScript to render the gallery page.

### Apache Config

Following apache2 config sets up a directory, where you will store your galleries. It will make **gallery.html** an default index file if index.html does not exist. The *gallery.html* in turn references all the required JavaScript code that requests the *index.json* and renders the gallery accordingly.

    <Directory /home/httpd/galleries>
      DirectoryIndex index.html
      DirectoryIndex /gallery/gallery.html
    </Directory>

### Deep links to images

The gallery allows for linking to specific images and also updates the URL accordingly when you browse the gallery (so that you can bookmark or share individual images). For this to work, you must add following rewrite rule to your Apache config:

    RewriteRule "(.*)/i/[^/]+/$" "$1/" [PT,L]

The deep link URL has the form of `/<gallery-base>/i/<image-basename/`, where *gallery-base* is the directory where the `info.json` and `index.json` files are; *image-basename* is the image file name without its extension.

Please note, that opening the image through the "deep link" will still read the entire gallery in the background!
