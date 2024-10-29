# Titux-OS

Pure Javascript linux shell emulator

![image](https://github.com/user-attachments/assets/ae9de7e7-22ee-40e9-950f-9605d8074f74)

Titux-OS is a Javascript library that implements a Linux shell emulator, intended to run completely in any Web browser.

This emulator is written entirely in Javascript and runs offline.

At the moment, only the login and file listing commands are implemented.

The goal is not to have a complete Linux, but rather a shell emulator that allows you to 
perform basic operations, without having to be connected to a real server and without 
worrying about breaking something important.  In addition, there are no remote connection 
problems, because everything runs on the same client PC.

The idea is that it can be used as an educational tool. New custom commands can be added relatively easily.

This project is in the process of implementation, still in an early stage.

## FILES 

This library is made up of 3 files:

* titoansi.js
* titoterm.js
* shell_emu.js

All three should be included in the webpage. 

The first two implement the terminal with support for ANSI sequences. These files have been copied from the project https://github.com/t-edson/titoterm.js

The complete shell emulator is in the "shell_emu.js" file.

