# Power Profile Switcher
GNOME Shell extension to automatically switch between power profiles based on power supply

## Recent changes

- Added GNOME Shell 48 and 49 compatibility.
- Improved power profile detection on systems where UPower reports an unknown or fully charged state while on AC power.
- Added fallback handling for the PowerProfiles DBus interface name used across GNOME versions.
- Improved cleanup and error logging when the extension is disabled or DBus calls fail.

## Settings
![Settings window](.github/img/settings.png)

When enabled, the extension will automatically switch to:
- the selected defaults profiles based on the which power supply the device is running on.
- to power saving profile if running on battery and the percentage drops below the selected level.

## Installation

### Dependencies
This extension depends on `powerprofilesctl`. Install it with:
```
# Arch
sudo pacman -S power-profiles-daemon

# Ubuntu
sudo apt install power-profiles-daemon

# Fedora
sudo dnf install power-profiles-daemon
```

Then you need to enable and start the systemd service
```
sudo systemctl enable power-profiles-daemon
sudo systemctl start power-profiles-daemon
```

### From Gnome Extensions store
This extension can be found in the [store](https://extensions.gnome.org/extension/5575/power-profile-switcher/).

[<img src=".github/img/store.png" height="100" alt="Get it on GNOME Extensions">](https://extensions.gnome.org/extension/5575/power-profile-switcher/)

### Installation from source
Clone the repo, pack and install the extension.
```
git clone https://github.com/eliapasquali/power-profile-switcher
cd power-profile-switcher
gnome-extensions pack --extra-source=ui
gnome-extensions install power-profile-switcher@eliapasquali.github.io.shell-extension.zip
```
After this, the extensions is installed. In order to enable it run the following command or use the Extensions app.
```
gnome-extensions enable power-profile-switcher@eliapasquali.github.io
```

## GNOME Version Support
This extension supports GNOME Shell 45 through 49.

## Contribution
Contribution to this project are welcome
