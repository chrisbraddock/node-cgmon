# node-cgmon

**node-cgmon is a utility intended to monitor [cgminer](https://github.com/ckolivas/cgminer) or [sgminer](https://github.com/veox/sgminer) under linux and maximize its uptime**

*(developed and tested mainly against cgminer 3.7.2 performing scrypt-based mining)*

## What it Does

node-cgmon starts a cgminer or sgminer [screen](http://en.wikipedia.org/wiki/GNU_Screen) instance then monitors mining status via process inspection and the cgminer/sgminer APIs. node-cgmon looks for different indicators of miner failure such as high GPU temp, high fan speed, API disconnect and attempts recovery and/or reboot in order to continue mining.

node-cgmon can also log output to help diagnose mining failures and will also send email notifications so you can take action if mining stops.

## Prerequisites
* **OSX or linux host operating system** *(node-cgmon has been tested only on OSX 10.9 and Xubuntu linux 13.10)*
* [node](http://nodejs.org/)
* [npm](https://npmjs.org/)
* [screen](http://en.wikipedia.org/wiki/GNU_Screen)


## Usage

1. **copy config/config.sample.json** to **config/config.json**
2. **override any config values needed in config/config.json** (see the CONFIG section in cgmon.js for values you can use here)

   example config/config.json:

       {
           "minerName": "my miner",
           "email": {
               "user": "youremail@gmail.com",
               "pass": "your gmail password",
               "from": "from email address",
               "to": "to email address"
           }
       }

3. **copy start_miner_example.sh** to **start_miner.sh**
4. **edit start_miner.sh** for your environment; *modify the paths to cgminer
   and you cgminer configuration file;* **NOTE: make sure to leave '--api-listen'
   on the cgminer command**
5. run `npm install` *(from node-cgmon directory)* to install node-cgmon dependencies
6. run cgmon-node *(from node-cgmon directory)*: `node cgmon.js`
7. `screen -r cgminer` should attach to your cgminer screen instance and show you standard
   cgminer output *(CTRL+A CTRL+D) to detatch*

**NOTE:** if you run this node process under a non-superuser, you must give node permissions to reboot the system:

    sudo setcap CAP_SYS_BOOT=+ep /path/to/node/binary

## TODO

* restart cgminer if hasrate falls below a threshold (currently only warns via email)
* restart cgminer if total shares stop increasing based on a threshold
* switch to basic smtp vs. Gmail-only
* break up monitor() method
* check that scripts are executable
* fix janky arguments passing in api() method
* figure out jQuery deferreds mess
* decide what should be done if gpu count is wrong
* email for coin changes (not sure how to do this via information reported from coin()
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
