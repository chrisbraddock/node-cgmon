(function() {

// node-cgmon - cgminer monitor in node.js
//
// node-cgmon is a utility to monitor and maximize uptime of cgminer (https://github.com/ckolivas/cgminer) under linux
//
// by Chris Braddock <braddock.chris@gmail.com>
//
// The content of this project itself is licensed under the Creative Commons Attribution 3.0 license
// http://creativecommons.org/licenses/by/3.0/us/deed.en_US, and the underlying source code used to format and display
// that content is licensed under the MIT license http://opensource.org/licenses/mit-license.php.
//
// cgminer 3.7 API docs https://github.com/ckolivas/cgminer/blob/3.7/API-README

// TODO http post notification / data option

// CONSTANTS -----------------------------------------------------------------------------------------------------------
var PRE = "node-cgmon";

// MODULES -------------------------------------------------------------------------------------------------------------

require("coffee-script"); // needed for cgminer module
var config = require("easy-config");
var log = require("npmlog");
var CgminerClient = require("cgminer");
var running = require("running");
var pidof = require("pidof");
var jsdom = require("jsdom"); // jQuery deferreds crap; TODO revisit
var spawn = require("child_process").spawn;
var gmail = require("gmail-sender");
var fs = require("fs");
var _ = require("lodash");
var reboot = require("reboot");
var fs = require("fs");
var logRotateStream = require("logrotate-stream");
var ping = require("jjg-ping");

// VARIABLES -----------------------------------------------------------------------------------------------------------

var $, window = jsdom.jsdom().parentWindow; // jQuery deferreds crap; TODO revisit
var cgminerClient;
var cgminerPID;
var monitorIntervalHdl;
var startMonitorTimeoutHdl;
var lastApiResponse;
var screenMinerCmd = "./start_miner.sh";
var getCgminerPidAttempts = 0;
var lastEmailDate = 0;
var emailContent = '';
var lastPool;
var logReadStream;

// *********************************************************************************************************************
// SETUP & START MONITORING ********************************************************************************************
// *********************************************************************************************************************

// merge defaults & config (config takes priority)
config = _.defaults(config, {
    "minerName": "my miner",
    "processName": "cgminer",
    "startWaitSeconds": 5,
    "cmd": "./start_screen.sh",
    "args": [],
    "apiHost": "127.0.0.1",
    "apiPort": "4029",
    "minMHSAv": 1,
    "minMHS5s": 1,
    "numGPUs": 1,
    "maxTemp": 85,
    "maxFanSpeed": 4500,
    "maxHErrPct": 0,
    "maxRejPct": 0,
    "maxGetCgminerPidAttempts": 5,
    "monitorStartTimeoutSeconds": 10,
    "monitorIntervalSeconds": 1,
    "logLevel": "info",
    "logEnabled": true,
    "logPath": "cgmon.log",
    "logMaxSize": "1m",
    "logCompress": true,
    "logKeep": 3,
    "emailEnabled": false,
    "maxEmailIntervalMinutes": 60,
    "email": {
        "user": "youremail@gmail.com",
        "pass": "your gmail password",
        "from": "from email address",
        "to": "to email address",
        "subject": "cgmon",
        "template": "email-template.html"
    },
    "pingDomain": "google.com",
    "apiResponseThresholdSeconds": 10
});

// add a debug log level
log.addLevel("debug", 1500, {fg: "yellow"}, "debug");

// set log level
log.level = config.logLevel;

// debug config (must be done after logging setup)
log.debug(PRE, "config", config);

// setup filesystem logging
if (config.logEnabled) {
    // create log file if it doesn't exist
    if (!fs.existsSync(config.logPath)) {
        fs.openSync(config.logPath, "w", function (err, fd) {
            if (err) { console.log("unable to create log file at logPath", config.logPath, err); }
        });
    }
    // setup log rotation
    logReadStream = fs.createReadStream(config.logPath);
    logReadStream.pipe(logRotateStream({
        file: config.logPath,
        size: config.logMaxSize,
        keep: config.logKeep,
        compress: config.logCompress
    }));
    // grab log data on the log event and write it out to the file system
    log.on("log", function (data) {
        fs.appendFile(config.logPath, data.message + "\n", function(err) {
            if (err) { console.log("unable to write to logPath", config.logPath, err, data.message); }
        });
    });
}

// check for start_miner.sh
if (!fs.existsSync(screenMinerCmd)) {
    log.error(PRE, screenMinerCmd + " is missing; cannot continue");
    return;
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
    log.info(PRE, "jQuery available, starting monitor");
    // start the monitoring process
    cgminerClient = new CgminerClient(config.apiHost, config.apiPort);
    startMonitoring();
});

// *********************************************************************************************************************
// PRIVATE FUNCTIONS ***************************************************************************************************
// *********************************************************************************************************************

// start monitoring cgminer
function startMonitoring() {
    log.info(PRE, "starting monitor");
    startMonitorTimeoutHdl = setTimeout(function () {
        rebootMachine("monitoring didn't start before monitorStartTimeoutSeconds");
    }, config.monitorStartTimeoutSeconds * 1000);
    getCgminerPid()
    .fail(function(status) {
        if (status === "cgminer start") {
            clearTimeout(startMonitorTimeoutHdl);
            log.info(PRE, "could not get cgminer PID; attempted start/restart");
            // cgminer has been started/restarted; try monitoring it again
            startMonitoring();
            return;
        }
        log.error(PRE, "could not get cgminer PID; exiting", status);
    })
    .done(function(pid) {
        clearTimeout(startMonitorTimeoutHdl);
        log.info(PRE, "got cgminer PID; will start monitoring", pid);
        cgminerPID = pid;
        email("starting monitor", true);
        // set interval at which monitoring cycles happen
        monitorIntervalHdl = setInterval(monitor, config.monitorIntervalSeconds * 1000);
    });
}

// stop monitoring cgminer
function stopMonitoring() {
    email("stopping monitor", true);
    log.info(PRE, "stopping monitor");
    // cleanup monitor setInterval handle
    clearInterval(monitorIntervalHdl);
    // if we didn"t nullify this, a false reboot could be triggered on subsequent startMonitoring calls
    lastApiResponse = null;
}

// re-start monitoring cgminer
function restartMonitoring() {
    email("restarting monitor", true);
    log.info(PRE, "restarting monitor");
    stopMonitoring();
    startMonitoring();
}

// attempt to get cgminer PID; if can't, attempt to start cgminer (unless !attemptStart)
function getCgminerPid(attemptStart) {
    var gotPid = $.Deferred();

    attemptStart = typeof attemptStart === "boolean" ? attemptStart : true;

    // if we repeatedly can't get PID, reboot
    getCgminerPidAttempts++;
    if (getCgminerPidAttempts > config.maxGetCgminerPidAttempts) {
        rebootMachine("too many attempts to get PID");
        return gotPid.reject("too many attempts to get PID");
    }

    pidof(config.processName, function (err, pid) {
        if (!err &&
            pid != null) {
            log.debug(PRE, "got cgminer PID; resolving", pid);
            getCgminerPidAttempts = 0;
            gotPid.resolve(pid);
            return;
        }
        if (!attemptStart) {
            log.debug(PRE, "couldn't get cgminer PID and !attemptStart; rejecting");
            gotPid.reject(err);
            return;
        }

        // start/restart cgminer
        startCgminer().then(function () {
            gotPid.reject("cgminer start");
        });
    });

    return gotPid.promise();
}

// start cgminer startup program (config.cmd)
function startCgminer() {
    var cgminerStarted = $.Deferred();
    var startWaitSeconds = config.startWaitSeconds;
    log.info(PRE, "spawning cgminer", config.cmd, config.args);
    spawn(
        config.cmd,
        config.args
    );
    // lame hack
    log.info(PRE, "sleeping seconds to allow cgminer process to start", startWaitSeconds);
    setTimeout(function () {
        cgminerStarted.resolve();
    }, startWaitSeconds * 1000);
    return cgminerStarted.promise();
}

function rebootMachine(message) {
    stopMonitoring();
    log.warn(PRE, "rebooting", message);
    email("rebooting " + config.minerName + " " + message, true);
    // give time for email to send
    setTimeout(function () {
        reboot.reboot();
    }, 2000);
}

// the monitoring cycle loop; monitor() executed once per monitoring cycle
function monitor() {
    log.debug(PRE, "monitor", cgminerPID, cgminerClient);

    // detect and handle unresponsive api
    if (lastApiResponse != null &&
        Date.now() - lastApiResponse > (config.apiResponseThresholdSeconds * 1000)) {
        log.warn(PRE, "api unresponsive");
        rebootMachine("api unresponsive");
    }

    // if cgminer isn't running; start/restart it; this doesn't catch if process
    // is defunct but the unresponsive api test should cover that scenario
    if (!running(cgminerPID) ||
        cgminerPID == null) {
        log.info(PRE, "cgminer not running, restarting monitoring");
        restartMonitoring();
        return;
    }

    // log out a summary line
    api("summary").then(function (results) {
        var status = results.STATUS[0];   // why is this an array?
        var summary = results.SUMMARY[0]; // why is this an array?
        log.info("node-cgmon", "%s|S:%s|MHa:%s|MH5s:%s|A:%s|R:%s|HW:%s",
                 new Date(status.When).toString(), status.STATUS, summary["MHS av"], summary["MHS 5s"],
                 summary["Accepted"], summary["Rejected"], summary["Hardware Errors"]);
        if (summary["MHS av"] < config.minMHSAv ||
            summary["MHS 5s"] < config.minMHS5s) {
            email("hashing below threshold av: " + summary["MHS av"] + " 5s: " + summary["MHS 5s"]);
        }
    });

    // check pool info
    api("pools").then(function (results) {
        var currentPool;
        results.forEach(function (pool) {
            if (pool["Stratum Active"]) {
                currentPool = pool.URL;
                if (currentPool !== lastPool) {
                    lastPool = currentPool;
                    email("switching pool to " + pool);
                }
            }
        });
    });

    // check coin info
    api("coin").then(function (results) {
        //log.info(PRE, "coin results", results);
    });

    // check for gpu issues; if found attempt gpu restart
    api("notify").then(function(results) {
        log.debug(PRE, "notify", results);
        results.forEach(function (result) {
            if (result["Last Not Well"] !== 0) {
                log.error(PRE, "gpu was not well! attempting restart...", result.ID,
                    result["Last Not Well"], result["Reason Not Well"]);
                api("gpurestart", result.ID).then(function (results) {
                    log.info(PRE, "gpurestart results", results);
                });
            }
        });
    });

    // restart miner if full API access becomes read-only
    api("privileged").then(function (results) {
        if (results.STATUS[0].test(/error/i)) {
            email("api went read-only, stopping monitoring");
            stopMonitoring();
            api("restart").then(function (results) {
                startMonitoring();
            });
        }
    });

    // check GPUs
    api("devs").then(function (devs) {
        var dev,
            devCount = 0,
            ok = true;

        function checkMax(dev, attr, max) {
            if (dev[attr] > max) {
                rebootMachine(dev.GPU + " " + attr + " exceeds max " + max);
                return false;
            }
            return true;
        }

        while(ok && gpuCount < devs.length) {
            dev = devs[devCount];

            // check for values outside maximums
            ok = checkMax(dev, "Temperature", config.maxTemp);
            ok = checkMax(dev, "Fan Speed", config.maxFanSpeed);
            ok = checkMax(dev, "Device Hardware%", config.maxHErrPct);
            ok = checkMax(dev, "Device Rejected%", config.maxRejPct);

            // check for sick/dead GPU
            if (/sick|dead/i.test(dev["Status"])) {
                rebootMachine(dev.GPU + " status is " + dev["Status"]);
            }

            devCount++;
        }

    });

    // warn on wrong gpu count (will this ever happen? not sure so turn on email notices for now and see if it does)
    api("gpucount").then(function (numGPUs) {
        if (numGPUs !== config.numGPUs) {
            email("wrong gpu count", config.numGPUs, numGPUs);
        }
    });

    // test Internet connectivity
    ping.system.ping(config.pingDomain, function(latency, status) {
        if (status) {
            log.debug(PRE, config.pingDomain + " ping latency: " + latency);
        } else {
            log.warn(PRE, config.pingDomain + " is unreachable; latency: " + latency);
            //rebootMachine(config.pingDomain + " is unreachable; latency: " + latency);
        }
    });

}

// wrapper to cgminerClient api
function api(method) {
    var methodComplete = $.Deferred();
    log.debug(PRE, "api", method, _.rest(Array.prototype.slice(arguments)));
    // TODO fix this janky crap ... couldn't get .apply to work
    cgminerClient[method](arguments[1], arguments[2], arguments[3], arguments[4], arguments[5], arguments[6]).then(function() {
        log.debug(PRE, "return", method, arguments);
        lastApiResponse = Date.now();
        // TODO fix this janky crap ... couldn't get .apply to work
        methodComplete.resolve(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4], arguments[5]);
    });
    return methodComplete.promise();
}

// send smtp email
function email(content, ignoreMaxEmailIntervalMinutes) {
    if (!config.emailEnabled) { return; }

    emailContent += (content + String.fromCharCode(13));

    if (!ignoreMaxEmailIntervalMinutes &&
        (Date.now() - lastEmailDate) < (config.maxEmailIntervalMinutes * 60 * 1000)) {
        log.debug(PRE, "too early to email; pushing message to digest " + content);
        return;
    }

    log.info(PRE, "emailing", config.email.to);
    log.debug(PRE, "content", emailContent);

    gmail.send({
        subject: config.minerName + ": " + config.email.subject,
        from: config.email.from,
        to: {
            email: config.email.to,
            name: "name",
            surname: "surname"
        },
        template: config.email.template,
        data: {
            content: emailContent
        }
    });

    emailContent = '';
    lastEmailDate = Date.now();
}

})();
