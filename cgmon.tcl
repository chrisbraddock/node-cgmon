#!/usr/bin/tclsh
#########################################################
### cgmon requires php, tcl, and screen.
###
###  Install instructions  ### 
# 
# 1) Install PHP, TCL and screen.  
# CentOS: yum install php53 tcl screen
# Ubuntu: apt-get install php5 tcl screen
#
# 2) Create a cronjob that runs this script every 5 or so minutes.  Must run as root for DEAD/SICK GPU rebooting.
#    Example: */5 * * * *	root	/home/user/cgmon.tcl >/dev/null 2>&1
#
# 3) chmod 755 cgmon.tcl
# 4) Fill out the configuration sections below
#
# *) Sit back and enjoy a steadier flow of income :)

set LTC_DONATION_ADDRESS "LPKwhKzFHypAw9yVqpFBEwTkxYTjTeTLan"
set BTC_DONATION_ADDRESS "13D196kLTMPQMattuz2AtpzasX8pVW6G4U"


# fill out these sections

# Primary mining pool 
set pool1 "us.wemineltc.com:3333"
set pool1_user "apexio.cgmon"
set pool1_pass "pass"

# Secondary mining pool (optional)
set pool2 ""
set pool2_user ""
set pool2_pass ""

# Username running X server (i.e. the username you use to run cgminer)
set mining_user "user"

# Mine for Litecoin or Bitcoin?
set mine_for "litecoin"
#set mine_for  "bitcoin"

# GPU settings
# Edit to your liking.
set cgminer_gpu_options "-g 1 -w 256 -I 19 --lookup-gap 2 --no-submit-stale --auto-fan"

# Email Notification (optional)
set email_notifications "on"
set smtp_server "smtp.server.com"
set smtp_port "25"
set to_add "user@domain.com"
set from_add "user@domain.com"


# Advanced options
set cgminer_cmd "cgminer --api-listen"
set screen_cmd "screen -md"
set cgmon_logfile "cgmon.log"




proc check_status {} {
global screen_cmd mining_script mining_user mining_command screen_cmd smtp_server to_add from_add hostname
global cgminer_api version checkshares

	set i 0
	catch {exec ps -A | grep cgminer$} cg_status
	
	if {$cg_status == "child process exited abnormally"} {
		# cgminer is not running, restart it.
		notice "cgminer not running, starting..."	
		sendmail $smtp_server $to_add $from_add "[stamp] $hostname - Started cgminer" "$hostname cgminer was not running... starting cgminer.\n"

#		if {$mining_script != ""} {
#			catch {exec cat $mining_script} mining_command
#		}
		if {![catch { set outfd [open "/tmp/cgmon-mine.sh" w] }]} {
			puts $outfd "#!/bin/bash"
			puts $outfd "export DISPLAY=:0"
			puts $outfd "export GPU_MAX_ALLOC_PERCENT=100"
			puts $outfd "export GPU_USE_SYNC_OBJECTS=1"
			puts $outfd "$screen_cmd $mining_command"
			close $outfd
		}
		exec chmod 755 /tmp/cgmon-mine.sh
		set exec_cmd "/tmp/cgmon-mine.sh"

		catch {exec whoami} script_user
		if {$script_user == $mining_user} {
			catch {exec /bin/bash -c $exec_cmd} out
		} elseif {$script_user == "root"} {
			catch {exec su $mining_user -c /bin/bash -c $exec_cmd} out
		} else {
			notice "attempted to start cgminer as the wrong user."
		}		
		if {$out == ""} {
			notice "cgminer started successfully.  Use 'screen -r' to attach to cgminer and Control-a-d to detach."
		}
		exit
			
#				puts "$out $::errorInfo"

	} else {
		# cgminer IS running.  Check if GPUs are healthy.
		catch {exec which php} phpexists
		if {$phpexists == "child process exited abnormally"} {
			notice "Couldn't find PHP.  Please install it.\n Ubuntu Example: apt-get install php5\n CentOS Example: yum install php5"
			exit
		}
		catch {exec ls $cgminer_api} apiexists
		if {[string first "No such" $apiexists] > 0} {
			notice "cgminer API ($cgminer_api) not found.  Do you have write permission to /tmp/?"
			exit
		}
		catch {exec php -f $cgminer_api notify | grep "=>" | grep "Last Not Well"} argx
		if {[string first "Connection refused" $argx] >1} {
			notice "cgminer API is not enabled.  Restart cgminer with '--api-listen'"
			exit
		}
		set data [split $argx "\n"]
		foreach line $data {
			set gpu_status [lindex $line 4]
			if {$gpu_status >1}  { 
				notice "GPU $i is sick or dead, rebooting...\n Status: $line"
				sendmail $smtp_server $to_add $from_add "[stamp] $hostname - GPU $i DEAD - Rebooting server" "$hostname GPU $i was dead or sick... rebooting server.\n Status: $line"			
				after 20000
				catch {exec echo "GPU $i DEAD - Rebooting server..." | wall} out
				exec /sbin/shutdown -r now
				exit
			}
			incr i
		}
		
		# check for cgminers that are running but are not ouputting good shares...
		if {$checkshares} {
			catch {exec php -f $cgminer_api devs | grep "Accepted\] =>" | grep -v Diff} argx
			set data [split $argx "\n"]
			set x 0
			foreach gpu $data {
				set current_accepted($x) [lindex $gpu 2]
				incr x
			}
			if {![file exists "[pwd]/accepted_count"]} {
				catch {exec touch "[pwd]/accepted_count"} out
			}
			set fd [open "[pwd]/accepted_count" r]
			set n 0
			for {set n 0} {$n<=[expr $x-1]} {incr n} {
			set line "[gets $fd]"
				set previous_accepted($n) [lindex $line 0]
				set previous_time [lindex $line 1]
puts $previous_time
set elapsed_seconds 0
	#			set elapsed_seconds [expr [clock seconds] - $previous_time]
				# at least 3 minutes must elapse
				if {$elapsed_seconds > 180} {
					set acc_rate_sec [expr [expr  $current_accepted($n) -  $previous_accepted($n)] / 1]
	#				puts "GPU $n Rate: $acc_rate_sec share(s) per minute"
					if {$current_accepted($n) > $previous_accepted($n)} {
	#					puts "GPU $n Shares Accepted since last run:  [expr  $current_accepted($n) -  $previous_accepted($n)]"
					} else {
					notice "GPU $n is did not have any Accepted Shared in $elapsed_seconds seconds. GPU probably hung."
					sendmail $smtp_server $to_add $from_add "[stamp] $hostname - no shares" "$hostname - GPU $n is did not have any Accepted Shared in $elapsed_seconds seconds. GPU probably hung."
					}
				}
			}
			close $fd
			set fd [open "[pwd]/accepted_count" w]
				for {set x 0} {$x<$n} {incr x} {
				puts $fd "$current_accepted($x) [clock seconds]"
				#puts $current_accepted($x)
			}
			close $fd
		}
		notice "cgminer running and all GPUs healthy.  cgmon $version"
	}
}



proc sendmail {smtphost toList from subject body {trace 0}} {
global smtp_server smtp_port email_notifications to_add from_add
global LTC_DONATION_ADDRESS BTC_DONATION_ADDRESS donated
global hostname

if {$email_notifications == "on"} {
        if $trace then {
                puts stdout "Connecting to $smtphost:$smtp_port"
        }
        set sockid [socket $smtphost $smtp_port]
		puts $sockid "HELO $hostname"
		puts $sockid "MAIL From:<$from>"
        flush $sockid
        set result ""
        while {1} {
            set tmp [gets $sockid]
            append result $tmp "\n"
            set extended_code [string range $tmp 0 3]
            if {[string compare [string range $extended_code end end] "-"]} {
                break
            }
        }
        if $trace then {
                puts stdout "MAIL From:<$from>\n\t$result"
        }
        foreach to $toList {
            puts $sockid "RCPT To:<$to>"
            flush $sockid
        }
        set result [gets $sockid]
        if $trace then {
                puts stdout "RCPT To:<$to>\n\t$result"
        }
        puts  $sockid "DATA "
        flush $sockid
        set result [gets  $sockid]
        if $trace then {
                puts stdout "DATA \n\t$result"
        }
        puts  $sockid "From: <$from>"
        puts  $sockid "To: <$to>"
        puts  $sockid "Subject: $subject"
        puts  $sockid "\n"
        if {$donated == "no"} {
        append body "\n\n If you find this software useful, please consider donating.\n\nBTC: $BTC_DONATION_ADDRESS\n\nLTC: $LTC_DONATION_ADDRESS\n\nThanks!"
        }
        foreach line [split $body  "\n"] {
                puts  $sockid "[join $line]"
        }
        puts  $sockid "."
        puts  $sockid "QUIT"
        flush $sockid
        set result [gets  $sockid]
        if $trace then {
                puts stdout "QUIT\n\t$result"
        }
        close $sockid
	}
	return;
}

proc notice {msg} {
	global hostname cgmon_logfile
	set notice "[stamp] $hostname $msg"
	puts $notice
	exec echo $notice >> $cgmon_logfile
}

proc stamp {} {return [clock format [clock seconds] -format {%b %d %H:%M:%S}]}


if {$mine_for == "litecoin"} {set cgminer_option1 "--scrypt" } else { set cgminer_option1 ""}

# do not edit this unless you know what youre doing
if {$pool2 != ""} {
	set mining_command "$cgminer_cmd $cgminer_option1 -o $pool1 -u $pool1_user -p $pool1_pass -o $pool2 -u $pool2_user -p $pool2_pass $cgminer_gpu_options"
} else {
	set mining_command "$cgminer_cmd $cgminer_option1 -o $pool1 -u $pool1_user -p $pool1_pass $cgminer_gpu_options"
}

set cgminer_api "/tmp/cgmon-api.php"

## This doesnt work.  Optional path to a bash script which starts cgminer for you. 
##set mining_script "/home/apex/mine.sh"
###############################



#create the cgminer api file if it doesnt exist
if {![file exists $cgminer_api]} {
set n [subst -nocommands -novariables { <?php\n#\n# Sample Socket I/O to CGMiner API\n#\nfunction getsock($addr, $port)\n\{\n $socket = null;\n $socket = socket_create(AF_INET, SOCK_STREAM, SOL_TCP);\n if ($socket === false || $socket === null)\n \{\n	$error = socket_strerror(socket_last_error());\n	$msg = "socket create(TCP) failed";\n	echo "ERR: $msg '$error'\\n";\n	return null;\n \}\n\n $res = socket_connect($socket, $addr, $port);\n if ($res === false)\n \{\n	$error = socket_strerror(socket_last_error());\n	$msg = "socket connect($addr,$port) failed";\n	echo "ERR: $msg '$error'\\n";\n	socket_close($socket);\n	return null;\n \}\n return $socket;\n\}\n#\n# Slow ...\nfunction readsockline($socket)\n\{\n $line = '';\n while (true)\n \{\n	$byte = socket_read($socket, 1);\n	if ($byte === false || $byte === '')\n		break;\n	if ($byte === "\0")\n		break;\n	$line .= $byte;\n \}\n return $line;\n\}\n#\nfunction request($cmd)\n\{\n $socket = getsock('127.0.0.1', 4028);\n if ($socket != null)\n \{\n	socket_write($socket, $cmd, strlen($cmd));\n	$line = readsockline($socket);\n	socket_close($socket);\n\n	if (strlen($line) == 0)\n	\{\n		echo "WARN: '$cmd' returned nothing\\n";\n		return $line;\n	\}\n\n	print "$cmd returned '$line'\\n";\n\n	if (substr($line,0,1) == '\{')\n	return json_decode($line, true);\n\n	$data = array();\n\n	$objs = explode('|', $line);\n	foreach ($objs as $obj)\n	\{\n		if (strlen($obj) > 0)\n		\{\n			$items = explode(',', $obj);\n			$item = $items[0];\n			$id = explode('=', $items[0], 2);\n			if (count($id) == 1 or !ctype_digit($id[1]))\n			$name = $id[0];\n			else\n				$name = $id[0].$id[1];\n\n	if (strlen($name) == 0)\n				$name = 'null';\n\n			if (isset($data[$name]))\n			\{\n				$num = 1;\n			while (isset($data[$name.$num]))\n					$num++;\n			$name .= $num;\n			\}\n\n			$counter = 0;\n			foreach ($items as $item)\n			\{\n				$id = explode('=', $item, 2);\n		if (count($id) == 2)\n					$data[$name][$id[0]] = $id[1];\n		else\n					$data[$name][$counter] = $id[0];\n\n				$counter++;\n			\}\n		\}\n	\}\n\n	return $data;\n \}\n\n return null;\n\}\n#\nif (isset($argv) and count($argv) > 1)\n $r = request($argv[1]);\nelse\n $r = request('summary');\n#\necho print_r($r, true)."\\n";\n#\n?>\n } ]
set fd [open $cgminer_api w]
puts $fd $n
close $fd
}



catch {exec hostname} hostname
set version "0.1b4"
# change this to yes if you donated
set donated "no"

set checkshares "no"

# start
check_status

# Changelog
# 0.1b3 added cgminer api
#	Timestamps
#	HELO mail fix
#	Simplified configuration
#	Added broadcast message before rebooting server.
# 0.1b4
#   Moved cgmon-mine.sh to /tmp/ so the script can run as the cgminer user.
#	Moved cgminer api to /tmp/
#	Secondary mining pool is now optional.


#TODO: 
#	check for Accepted shares
#	notify on GPU overheat