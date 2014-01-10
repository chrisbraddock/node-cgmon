#!/bin/bash
export DISPLAY=:0
export GPU_MAX_ALLOC_PERCENT=100
export GPU_USE_SYNC_OBJECTS=1
# *******************************************************************
# *** MAKE SURE TO INCLUDE --api-listen AT END OF cgminer COMMAND ***
# *******************************************************************
/path/to/cgminer --config /path/to/cgminer.conf --api-listen
