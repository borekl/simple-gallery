//============================================================================
// Gallery / Individual galleries renderer
//============================================================================


(function () {

//----------------------------------------------------------------------------

var
  base_url,
  start_with_image,
  show_captions = true,
  was_fullscreen = false,
  perfect_layout = require('perfect-layout'),
  screenfull = require('screenfull');
  

//----------------------------------------------------------------------------
// Remove last element from current URL. Used to either go one level up or
// switch to different gallery of the same level.
//----------------------------------------------------------------------------

function trim_current_url()
{
  var url_arr = base_url.split('/');
  url_arr.pop();
  url_arr.pop();
  return( url_arr.join('/') );
}


//----------------------------------------------------------------------------
// Event debouncing function.
//----------------------------------------------------------------------------

function throttle(fn, threshhold, scope)
{
  threshhold || (threshhold = 250);
  var last,
      deferTimer;
  return function () {
    var context = scope || this;

    var now = +new Date,
        args = arguments;
    if (last && now < last + threshhold) {
      // hold on to it
      clearTimeout(deferTimer);
      deferTimer = setTimeout(function () {
        last = now;
        fn.apply(context, args);
      }, threshhold);
    } else {
      last = now;
      fn.apply(context, args);
    }
  };
}


//----------------------------------------------------------------------------
// If "key" is missing from KeyboardEvent, add it (only for the keys we
// actually use).
//----------------------------------------------------------------------------

function keyboard_evt_fill(evt)
{
  // "key" is available, do nothing
  
  if("key" in evt && typeof evt.key != "undefined") { 
    return; 
  }
  
  // otherwise, use "keyCode"
  
  if(evt.keyCode == 27) {
    evt.key = "Escape";
  } else if(evt.keyCode == 37) {
    evt.key = "ArrowLeft";
  } else if(evt.keyCode == 39) {
    evt.key = "ArrowRight";
  } else if(evt.keyCode == 96) {
    evt.key = "0";
  } else if(evt.keyCode == 73) {
    evt.key = "i";
  }
  
  return;
}


//----------------------------------------------------------------------------
// Single image browsing
//----------------------------------------------------------------------------

function single_image(e)
{
  var
    img_browse = $('<img>'),
    img        = e.data;
  
  //--- hide vertical scrollbar
  
  $('body').css('overflow-y', 'hidden');
  
  //--- inhibit keypress handling in the gallery
  
  $(document).trigger('inhibit_keys', [true]);

  //--- function for navigating single-view mode
  
  single_nav = function(xpos, img) {
    // disable single_image mode (FIXME, this is sub-optimal)
    $('body').css('overflow-y', 'initial');
    $('div#browse').css('display', 'none').off().children().remove();
    $(window).off('resize', caption_place);
    $(document).off('keydown', keyevt).trigger('inhibit_keys', [false]);
    history.replaceState(null, null, base_url);
    // trigger click on another main gallery image
    if(xpos < 33) { 
      $('div.image img[data-n=' + (parseInt(img.data.n)-1) +']').trigger('click');
    } else if(xpos > 66) {
      $('div.image img[data-n=' + (parseInt(img.data.n)+1) +']').trigger('click');
    }
    // trigger resize on the gallery, this is required in some cases
    // as the viewport changes due to removing and then putting back the y-scrollbar
    $(window).trigger('resize');
  };
  
  //--- set up the image
  
  img_browse.attr({
    'src' :    base_url + img.src,
    'srcset' : img.data.srcset.map(
      function(x) { return base_url + x; }
    ).join(", "),
  })
  .addClass('overlay')
  
  //--- click handler for the image
  
  .on('click', img, function(evt, pdiv, clientX) {
    evt.stopPropagation();
    var 
      img = evt.data,
      el = pdiv ? pdiv : this,
      mouse_x = clientX ? clientX : evt.clientX,
      xpos = Math.floor(
        (mouse_x - $(el).offset().left)
        / $(el).width() * 100
      );
    single_nav(xpos, img);
  });
  
  //--- clicking on the background div should also work to move back/forward
  
  $('div#browse').on('click', function(evt) {
    evt.stopPropagation();
    $(this).find('img').trigger('click', [this, evt.clientX]);
  });
  
  //--- keyboard navigation
  
  var keyevt = function (evt) {
    keyboard_evt_fill(evt);
    if(evt.key == 'Escape') { single_nav(50, img); }
    else if(evt.key == 'ArrowLeft') { single_nav(1, img); }
    else if(evt.key == 'ArrowRight') { single_nav(99, img); }
    else if(evt.key.toLowerCase() == 'i') {
      show_captions = !show_captions;
      $('div#browse').trigger('caption');
    }
  };
  $(document).on('keydown', keyevt);
  
  //--- caption positioning
  
  var caption_place = function() {
    var 
      x = img_browse.prop('x'),
      y = img_browse.prop('y') + img_browse.height() - $(this).outerHeight();
    $(this).css('left', x+16).css('top', y-16);
    return false;
  };
  
  //--- caption
  
  var caption_switch = function () {
    if("caption" in img.data) {
      if(show_captions) {
        var jq_caption = 
          $('<span class="caption"></span>')
          .text(img.data.caption)
          .css('display', 'inline')
          .on('resize', caption_place);
        $(this).append(jq_caption).trigger('resize');
      } else {
        $('span.caption').remove();
      }
    }
  };
  $('div#browse').on('caption', caption_switch).trigger('caption');

  //--- resize handler for switching classes depending on
  //--- viewport aspect vs. image aspect
  
  img_browse.on('resize', function() {
    if(innerWidth / innerHeight < img.width / img.height) {
      img_browse.removeClass("portrait").addClass("landscape");
    } else {
      img_browse.removeClass("landscape").addClass("portrait");
    }
    return false;
  }).trigger('resize');

  //--- update URL

  history.replaceState(null, null, base_url + 'i/' + img.data.basename + '/');

  //--- add the image to DOM
  
  $('div#browse').css('display', 'block').append(img_browse);
  $('span.caption').trigger('resize');
  $(window).on('resize', function() { 
    $('span.caption').trigger('resize'); 
  });
}


//----------------------------------------------------------------------------
// This function lays out the images into the DOM.
//----------------------------------------------------------------------------

$.fn.perfectLayout = function(photos) {
	
  //--- initialize
	
  const node = this;
  const perfectRows = perfect_layout.default(
    photos, $(this).width() - 1, window.innerHeight, {margin: 2}
  );
  node.empty();

  //--- iterate over the images

  perfectRows.forEach(function (row) {
    row.forEach(function (img) {

  //--- create DOM objects

      var divNode = $('<div class="image"></div>');
      var contentNode, jq_caption, srcNode;

      if("type" in img.data && img.data.type == 'video') {

        srcNode = $('<source>').attr('src', img.src);
        contentNode = $('<video controls></video>')
        .css('display', 'block')
        .attr({
          'width' :  img.width + 'px',
          'height':  img.height + 'px',
          'data-n' : img.data.n
        })
        .append(srcNode);
        if("poster" in img.data) {
          contentNode.attr('poster', img.data.poster);
        }

      } else {

        contentNode = $('<img>')
        .css('display', 'block')
        .attr({
          'width':   img.width + 'px',
          'height':  img.height + 'px',
          'src' :    base_url + img.src,
          'srcset' : img.data.srcset.map(
            function(x) { return base_url + x; }
          ).join(", "),
          'data-n' : img.data.n
        })
        .on('click', img, single_image);
      }

  //--- click on image initiates single-image browsing

      // surrounding div
      divNode.append(contentNode);
      // caption, if any
      if("caption" in img.data) {
        jq_caption = $('<div class="caption"></div>').text(img.data.caption);
        divNode.append(jq_caption);
      }
      // insert into DOM
      node.append(divNode);
    });
  });
};


//----------------------------------------------------------------------------
//----------------------------------------------------------------------------

function go_to(e)
{
  e.stopPropagation();
  if(e.data.r == 'home') {
    window.location.assign(trim_current_url() + '/');
  } else if(e.data.r == 'dir') {
    window.location.assign(trim_current_url() + '/' + e.data.dir);
  }
  return false;
}


//----------------------------------------------------------------------------
// Display the gallery in perfectLayout format.
//----------------------------------------------------------------------------

function render_page(gallery)
{
  var 
    jq_gallery = $('#gallery'),
    jq_title = $('#title'),
    inhibit_keys = false,
    start_with_image_idx;

  //--- number the entries, if deeplinking for specific image
  //--- record its index
  
  for(var i = 0, max = gallery.items.length; i < max; i++) {
    gallery.items[i].data.n = i;
    if(start_with_image
       && 'basename' in gallery.items[i].data
       && gallery.items[i].data.basename == start_with_image
    ) {
      start_with_image = null;
      start_with_image_idx = i;
    }
  }
		
  //--- gallery title
  
  jq_title.append(
    '<span class="date">' +
    gallery.info.date + '</span> <span class="title">' +
    gallery.info.title + '</span>'
  );

  //--- window title
  
  window.document.title = gallery.info.title + ' / ' + gallery.info.date;

  //--- navigation elements
    
  if(gallery.info.backlink) {
    // home icon
    $('#nav-home')
      .css('display', 'inline-block')
      .on('click', {r:'home'}, go_to);
    // prev icon
    if(gallery.info.prev) {
      $('#nav-prev')
        .css('display', 'inline-block')
        .on('click', {r:'dir',dir:gallery.info.prev}, go_to);
    }
    // next icon
    if(gallery.info.next) {
      $('#nav-next')
        .css('display', 'inline-block')
        .on('click', {r:'dir',dir:gallery.info.next}, go_to);
    }
  }
  
  //--- display the gallery
  
  jq_gallery.perfectLayout(gallery.items);

  //--- keypress inhibition
  
  $(document).on('inhibit_keys', function(evt, state) {
    inhibit_keys = state;
  });
  
  //--- keypress handler
  
  $(document).off('keydown').on('keydown', function(evt) {
    if(inhibit_keys) { return true; }
    keyboard_evt_fill(evt);
    if(evt.key == 'ArrowRight') {
      $('#nav-prev').click();
      return false;
    } else if(evt.key == 'ArrowLeft') {
      $('#nav-next').click();
      return false;
    } else if(evt.key == 'Escape') {
      $('#nav-home').click();
      return false;
    } else if(evt.key == '0') {
      $('#gallery').find('img').eq(0).click();
      return false;
    }
  });
  
  //--- resize handler
  
  // special feature here is the blocking of handling resize event when
  // a VIDEO is fullscreened; when a VIDEO is unfullscreened; there are
  // for some strange reasons, two resize events, that's why there's a counter
  	
  var resize = throttle(function(evt) {
    if(screenfull.isFullscreen) { 
      was_fullscreen = 2;
      return; 
    } else {
      if(was_fullscreen) {
        was_fullscreen--;
        return;
      }
    }
    jq_gallery.perfectLayout(gallery.items);
    $('img.overlay').trigger('resize');
    }, 200);

  //--- bind to events
  
  $(window).on('resize', resize);
  $(window).trigger('resize');

  //--- switch to initial image if requested

  if(start_with_image_idx != null) {
    $('#gallery img[data-n=' + start_with_image_idx  + ']').click();
  }

}


//----------------------------------------------------------------------------
// M A I N
//----------------------------------------------------------------------------

$(document).ready(function ()
{
  var
    url, l;

  //--- parse the URL
  // the URL parsing is here to get arguments that allow passing some state
  // into this code; currently we're looking only for /i/BASENAME/ pattern
  // at the end of the URL, that is used to reference single image.

  url = document.location.pathname.split('/');
  l = url.length;
  if(url[l-3] == 'i') {
    start_with_image = url[l-2];
    url.splice(l-3, 2);
  }

  //--- get the index and render the page

  base_url = url.join('/');
  $.get(base_url + "index.json", render_page);
});


})();
