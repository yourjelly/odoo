#!/usr/bin/perl
use File::Basename;
use Dpkg::Control::Info;
use Dpkg::Deps;
my $c = dirname(__FILE__) . "/../debian/control";
print $c;
my $control = Dpkg::Control::Info->new($c);
my $fields = $control->get_pkg_by_name("odoo");
my $d = $fields->{'Depends'};
$d =~ s/,/ /g;
$d =~ s/\$.*\n//g;
$d =~ s/ .*\n/ /g;
$d =~ s/^\s+|\s+$//g;
$d = "sudo apt-get install " . $d;
print $d;
system($d)
