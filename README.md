# Power Profile Switcher
GNOME Shell extension to automatically switch between power profiles based on power supply.

## Settings
![Settings window](.github/screenshots/settings.jpg)  

When enabled, the extension will automatically switch to:
- the selected defaults profiles based on the which power supply the device is running on.
- to power saving profile if running on battery and the percentage drops below the selected level.

## Installation from Gnome Extensions
Get the extension from the [store](https://extensions.gnome.org/extension/5575/power-profile-switcher/).


## Installation from source
Clone the repo and put the files in the extension folder.  
These are usually stored in `~/.local/share/gnome-shell/extensions/`
```
$ cd .local/share/gnome-shell/extensions
$ git clone https://github.com/eliapasquali/power-profile-switcher
$ sudo mv power-profile-switcher power-profile-switcher@eliapasquali.github.io
```
After this, the extensions is installed. In order to enable it run the following command or use the Extensions app.
```
$ gnome-extensions enable power-profile-switcher@eliapasquali.github.io
```

## GNOME Version Support
This extensions is developed and tested on GNOME 43 and on Wayland.

## Contribution
Contribution to this project are welcome
