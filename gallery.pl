#!/usr/bin/perl

#=============================================================================
# Script to generate gallery sets's definition JSON file. It is important
# to run this script in the gallery's base directory.
#=============================================================================


use strict;
use warnings;
use utf8;

use JSON;
use Image::Size;
use File::stat;
use File::chdir;


#=============================================================================
# Read arbitrary JSON file
#=============================================================================

sub read_json_file
{
  local $/;
  my $file = shift;
  my $fh;
  
  open($fh, '<', $file) or return undef;
  my $json_text = <$fh>;
  close($fh);
  
  return decode_json($json_text);
}



#=============================================================================
# Write arbitrary JSON file
#=============================================================================

sub write_json_file
{
  my $file = shift;
  my $data = shift;
  my $fh;
  my $json = JSON->new();
  $json->pretty(1)->utf8(1);
  
  open($fh, '>', $file) or die;
  print $fh $json->encode($data);
  close($fh);
}



#=============================================================================
# Get video's resolution. Requires avprobe (part of libav) to be installed on
# the system.
#=============================================================================

sub avprobe
{
  #--- arguments
  
  my $file = shift;
  
  #--- other variables
  
  local $/;
  my ($fh, $avinfo, $vi, $w, $h);
  
  #--- read and decode avprobe output
  
  open($fh, "avprobe -of json -show_streams $file 2>/dev/null |")
    or return undef;
  $avinfo = <$fh>;
  close($fh);
  $vi = decode_json($avinfo);
  
  #--- extract video resolution
  
  for my $stream (@{$vi->{'streams'}}) {
    if($stream->{'codec_type'} eq 'video') {
      $w = $stream->{'width'};
      $h = $stream->{'height'};
      return ($w, $h);
    }
  }
  
  #--- finish when failed to get video resolution
  
  return undef;
}



#=============================================================================
# Read contents of a directory and return it as an arrayref.
#=============================================================================

sub get_dirlist
{
  my $dir = shift;
  my $func = shift;
  my @re;

  opendir(my $dh, $dir) or return undef;
  while(my $file = readdir($dh)) {
    next if $file =~ /^\.{1,2}$/;
    my $pathname = sprintf('%s/%s', $dir, $file);
    next if $func && !&$func($pathname, $file);
    push(@re, $file);
  }
  closedir($dh);
  return \@re;
}


#=============================================================================
# extract path from filename; the resulting path is either empty or does
# contain the trailing slash.
#=============================================================================

sub get_pathname
{
  my $file = shift;
  my $path;
    
  my @path = split('/', $file);
  pop(@path);
  $path = join('/', @path);
  $path .= '/' if $path;
  $path = '/' . $path if scalar(@path) == 1 && !$path[0];
  
  return $path;
}


#=============================================================================
# Create in-memory index for particular directory from info file passed
# as argument.
#=============================================================================

sub gallery_index
{
  #--- arguments
  
  my $info_file = shift;

  #--- other variables 
  
  my $index_file;
  my $path = get_pathname($info_file);
  my %gallery;
  
  #--- read info file

  my $info = read_json_file($info_file);
  return undef if !ref($info);
  $gallery{'info'} = $info;
  $gallery{'items'} = [];
  
  #--- get list of pictures

  my $imgfiles = get_dirlist("${path}1x");
  if(!$imgfiles) { $imgfiles = []; }
  printf("%d pictures found\n", scalar(@$imgfiles))
    if scalar(@$imgfiles);

  #--- get list of videos

  my $vidfiles = get_dirlist(
    "${path}video",
    sub {
      return $_[1] =~ /\.mp4$/;
    }
  );
  if(!$vidfiles) { $vidfiles = []; }
  printf("%d videos found\n", scalar(@$vidfiles))
    if scalar(@$vidfiles);
  
  #--- abort if neither pictures nor videos were found
  
  if(scalar(@$imgfiles) == 0 && scalar(@$vidfiles) == 0) {
    printf("No pictures or videos found\n");
    return undef;
  }
  
  #--- process the actual images
  # the per-image has created here conforms to usage by
  # perfect-layout code (github.com/axyz/perfect-layout),
  # the 'data' key contains srcset attribute

  for my $cimg (sort @$imgfiles) {
    my ($img_w, $img_h) = imgsize("${path}1x/$cimg");
    my (%entry, @srcset);
    my $basename = $cimg;

    $basename =~ s/\..+$//;

    # 'srcset' images from 1x to 4x;
    # 'src' gets the lowest DPR image available    
    for(my $dpr = 1; $dpr <= 4; $dpr++) {
      if(-f "${path}${dpr}x/$cimg") {
        push(@srcset, "${path}${dpr}x/$cimg ${dpr}x");
        $entry{'src'} = "${path}${dpr}x/$cimg" if !exists($entry{'src'});
      }
    }

    $entry{'ratio'} = $img_w / $img_h;
    $entry{'data'}{'srcset'}  = \@srcset;
    $entry{'data'}{'caption'} = $info->{captions}{$cimg}
      if $info->{'captions'}{$cimg};
    $entry{'data'}{'type'} = 'image';
    $entry{'data'}{'basename'} = $basename;
      
    push(@{$gallery{'items'}}, \%entry);
  }
  
  #--- process the videos
  
  for my $cvid (sort @$vidfiles) {
    my ($vid_w, $vid_h) = avprobe("${path}video/$cvid");
    my (%entry);
    my $basename = $cvid;
	
    next if !$vid_w || !$vid_h;

    $basename =~ s/\..+$//;
    
    # try to find poster image
    my $poster = "${path}video/$cvid";
    $poster =~ s/\.\w+$/.jpg/;
    $entry{'src'} = "${path}video/$cvid";
    $entry{'ratio'} = $vid_w / $vid_h;
    $entry{'data'}{'type'} = 'video';
    $entry{'data'}{'poster'} = $poster if -f $poster;
    $entry{'data'}{'basename'} = $basename;
	
    push(@{$gallery{'items'}}, \%entry);
  }
  
  #--- remove captions section from info
  
  delete $info->{'captions'};
  
  #--- finish sucessfully
  
  return \%gallery;
}



#=============================================================================
#=== M A I N =================================================================
#=============================================================================

#--- single gallery mode -----------------------------------------------------

if(-f 'info.json') {
  print "Found info.json, single gallery mode\n";
  my $re = gallery_index('info.json');
  if(!ref($re)) {
    die "Failed to generate gallery index\n";
  }
  write_json_file('index.json', $re);
  exit(0);
}

#--- gallery set mode --------------------------------------------------------

if(!-f 'gset.json') {
  die "Nothing to do, neither info.json or gset.json exist\n";
}
print "Found gset.json, gallery set mode\n";

#--- global gallery set description we are compiling

my %gset = ( dirs => {} );

#--- indexes for individual galleries

my %indexes;

#--- get list of directories that contain the info file

print "Getting list of directories ... ";
my $dir = get_dirlist(
  '.',
  sub { 
    -d $_[0] &&
    $_[1] =~ /^\d{3}$/ &&
    -f sprintf('%s/%s', $_[0], 'info.json')
  }
);
if(!ref($dir) || scalar(@$dir) <= 0) {
  print "failed\n";
  exit(1);
}
printf("%d found\n", scalar(@$dir));

#--- save directory order index

$gset{'dirs_order'} = [ sort { $b <=> $a } @$dir ];

#--- iterate over the directories

for(my $i = 0; $i < scalar(@{$gset{'dirs_order'}}); $i++)
{
  #--- variables 
  
  my $cdir = $gset{'dirs_order'}[$i];
  my $cgal = $gset{'dirs'}{$cdir} = {};
  my $idx;

  #--- display
  
  print "Processing $cdir\n";
  
  #--- get info.json data

  { 
    local $CWD;
    push(@CWD, $cdir); 
    $idx = $indexes{$cdir} = gallery_index('info.json');
    die "Assertion failure" if !ref($indexes{$cdir});
  }

  #--- backward/forward references for individual galleries
  
  $indexes{$cdir}{'info'}{'prev'} = $gset{'dirs_order'}[$i-1]
    if $i > 0;
  $indexes{$cdir}{'info'}{'next'} = $gset{'dirs_order'}[$i+1]
    if $i < (scalar(@{$gset{'dirs_order'}}) -1);
  $indexes{$cdir}{'info'}{'backlink'} = \1;
    
  #--- copy some stuff into gset

  $cgal->{'info'}{'date'}   = $idx->{'info'}{'date'};
  $cgal->{'info'}{'images'} = scalar(
    grep { $_->{'data'}{'type'} eq 'image' } @{$idx->{'items'}}
  );
  $cgal->{'info'}{'videos'} = scalar(
    grep { $_->{'data'}{'type'} eq 'video' } @{$idx->{'items'}}
  );

  #--- detect default thumbnails
  # currently only 1x and 2x are supported

  my (@srcset, $src);
  if(-f "$cdir/thumb.1x.jpg") {
    $src = "$cdir/thumb.1x.jpg";
    push(@srcset, "$cdir/thumb.1x.jpg 1x");
  }
  if(-f "$cdir/thumb.2x.jpg") {
    $src = "$cdir/thumb.2x.jpg" if !$src;
    push(@srcset, "$cdir/thumb.2x.jpg 2x");
  }
  if($src) {
    $cgal->{'info'}{'thumb'}{'src'} = $src;
    $cgal->{'info'}{'thumb'}{'srcset'} = join(', ', @srcset);
  }

#--- end of iteration

}

#--- save individual galleries files

print "Writing index.json: ";
for my $cdir (@$dir) {
  write_json_file("$cdir/index.json", $indexes{$cdir});
  printf("%s, ", $cdir);
}
print "done\n";

#--- write composite JSON file

write_json_file('gset.json', \%gset);
