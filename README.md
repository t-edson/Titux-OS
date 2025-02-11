# Titux-OS

Pure Javascript linux shell emulator

![image](https://github.com/user-attachments/assets/893e1c5c-672f-45a5-b2bf-f2210c7c9a88)

Titux-OS is a Javascript library that implements a Linux shell emulator, intended to run completely in any Web browser.

This emulator is written entirely in Javascript and, after downloading the website, you do not need an internet connection to work.

At the moment, only a few commands are implemented:

* cd [dir name]
* cp [-T][-r][-t <dest>] <source> <dest>
* date
* echo [-n] [arg ...]
* help
* hostname
* ls [files] [-a] [-d] [-l] [-t[r]] [-S[r]]
* mkdir DIRECTORY [-v]
* rmdir DIRECTORY [-v]
* pwd
* touch FILES [-a] [-m] [-c]
* whoami
* clear

There is no support for redirects, pipes or permissions.

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

To test the simulator, you can open the test_shell.html page and log as root/root or user/user.