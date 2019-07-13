DIR=~/.local/share/gnome-shell/extensions/autohide-battery@sitnik.ru

if [ -d "$DIR" ]; then
  gnome-shell-extension-tool -d autohide-battery@sitnik.ru
  rm -Rf $DIR
fi

mkdir $DIR
cp ./*.js $DIR
cp ./metadata.json $DIR
gnome-shell-extension-tool -e autohide-battery@sitnik.ru
