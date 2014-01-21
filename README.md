# node-cgmon

**node-cgmon is a utility intended to monitor [cgminer](https://github.com/ckolivas/cgminer) under linux and maximize its uptime**

*(developed and tested against 3.7.2 cgminer and scrypt-based mining)*

## What it Does

* **starts a cgminer [screen](http://en.wikipedia.org/wiki/GNU_Screen) instance then monitors mining status via the cgminer API**
* **periodically checks that cgminer is running and attempts to restart it if needed**
* **monitors gpu health and restarts gpu if needed**
* **restarts cgminer if API access becomes read-only (a symptom of cgminer instability)**
* **outputs information to a filesystem log file (optional)**
* **sends email notifications of important events (optional)**

## Prerequisites
* **OSX or linux host operating system** *(node-cgmon has been tested only on OSX 10.9 and Xubuntu linux 13.10)*
* [node](http://nodejs.org/)
* [npm](https://npmjs.org/)
* [screen](http://en.wikipedia.org/wiki/GNU_Screen)


## Usage

1. **Copy config/config.sample.json** to **config/config.json**
2. **Edit config/config.json** for your environment

    `minerName` - a descriptive name used in logs and emails

    `cgminer.startWaitSeconds` - the time cgmon should wait for cgminer to startup after running it

    `cgminer.cmd` - screen startup script **(normally you do not need to modify this)**

    `cgminer.args` - a JavaScript array of arguments passed to cgminer.cmd *(default empty)* **(normally you do not need to modify this)**

    `cgminer.host` - host IP for cgminer API *(default '127.0.0.1')*

    `cgminer.port` - host port for cgminer API *(default 4028)*

    `minMHSAv` - minimum mh/s average to issue warning for

    `minMHS5s` - minimum mh/s over 5 seconds to issue warning for

    `numGPUs` - will issue warning if this value is different than the detected number of gpus

    `maxTemp` - will reboot machine if gpu temperature exceeds this

    `maxFanSpeed` - will reboot machine if gpu fan speed exceeds this

    `maxHErrPct` - will reboot machine if gpu hardware error % exceeds this

    `maxRejPct` - will reboot machine if gpu work reject % exceeds this

    `maxGetCgminerPidAttempts` - will reboot machine if the number of attempts to get cgminer PID exceeds this

    `monitorIntervalSeconds` - interval in seconds which monitoring takes place *(default 5)*

    `logLevel` - 'debug' for more verbose logging or 'info' for standard logging *(default 'info')*

    `logEnabled` - send stdout to logPath *(default true)*

    `logPath` - path for log file *(default 'cgmon.log')*

    `emailEnabled` - send emails for significant events *(default true)* (currently supports Gmail only)

    `maxEmailIntervalMinutes`

    `emai.user` - username (user@domain.com)

    `email.pass` - password

    `email.from` - notification from email address

    `email.to` - array of notification to email addresses *exmaple ['joe@example.com', 'mary@example.com']*

    `email.subject` - subject for notification emails

    `email.template` - html template used for emails (this file can be found in the project root and customized if desired)

3. **Copy start_miner_example.sh** to **start_miner.sh**
4. **Edit start_miner.sh** for your environment; *modify the paths to cgminer
   and you cgminer configuration file;* **NOTE: make sure to leave '--api-listen'
   on the cgminer command**
5. Run `npm install` *(from node-cgmon directory)* to install node-cgmon dependencies
6. Run cgmon-node *(from node-cgmon directory)*: `node cgmon.js`
7. `screen -r cgminer` should attach to your cgminer screen instance and show you standard
   cgminer output *(CTRL+A CTRL+D) to detatch*

**NOTE:** if you run this node process under a non-superuser, you must give node permissions to reboot the system:

    sudo setcap CAP_SYS_BOOT=+ep /path/to/node/binary

## TODO

* limit email warnings (potential for email spamming at the moment) (nearly takes care of periodic status emails)
* email for pool changes and coin changes
* restart cgminer if hasrate falls below a threshold (currently only warns via email)
* restart cgminer if total shares stop increasing based on a threshold
* switch to basic smtp vs. Gmail-only
* break up monitor() method
* check that pools are executable
* fix janky arguments passing in api() method
* figure out jQuery deferreds mess
* decide what should be done if gpu count is wrong
* periodic restart/reboot?

## Credits

node-cgmon was inspired by [cgmon.tcl](https://bitcointalk.org/index.php?topic=353436.0) and borrows concepts from [CGWatcher](https://github.com/justinmilone/CGWatcher).

node-cgmon leverages a few Node modules but most notably, [node-cgminer](https://github.com/tlrobinson/node-cgminer) which eliminated a nice bit of work.


## License

The content of this project itself is licensed under the [Creative Commons Attribution 3.0 license](http://creativecommons.org/licenses/by/3.0/us/deed.en_US), and the underlying source code used to format and display that content is licensed under the [MIT license](http://opensource.org/licenses/mit-license.php).

---

If you find this software useful, donations are welcome at:

BTC `1JqsUozh2EZVWqA4RxdnsUSNvmEwpFAhWP`

LTC `LLoCXwYRBQGL44vGZWRYrsScweYJzkcvqh`
