const ExtensionUtils = imports.misc.extensionUtils
const Gettext = imports.gettext
const Gtk = imports.gi.Gtk

let _ = Gettext.domain('autohide-battery').gettext

function init() {
  ExtensionUtils.initTranslations('autohide-battery')
}

function buildPrefsWidget() {
  let settings = ExtensionUtils.getSettings('ru.sitnik.autohide-battery')

  let grid = new Gtk.Grid({
    margin_top: 24,
    margin_bottom: 24,
    margin_start: 24,
    margin_end: 24,
    column_spacing: 24,
    row_spacing: 12,
    halign: Gtk.Align.CENTER
  })

  let label = new Gtk.Label({
    label: _('Hide on battery level above'),
    halign: Gtk.Align.START
  })
  grid.attach(label, 0, 0, 1, 1)

  let field = new Gtk.SpinButton()
  field.set_range(0, 100)
  field.set_sensitive(true)
  field.set_increments(1, 10)
  grid.attach(field, 1, 0, 1, 1)

  let note = new Gtk.Label({
    label: _('If you changed maximum charging level to extend battery life'),
    halign: Gtk.Align.CENTER
  })
  note.get_style_context().add_class('dim-label')
  grid.attach(note, 0, 1, 2, 1)

  field.set_value(settings.get_int('hide-on'))
  field.connect('value-changed', widget => {
    settings.set_int('hide-on', widget.get_value_as_int())
  })
  settings.connect('changed::hide-on', () => {
    field.set_value(settings.get_int('hide-on'))
  })
  return grid
}
