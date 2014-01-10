(function() {

// node-cgmon - cgminer monitor in node.js
//
// node-cgmon is a utility to monitor cgminer (https://github.com/ckolivas/cgminer) under linux and maximize its uptime
//
// by Chris Braddock <braddock.chris@gmail.com>
//
// The content of this project itself is licensed under the Creative Commons Attribution 3.0 license
// http://creativecommons.org/licenses/by/3.0/us/deed.en_US, and the underlying source code used to format and display
// that content is licensed under the MIT license http://opensource.org/licenses/mit-license.php.

// MODULES -------------------------------------------------------------------------------------------------------------

require('coffee-script'); // needed for cgminer module
var config = require('easy-config');
var log = require('npmlog');
var cgminerClient = require('cgminer');
var running = require('running');
var pidof = require('pidof');
var jsdom = require('jsdom'); // jQuery deferreds crap; TODO revisit
var spawn = require('child_process').spawn;
var gmail = require('gmail-sender');
var fs = require('fs');
var _ = require('lodash');

// VARIABLES -----------------------------------------------------------------------------------------------------------

var $, window = jsdom.jsdom().parentWindow; // jQuery deferreds crap; TODO revisit
var api = new cgminerClient(config.cgminer.host, config.cgminer.port);
var cgminerPID;
var monitorIntervalHdl;

// *********************************************************************************************************************
// SETUP & START MONITORING ********************************************************************************************
// *********************************************************************************************************************

// merge defaults & config (config takes priority)
config = _.defaults(config, {
    logLevel: 'debug',
    logEnabled: true,
    logPath: 'cgmon.log',
    emailEnabled: false,
    monitorIntervalSeconds: 5,
    startWaitSeconds: 5,
    'cgminer.cmd': './start_screen.sh',
    'cgminer.args': []
});

// add a debug log level
log.addLevel('debug', 1500, {fg: 'yellow'}, 'DEBUG');

// set log level
log.level = config.logLevel;

// setup filesystem logging
if (config.logEnabled) {
    log.on('log', function (data) {
        fs.appendFile(config.logPath, data.message, function(err) {
            if (err) { console.log('unable to write to logPath', config.logPath, err, data.message); }
        });
    });
}

// setup gmail
gmail.options({
    smtp: {
        service: "Gmail",
        user: config.email.user,
        pass: config.email.pass
    }
});

// jump through hoops for jquery deferreds :( TODO revisit
jsdom.jQueryify(window, "jquery.js", function () {
    $ = window.jQuery;
    log.info("jQuery available, starting monitor");
    // start the monitoring process
    startMonitor();
});

// *********************************************************************************************************************
// PRIVATE FUNCTIONS ***************************************************************************************************
// *********************************************************************************************************************

// start monitoring cgminer
function startMonitor() {
    log.info("starting monitor");
    getCgminerPid()
    .fail(function(status) {
        if (status === 'cgminer start') {
            log.info("could not get cgminer PID; attempted start/restart");
            // cgminer has been started/restarted; try monitoring it again
            startMonitor();
            return;
        }
        log.error("could not get cgminer PID; exiting", status);
    })
    .done(function(pid) {
        log.info("got cgminer PID; will start monitoring", pid);
        cgminerPID = pid;
        // set interval at which monitoring cycles happen
        monitorIntervalHdl = setInterval(monitor, config.monitorIntervalSeconds * 1000);
    });
}

// stop monitoring cgminer
function stopMonitor() {
    email('stopping monitor');
    log.info("stopping monitor");
    // cleanup monitor setInterval handle
    clearInterval(monitorIntervalHdl);
}

// re-start monitoring cgminer
function restartMonitor() {
    email('restarting monitor');
    log.info("restarting monitor");
    stopMonitor();
    startMonitor();
}

// attempt to get cgminer PID; if can't, attempt to start cgminer (unless !attemptStart)
function getCgminerPid(attemptStart) {
    var gotPid = $.Deferred();

    attemptStart = typeof attemptStart === 'boolean' ? attemptStart : true;

    pidof('cgminer', function (err, pid) {
        if (!err &&
            pid != null) {
            log.info("got cgminer PID; resolving", pid);
            gotPid.resolve(pid);
            return;
        }
        if (!attemptStart) {
            log.info("couldn't get cgminer PID and !attemptStart; rejecting");
            gotPid.reject(err);
            return;
        }

        // start/restart cgminer
        startCgminer().then(function () {
            gotPid.reject('cgminer start');
        });
    });

    return gotPid.promise();
}

// start cgminer startup program (config.cgminer.cmd)
function startCgminer() {
    var cgminerStarted = $.Deferred();
    var startWaitSeconds = config.cgminer.startWaitSeconds;
    spawn(
        config.cgminer.cmd,
        config.cgminer.args
    );
    log.info("sleeping seconds to allow cgminer process to start", startWaitSeconds);
    // lame hack
    setTimeout(function () {
        cgminerStarted.resolve();
    }, startWaitSeconds * 1000);
    return cgminerStarted.promise();
}

// the monitoring cycle loop; monitor() executed once per monitoring cycle
function monitor() {
    log.debug("monitor()", cgminerPID);

    // if cgminer isn't running; start/restart it
    if (!running(cgminerPID) ||
        cgminerPID == null) {
        log.info("cgminer not running, restarting monitoring");
        restartMonitor();
        return;
    }

    // for now, dump a summary - probably this will go away
    api.summary().then(function (results) {
        var status = results.STATUS[0];   // why is this an array?
        var summary = results.SUMMARY[0]; // why is this an array?
        log.info('>', '%s|S:%s|MHa:%s|MH5s:%s|A:%s|R:%s|HW:%s',
                 new Date(status.When).toString(), status.STATUS, summary['MHS av'], summary['MHS 5s'],
                 summary['Accepted'], summary['Rejected'], summary['Hardware Errors']);
    });

    // check for gpu issues; if found attempt gpu restart
    api.notify().then(function(results) {
        log.debug('notify', results);
        results.forEach(function (result) {
            if (result['Last Not Well'] !== 0) {
                log.error("gpu was not well! attempting restart...", result.ID,
                    result['Last Not Well'], result['Reason Not Well']);
                api.gpurestart(result.ID).then(function (results) {
                    log.info('gpurestart results', results);
                });
            }
        });
    });

    // restart miner if full API access becomes read-only
    api.privileged().then(function (results) {
        if (results.STATUS[0].test(/error/i)) {
            stopMonitor();
            api.restart().then(function (results) {
                startMonitor();
            });
        }
    });

    // TODO what else do we need to watch for here?
    // restart miner if total hashrate falls below xx Mh/s
    // restart miner if total shares stop increasing for X minutes
    // restart miner every X hours
    // reboot machine if...
}

// send smtp email
function email(content) {
    if (!config.emailEnabled) { return; }
    log.info("emailing", content);
    gmail.send({
        subject: config.email.subject,
        from: config.email.from,
        to: {
            email: config.email.to,
            name: "name",
            surname: "surname"
        },
        template: config.email.template,
        data: {
            content: content
        }
    });
}

})();
