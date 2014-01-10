# node-cgmon
---
**node-cgmon is a utility intended to monitor [cgminer](https://github.com/ckolivas/cgminer) under linux and maximize its uptime**

*(developed and tested against 3.7.2 cgminer and scrypt-based mining)*

## What it Does

* **starts a cgminer [screen](http://en.wikipedia.org/wiki/GNU_Screen) instance then monitors mining status via the cgminer API**
* **periodically checks that cgminer is running and attempts to restart it if needed**

## Prerequisites
* **OSX or linux host operating system** *(node-cgmon has been tested only on OSX 10.9 and Xubuntu linux 13.10)*
* [node](http://nodejs.org/)
* [npm](https://npmjs.org/)
* [screen](http://en.wikipedia.org/wiki/GNU_Screen)


## Usage
---
1. **Copy config/config.sample.json** to **config/config.json**
2. **Edit config/config.json** for your environment

    `cgminer.startWaitSeconds` - the time cgmon should wait for cgminer to startup after running it

    `cgminer.cmd` - screen startup script **(normally you do not need to modify this)**

    `cgminer.args` - a JavaScript array of arguments passed to cgminer.cmd *(default empty)* **(normally you do not need to modify this)**

    `cgminer.host` - host IP for cgminer API *(default '127.0.0.1')*

    `cgminer.port` - host port for cgminer API *(default 4028)*

    `monitorIntervalSeconds` - interval in seconds which monitoring takes place *(default 5)*

	`logLevel` - 'debug' for more verbose logging or 'info' for standard logging *(default 'info')*

    `logEnabled` - send stdout to logPath *(default true)*

    `logPath` - path for log file *(default 'cgmon.log')*

    `emailEnabled` - send emails for significant events *(default true)* (currently supports Gmail only)

    `emai.user` - username (user@domain.com)
    
    `email.pass` - password

    `email.from` - notification from email address

    `email.to` - array of notification to email addresses *exmaple ['joe@example.com', 'mary@example.com']*

    `email.subject` - subject for notification emails *(default 'cgmon')*

    `email.template` - html template used to format email message *(default 'email-template.html)*; this file can be found in the project root and customized if desired

3. **Copy start_miner_example.sh** to **start_miner.sh**
4. **Edit start_miner.sh** for your environment; *modify the paths to cgminer
   and you cgminer configuration file;* **NOTE: make sure to leave '--api-listen'
   on the cgminer command**
5. Run `npm install` *(from node-cgmon directory)* to install node-cgmon dependencies
6. Run cgmon-node *(from node-cgmon directory)*: `node cgmon.js`
7. `screen -r cgminer` should attach to your cgminer screen instance and show you standard
   cgminer output *(CTRL+A CTRL+D) to detatch*

## TODO
---
* restart cgminer if hasrate falls below a threshold
* restart cgminer if total shares stop increasing based on a threshold
* reboot the machine if ...
* switch to basic smtp vs. Gmail-only
* figure out jQuery deferreds mess

## Credits
---
node-cgmon was inspired by [cgmon.tcl](https://bitcointalk.org/index.php?topic=353436.0) and borrows concepts from [CGWatcher](https://github.com/justinmilone/CGWatcher).

node-cgmon leverages a few Node modules but most notably, [node-cgminer](https://github.com/tlrobinson/node-cgminer) which eliminated a nice bit of work.


## License
---
The content of this project itself is licensed under the [Creative Commons Attribution 3.0 license](http://creativecommons.org/licenses/by/3.0/us/deed.en_US), and the underlying source code used to format and display that content is licensed under the [MIT license](http://opensource.org/licenses/mit-license.php).

---

If you find this software useful, donations are welcome at:

BTC `1JqsUozh2EZVWqA4RxdnsUSNvmEwpFAhWP`

LTC `LLoCXwYRBQGL44vGZWRYrsScweYJzkcvqh`